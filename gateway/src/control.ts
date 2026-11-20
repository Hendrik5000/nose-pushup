

import { timingSafeEqual } from 'node:crypto';
import type http from 'node:http';
import type { Gateway } from './server.js';
import type { GatewayConfig } from './config.js';
import type { GatewayStore } from './store.js';
import { bearerToken, json, readJsonBody } from './http-util.js';
import { validatePermissionMap } from './policy.js';

export type ControlContext = {
  gateway: Gateway;
  config: GatewayConfig;
  store: GatewayStore;
  req: http.IncomingMessage;
  res: http.ServerResponse;
};

function tokenOk(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Kontroll-API für die Mira-App (Anbindung in Phase 5). Geschützt durch den
 * Admin-Token; bei Standard-Host 127.0.0.1 nur lokal erreichbar, im Betrieb
 * hinter dem TLS-Reverse-Proxy.
 */
export async function handleControlRequest(ctx: ControlContext): Promise<void> {
  const provided = bearerToken(ctx.req.headers.authorization);
  if (!tokenOk(provided, ctx.config.adminToken)) {
    json(ctx.res, 401, { error: 'unauthorisiert' });
    return;
  }
  const url = new URL(ctx.req.url ?? '/', 'http://localhost');
  const route = url.pathname.slice('/v1/control/'.length);

  if (ctx.req.method === 'GET' && route === 'devices') {
    json(ctx.res, 200, { devices: ctx.gateway.listDevicesOnline() });
    return;
  }
  if (ctx.req.method === 'GET' && route === 'action-log') {
    const limitParam = Number.parseInt(url.searchParams.get('limit') ?? '100', 10);
    const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 100, 1), 1000);
    json(ctx.res, 200, { entries: ctx.store.getActionLog(limit) });
    return;
  }
  if (ctx.req.method === 'GET' && route === 'not-aus') {
    json(ctx.res, 200, { aktiv: ctx.gateway.emergencyStop });
    return;
  }

  if (ctx.req.method !== 'POST') {
    json(ctx.res, 405, { error: 'methode-nicht-erlaubt' });
    return;
  }

  const body = await readJsonBody(ctx.req, 64 * 1024);
  if (body === null || typeof body !== 'object') {
    json(ctx.res, 400, { error: 'ungueltige-anfrage' });
    return;
  }
  const b = body as Record<string, unknown>;

  if (route === 'pairing-code') {
    const record = ctx.store.createPairingCode(new Date(), ctx.config.pairingCodeTtlMs);
    ctx.store.appendLog({ kind: 'kopplung', status: 'code-erzeugt' });
    json(ctx.res, 200, { code: record.code, expiresAt: record.expiresAt });
    return;
  }

  if (route === 'permissions') {
    const deviceId = typeof b.deviceId === 'string' ? b.deviceId : '';
    const permissions = validatePermissionMap(b.permissions);
    if (!deviceId || permissions === null) {
      json(ctx.res, 400, { error: 'ungueltige-anfrage' });
      return;
    }
    const device = ctx.store.setPermissions(deviceId, permissions);
    if (!device) {
      json(ctx.res, 404, { error: 'geraet-unbekannt' });
      return;
    }
    ctx.store.appendLog({ kind: 'sitzung', deviceId, status: 'berechtigungen-aktualisiert' });
    ctx.gateway.refreshPolicy(deviceId);
    json(ctx.res, 200, { ok: true, fingerprint: device.fingerprint });
    return;
  }

  if (route === 'action') {
    const deviceId = typeof b.deviceId === 'string' ? b.deviceId : '';
    const toolId = typeof b.toolId === 'string' ? b.toolId : '';
    if (!deviceId || !toolId) {
      json(ctx.res, 400, { error: 'ungueltige-anfrage' });
      return;
    }
    const outcome = await ctx.gateway.dispatchAction({
      deviceId,
      toolId,
      args: b.args,
      confirmationGranted: b.confirmation === true,
    });
    if (!outcome.dispatched) {
      json(ctx.res, 409, { dispatched: false, reason: outcome.reason });
      return;
    }
    json(ctx.res, 200, {
      dispatched: true,
      requestId: outcome.requestId,
      status: outcome.status,
      detail: outcome.detail,
    });
    return;
  }

  if (route === 'not-aus') {
    const aktiv = b.aktiv === true;
    const grund = typeof b.grund === 'string' ? b.grund.slice(0, 200) : '';
    ctx.gateway.setEmergencyStop(aktiv, grund);
    json(ctx.res, 200, { ok: true, aktiv });
    return;
  }

  if (route === 'screen') {
    const deviceId = typeof b.deviceId === 'string' ? b.deviceId : '';
    if (!deviceId) {
      json(ctx.res, 400, { error: 'ungueltige-anfrage' });
      return;
    }
    const started = b.aktiv !== false;
    const result = started
      ? ctx.gateway.startScreenSession(deviceId)
      : ctx.gateway.stopScreenSession(deviceId, 'beendet-durch-nutzer');
    if (result.ok) {
      json(ctx.res, 200, { ok: true, sessionId: result.sessionId });
    } else {
      json(ctx.res, 409, { ok: false, reason: result.reason });
    }
    return;
  }

  if (route === 'revoke') {
    const deviceId = typeof b.deviceId === 'string' ? b.deviceId : '';
    if (!deviceId) {
      json(ctx.res, 400, { error: 'ungueltige-anfrage' });
      return;
    }
    const revoked = ctx.gateway.revokeDevice(deviceId, typeof b.grund === 'string' ? b.grund.slice(0, 200) : '');
    json(ctx.res, revoked ? 200 : 404, revoked ? { ok: true } : { error: 'geraet-unbekannt' });
    return;
  }

  json(ctx.res, 404, { error: 'nicht-gefunden' });
}
