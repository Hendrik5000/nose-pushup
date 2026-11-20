


import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import {
  createEnvelope,
  parseEnvelope,
  parsePayload,
  validateActionResultPayload,
  validateHelloPayload,
  MessageTypes,
  type Envelope,
} from './messages.js';
import { isSecureRequest, type GatewayConfig } from './config.js';
import { createTokenMaterial, GatewayStore } from './store.js';
import { PairingAttemptLimiter, validatePairingBody } from './pairing.js';
import {
  authorizeAction,
  buildActionRequestPayload,
  validatePermissionMap,
  TOOL_POLICIES,
  type Permissions,
} from './policy.js';
import { bearerToken, headerValue, json, readJsonBody } from './http-util.js';
import { handleControlRequest } from './control.js';

type DeviceSession = {
  ws: WebSocket;
  deviceId: string;
  authenticated: boolean;
  connectedAt: number;
  lastSeenAt: number;
};

export type DispatchOutcome =
  | { dispatched: true; requestId: string; status: string; detail?: string }
  | { dispatched: false; reason: string };

export type SessionResult = { ok: true; sessionId?: string } | { ok: false; reason: string };

type PendingAction = {
  deviceId: string;
  timer: ReturnType<typeof setTimeout>;
  resolve: (payload: { status: string; detail?: string }) => void;
};

export type OnlineDevice = import('./store.js').SanitizedDevice & { online: boolean };

/**
 * Device Control Gateway (Phase 4): dedizierter WSS-Dienst gemäß
 * docs/device-control-gateway-spec.md. Geräte bauen die Verbindung selbst
 * auf (Bearer + X-Mira-Device), Kontrollzugriff nur über den Admin-Token.
 */
export class Gateway {
  private readonly server: http.Server;
  private readonly wss: WebSocketServer;
  private readonly sessions: Map<string, DeviceSession> = new Map();
  private readonly pendingActions: Map<string, PendingAction> = new Map();
  private readonly screenSessions: Map<
    string,
    {
      sessionId: string;
      startedAt: string;
      frameTimes: number[];
      frameBase64: string | null;
      frameAt: string | null;
    }
  > = new Map();
  private readonly pairingLimiter: PairingAttemptLimiter;
  private readonly watchdog: ReturnType<typeof setInterval>;
  private readonly emergencyStopOwners = new Set<string>();

  /** Rückruf für Live-Bildschirm-Frames; Anbindung an die Mira-UI in Phase 5. */
  onScreenFrame?: (deviceId: string, sessionId: string, frameBase64: string) => void;

  constructor(
    private readonly config: GatewayConfig,
    private readonly store: GatewayStore,
  ) {
    this.pairingLimiter = new PairingAttemptLimiter(config.pairingMaxFailures, config.pairingFailureWindowMs);
    this.server = http.createServer((req, res) => {
      void this.handleRequest(req, res);
    });
    this.wss = new WebSocketServer({ noServer: true, maxPayload: config.maxMessageBytes });
    this.server.on('upgrade', (req, socket, head) => {
      this.handleUpgrade(req, socket, head);
    });
    this.watchdog = setInterval(() => this.sweep(), 5000);
  }

  get emergencyStop(): boolean {
    return this.emergencyStopOwners.size > 0;
  }

  isEmergencyStopActive(ownerUserId: string): boolean {
    return this.emergencyStopOwners.has(ownerUserId);
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.config.port, this.config.host, () => {
        this.server.removeListener('error', reject);
        resolve();
      });
    });
  }

  getPort(): number {
    const address = this.server.address();
    return address && typeof address === 'object' ? (address as AddressInfo).port : this.config.port;
  }

  async stop(): Promise<void> {
    clearInterval(this.watchdog);
    for (const session of this.sessions.values()) {
      try {
        session.ws.close(1001, 'gateway-herunterfahren');
      } catch {
        // Verbindungen sind beim Herunterfahren evtl. schon weg: bewusst ignoriert.
      }
    }
    for (const pending of this.pendingActions.values()) {
      clearTimeout(pending.timer);
      pending.resolve({ status: 'error', detail: 'gateway-herunterfahren' });
    }
    this.pendingActions.clear();
    this.screenSessions.clear();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  listDevicesOnline(ownerUserId?: string): OnlineDevice[] {
    const devices = ownerUserId ? this.store.listDevicesForOwner(ownerUserId) : this.store.listDevices();
    return devices.map((device) => ({
      ...device,
      online: this.sessions.get(device.deviceId)?.authenticated === true,
    }));
  }

  refreshPolicy(deviceId: string): void {
    const session = this.sessions.get(deviceId);
    const device = this.store.getDevice(deviceId);
    if (!session || !session.authenticated || !device) return;
    try {
      session.ws.send(JSON.stringify(createEnvelope(MessageTypes.Welcome, this.welcomePayload(device.permissions))));
    } catch {
      // Bricht die Verbindung, bernimmt der Watchdog das Aufrumen.
    }
  }

  async dispatchAction(input: {
    deviceId: string;
    ownerUserId?: string;
    toolId: string;
    args?: unknown;
    confirmationGranted?: boolean;
  }): Promise<DispatchOutcome> {
    if (input.ownerUserId ? this.emergencyStopOwners.has(input.ownerUserId) : this.emergencyStop) {
      return { dispatched: false, reason: 'not-aus-aktiv' };
    }
    const device = this.store.getDevice(input.deviceId);
    if (!device || device.revokedAt !== null || (input.ownerUserId && device.ownerUserId !== input.ownerUserId)) {
      return { dispatched: false, reason: 'geraet-unbekannt' };
    }
    const session = this.sessions.get(input.deviceId);
    if (!session || !session.authenticated) {
      return { dispatched: false, reason: 'geraet-offline' };
    }
    const authorization = authorizeAction({
      toolId: input.toolId,
      permissions: device.permissions,
      confirmationGranted: input.confirmationGranted,
      hasActiveScreenSession: this.screenSessions.has(input.deviceId),
    });
    if (!authorization.allowed) {
      this.store.appendLog({
        kind: 'ablehnung',
        deviceId: input.deviceId,
        toolId: input.toolId,
        status: authorization.reason,
      });
      return { dispatched: false, reason: authorization.reason };
    }
    const requestId = randomUUID();
    const envelope = createEnvelope(
      MessageTypes.ActionRequest,
      buildActionRequestPayload(requestId, input.toolId, input.args, input.confirmationGranted === true),
    );
    return await new Promise<DispatchOutcome>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingActions.delete(requestId);
        this.store.appendLog({ kind: 'aktion', deviceId: input.deviceId, toolId: input.toolId, status: 'timeout' });
        resolve({ dispatched: true, requestId, status: 'timeout' });
      }, this.config.actionTimeoutMs);
      this.pendingActions.set(requestId, {
        deviceId: input.deviceId,
        timer,
        resolve: (payload) => {
          clearTimeout(timer);
          resolve({ dispatched: true, requestId, status: payload.status, detail: payload.detail });
        },
      });
      session.ws.send(JSON.stringify(envelope));
      this.store.appendLog({ kind: 'aktion', deviceId: input.deviceId, toolId: input.toolId, status: 'gesendet' });
    });
  }

  /**
   * Not-Aus (Spezifikation): Routing pausieren, alle laufenden
   * Bildschirm-Sitzungen beenden, Geräte informieren.
   */
  setEmergencyStop(aktiv: boolean, grund: string, ownerUserId?: string): void {
    const ownerKey = ownerUserId ?? '__global__';
    if (aktiv) this.emergencyStopOwners.add(ownerKey);
    else this.emergencyStopOwners.delete(ownerKey);
    this.store.appendLog({ kind: 'not-aus', status: aktiv ? 'aktiviert' : 'deaktiviert', detail: grund });
    if (!aktiv) return;
    for (const [deviceId, session] of this.sessions) {
      const device = this.store.getDevice(deviceId);
      if (ownerUserId && device?.ownerUserId !== ownerUserId) continue;
      if (this.screenSessions.has(deviceId)) {
        this.stopScreenSession(deviceId, 'not-aus');
      }
      try {
        session.ws.send(JSON.stringify(createEnvelope(MessageTypes.NotAus, { grund: grund || 'not-aus' })));
      } catch {
        // Nicht zustellbar: Verbindung endet via Timeout, Agent verwirft ebenfalls.
      }
    }
  }

  revokeDevice(deviceId: string, grund: string): boolean {
    const device = this.store.getDevice(deviceId);
    if (!device) return false;
    this.store.revokeDevice(deviceId, new Date());
    this.store.appendLog({ kind: 'widerruf', deviceId, detail: grund });
    const session = this.sessions.get(deviceId);
    if (session) {
      this.screenSessions.delete(deviceId);
      try {
        session.ws.send(
          JSON.stringify(createEnvelope(MessageTypes.Revoke, { grund: grund || 'widerrufen' })),
          (error) => {
            if (error) session.ws.terminate();
            else session.ws.close(4403, 'widerrufen');
          },
        );
      } catch {
        // Fehlschlag beim Schlieen ist unkritisch, Gerät ist bereits widerrufen.
      }
      this.sessions.delete(deviceId);
    }
    return true;
  }

  startScreenSession(deviceId: string, ownerUserId?: string): SessionResult {
    if (ownerUserId ? this.emergencyStopOwners.has(ownerUserId) : this.emergencyStop) return { ok: false, reason: 'not-aus-aktiv' };
    const device = this.store.getDevice(deviceId);
    if (!device || device.revokedAt !== null || (ownerUserId && device.ownerUserId !== ownerUserId)) return { ok: false, reason: 'geraet-unbekannt' };
    const session = this.sessions.get(deviceId);
    if (!session || !session.authenticated) return { ok: false, reason: 'geraet-offline' };
    const rank: Record<string, number> = { keine: 0, lesen: 1, steuern: 2, kritisch: 3 };
    if ((rank[device.permissions.bildschirm] ?? 0) < rank.steuern) {
      return { ok: false, reason: 'berechtigung-fehlt' };
    }
    if (this.screenSessions.has(deviceId)) return { ok: false, reason: 'sitzung-laeuft-schon' };
    const sessionId = randomUUID();
    this.screenSessions.set(deviceId, {
      sessionId,
      startedAt: new Date().toISOString(),
      frameTimes: [],
      frameBase64: null,
      frameAt: null,
    });
    this.store.appendLog({ kind: 'sitzung', deviceId, status: 'screen-gestartet' });
    try {
      session.ws.send(JSON.stringify(createEnvelope(MessageTypes.ScreenSessionStart, { sessionId })));
    } catch {
      this.screenSessions.delete(deviceId);
      return { ok: false, reason: 'senden-fehlgeschlagen' };
    }
    return { ok: true, sessionId };
  }

  stopScreenSession(deviceId: string, grund: string, ownerUserId?: string): SessionResult {
    const device = this.store.getDevice(deviceId);
    if (ownerUserId && device?.ownerUserId !== ownerUserId) return { ok: false, reason: 'geraet-unbekannt' };
    const active = this.screenSessions.get(deviceId);
    if (!active) return { ok: false, reason: 'keine-sitzung' };
    this.screenSessions.delete(deviceId);
    this.store.appendLog({ kind: 'sitzung', deviceId, status: 'screen-beendet', detail: grund });
    const session = this.sessions.get(deviceId);
    if (session) {
      try {
        session.ws.send(
          JSON.stringify(createEnvelope(MessageTypes.ScreenSessionStop, { sessionId: active.sessionId })),
        );
      } catch {
        // Verbindungsfehler ndert nichts am Sitzungsstopp.
      }
    }
    return { ok: true, sessionId: active.sessionId };
  }

  getScreenFrame(
    deviceId: string,
    ownerUserId: string,
  ): { active: boolean; sessionId: string | null; frameBase64: string | null; capturedAt: string | null } {
    const device = this.store.getDevice(deviceId);
    if (!device || device.ownerUserId !== ownerUserId || device.revokedAt !== null) {
      return { active: false, sessionId: null, frameBase64: null, capturedAt: null };
    }
    const active = this.screenSessions.get(deviceId);
    if (!active) return { active: false, sessionId: null, frameBase64: null, capturedAt: null };
    const frameIsFresh = active.frameAt !== null && Date.now() - Date.parse(active.frameAt) <= 5000;
    return {
      active: true,
      sessionId: active.sessionId,
      frameBase64: frameIsFresh ? active.frameBase64 : null,
      capturedAt: frameIsFresh ? active.frameAt : null,
    };
  }

  // ---- Intern -------------------------------------------------------------

  private welcomePayload(permissions: Permissions): Record<string, unknown> {
    return {
      permissions,
      toolAllowlist: Object.keys(TOOL_POLICIES),
      screenSessionRequired: true,
      heartbeatTimeoutSeconds: Math.round(this.config.heartbeatTimeoutMs / 1000),
    };
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (!req.url) {
      json(res, 400, { error: 'ungueltige-anfrage' });
      return;
    }
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/healthz') {
      json(res, 200, { ok: true, notaus: this.emergencyStop });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/v1/pair') {
      await this.handlePair(req, res);
      return;
    }
    if (url.pathname.startsWith('/v1/control/')) {
      await handleControlRequest({ gateway: this, config: this.config, store: this.store, req, res });
      return;
    }
    json(res, 404, { error: 'nicht-gefunden' });
  }

  private async handlePair(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const remote = req.socket.remoteAddress ?? '';
    if (!isSecureRequest(remote, headerValue(req, 'x-forwarded-proto'), this.config)) {
      json(res, 403, { error: 'unsichere-verbindung' });
      return;
    }
    if (this.pairingLimiter.isBlocked(remote)) {
      json(res, 429, { error: 'zu-viele-versuche' });
      return;
    }
    const body = await readJsonBody(req, 16 * 1024);
    const parsed = validatePairingBody(body);
    if (!parsed) {
      this.pairingLimiter.registerFailure(remote);
      this.store.appendLog({ kind: 'kopplung', status: 'abgelehnt-format' });
      json(res, 400, { error: 'ungueltige-anfrage' });
      return;
    }
    const check = this.store.checkPairing(parsed.code);
    if (!check.record) {
      this.pairingLimiter.registerFailure(remote);
      this.store.appendLog({ kind: 'kopplung', status: 'abgelehnt-' + check.reason });
      json(res, 400, { error: check.reason });
      return;
    }
    if (!check.record.ownerUserId) {
      json(res, 400, { error: 'kopplungscode-ohne-konto' });
      return;
    }
    const material = createTokenMaterial();
    const device = this.store.pairDevice({
      name: parsed.deviceName,
      platform: parsed.platform,
      publicKeySpki: parsed.publicKeySpki,
      agentVersion: parsed.agentVersion,
      salt: material.salt,
      tokenHash: material.tokenHash,
      ownerUserId: check.record.ownerUserId,
    });
    this.store.markPairingUsed(parsed.code);
    this.pairingLimiter.reset(remote);
    this.store.appendLog({ kind: 'kopplung', deviceId: device.deviceId, status: 'gekoppelt' });
    json(res, 200, {
      deviceId: device.deviceId,
      deviceToken: material.token,
      fingerprint: device.fingerprint,
    });
  }

  private tokenMatches(token: string, deviceId: string): boolean {
    const device = this.store.getDevice(deviceId);
    if (!device) return false;
    const byToken = this.store.getDeviceByToken(token);
    if (!byToken) return false;
    const a = Buffer.from(byToken.deviceId, 'utf8');
    const b = Buffer.from(deviceId, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private handleUpgrade(req: http.IncomingMessage, socket: Duplex, head: Buffer): void {
    let pathname = '';
    try {
      pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    } catch {
      socket.destroy();
      return;
    }
    if (pathname !== '/v1/ws') {
      socket.destroy();
      return;
    }
    const deviceIdHeader = headerValue(req, 'x-mira-device') ?? '';
    const token = bearerToken(req.headers.authorization);
    if (!deviceIdHeader || token === '' || !this.tokenMatches(token, deviceIdHeader)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    const device = this.store.getDevice(deviceIdHeader);
    if (!device || device.revokedAt !== null) {
      // Widerruf erst nach Upgrade als Close-Code 4403 signalisieren (Spezifikation).
      this.wss.handleUpgrade(req, socket, head, (ws) => {
        try {
          ws.send(JSON.stringify(createEnvelope(MessageTypes.Revoke, { grund: 'widerrufen' })));
          ws.close(4403, 'widerrufen');
        } catch {
          socket.destroy();
        }
      });
      return;
    }
    this.wss.handleUpgrade(req, socket, head, (ws) => this.registerSession(deviceIdHeader, ws));
  }

  private registerSession(deviceId: string, ws: WebSocket): void {
    const existing = this.sessions.get(deviceId);
    if (existing) {
      try {
        existing.ws.close(1000, 'neue-sitzung');
      } catch {
        // Alte Verbindung ist evtl. schon weg: bewusst ignoriert.
      }
    }
    const now = Date.now();
    const session: DeviceSession = { ws, deviceId, authenticated: false, connectedAt: now, lastSeenAt: now };
    this.sessions.set(deviceId, session);
    this.store.appendLog({ kind: 'verbindung', deviceId, status: 'aufgebaut' });
    ws.on('message', (data) => {
      session.lastSeenAt = Date.now();
      let envelope: Envelope | null = null;
      try {
        envelope = parseEnvelope(data.toString('utf8'));
      } catch {
        envelope = null;
      }
      if (envelope === null) {
        this.store.appendLog({ kind: 'ablehnung', deviceId, status: 'ungueltiger-umschlag' });
        return;
      }
      try {
        this.handleEnvelope(session, envelope);
      } catch {
        this.store.appendLog({ kind: 'ablehnung', deviceId, status: 'verarbeitungsfehler' });
      }
    });
    ws.on('close', () => {
      this.sessions.delete(deviceId);
      this.screenSessions.delete(deviceId);
      this.store.appendLog({ kind: 'verbindung', deviceId, status: 'getrennt' });
    });
    ws.on('error', () => {
      try {
        ws.terminate();
      } catch {
        // Nichts mehr zu retten; der close-Handler räumt auf.
      }
    });
  }

  private handleEnvelope(session: DeviceSession, envelope: Envelope): void {
    if (!session.authenticated) {
      if (envelope.type !== MessageTypes.Hello) {
        session.ws.close(1008, 'hello-erwartet');
        return;
      }
      const hello = parsePayload(envelope, validateHelloPayload);
      if (!hello || hello.deviceId !== session.deviceId) {
        session.ws.close(1008, 'hello-ungueltig');
        return;
      }
      session.authenticated = true;
      const device = this.store.getDevice(session.deviceId);
      session.ws.send(
        JSON.stringify(createEnvelope(MessageTypes.Welcome, this.welcomePayload(device!.permissions))),
      );
      return;
    }
    switch (envelope.type) {
      case MessageTypes.Heartbeat: {
        session.ws.send(JSON.stringify(createEnvelope(MessageTypes.Heartbeat)));
        return;
      }
      case MessageTypes.ActionResult: {
        const result = parsePayload(envelope, validateActionResultPayload);
        if (!result) {
          this.store.appendLog({ kind: 'ablehnung', deviceId: session.deviceId, status: 'ergebnis-ungueltig' });
          return;
        }
        const pending = this.pendingActions.get(result.requestId);
        if (!pending || pending.deviceId !== session.deviceId) return;
        this.pendingActions.delete(result.requestId);
        this.store.appendLog({ kind: 'aktion', deviceId: session.deviceId, status: result.status });
        pending.resolve({ status: result.status, detail: result.detail });
        return;
      }
      case MessageTypes.ScreenFrame: {
        this.handleScreenFrame(session, envelope);
        return;
      }
      case MessageTypes.ScreenSessionStop: {
        this.stopScreenSession(session.deviceId, 'vom-geraet-beendet');
        return;
      }
      default: {
        this.store.appendLog({ kind: 'ablehnung', deviceId: session.deviceId, status: 'typ-unbekannt' });
      }
    }
  }

  private handleScreenFrame(session: DeviceSession, envelope: Envelope): void {
    const active = this.screenSessions.get(session.deviceId);
    if (!active) {
      this.store.appendLog({ kind: 'ablehnung', deviceId: session.deviceId, status: 'frame-ohne-sitzung' });
      return;
    }
    if (envelope.payloadJson === undefined) return;
    let frame: unknown;
    try {
      frame = JSON.parse(envelope.payloadJson);
    } catch {
      return;
    }
    if (typeof frame !== 'object' || frame === null) return;
    const f = frame as Record<string, unknown>;
    if (f.sessionId !== active.sessionId) {
      this.store.appendLog({ kind: 'ablehnung', deviceId: session.deviceId, status: 'frame-falsche-sitzung' });
      return;
    }
    if (
      typeof f.frameBase64 !== 'string' ||
      f.frameBase64.length === 0 ||
      f.frameBase64.length > 1_500_000 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(f.frameBase64)
    ) {
      this.store.appendLog({ kind: 'ablehnung', deviceId: session.deviceId, status: 'frame-ungueltig' });
      return;
    }
    const now = Date.now();
    active.frameTimes = active.frameTimes.filter((t) => now - t < 1000);
    if (active.frameTimes.length >= this.config.screenMaxFramesPerSecond * 2) {
      this.stopScreenSession(session.deviceId, 'zu-viele-frames');
      this.store.appendLog({ kind: 'ablehnung', deviceId: session.deviceId, status: 'frame-rate-limit' });
      return;
    }
    if (active.frameTimes.length < this.config.screenMaxFramesPerSecond) {
      active.frameTimes.push(now);
      active.frameBase64 = f.frameBase64;
      active.frameAt = new Date(now).toISOString();
      if (this.onScreenFrame) {
        try {
          this.onScreenFrame(session.deviceId, active.sessionId, f.frameBase64);
        } catch {
          // Konsumentenfehler darf die Geräteverbindung nicht beenden.
        }
      }
    }
  }

  private sweep(): void {
    const now = Date.now();
    for (const [deviceId, session] of this.sessions) {
      const deadline = session.authenticated
        ? session.lastSeenAt + this.config.heartbeatTimeoutMs
        : session.connectedAt + this.config.handshakeTimeoutMs;
      if (now > deadline) {
        try {
          session.ws.close(1001, 'timeout');
        } catch {
          try {
            session.ws.terminate();
          } catch {
            // Verbindungen kurz vor dem Timeout sind manchmal schon weg.
          }
        }
      }
    }
  }
}
