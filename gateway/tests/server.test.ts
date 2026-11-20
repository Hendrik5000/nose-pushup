import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { generateKeyPairSync } from 'node:crypto';
import { WebSocket } from 'ws';
import { loadConfig } from '../src/config.js';
import { GatewayStore } from '../src/store.js';
import { Gateway } from '../src/server.js';
import { createEnvelope, parseEnvelope, MessageTypes } from '../src/messages.js';

const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKeySpki = (publicKey.export({ type: 'spki', format: 'der' }) as Buffer).toString('base64');

const ADMIN_HEADERS = { authorization: 'Bearer test-admin-token' };

type Booted = { gateway: Gateway; store: GatewayStore; port: number; dir: string };

async function boot(): Promise<Booted> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mira-gw-'));
  const config = loadConfig({ MIRA_GATEWAY_DATA_DIR: dir, MIRA_GATEWAY_ADMIN_TOKEN: 'test-admin-token' });
  const store = new GatewayStore(path.join(dir, 'gateway-state.json'), { actionLogMax: config.actionLogMaxEntries });
  const gateway = new Gateway(config, store);
  await gateway.start();
  return { gateway, store, port: gateway.getPort(), dir };
}

function post(
  port: number,
  pathname: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const data = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: pathname,
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(data)), ...headers },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') }));
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(
  port: number,
  pathname: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: pathname, method: 'GET', headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') }));
    });
    req.on('error', reject);
    req.end();
  });
}

function nextEnvelope(ws: WebSocket, timeoutMs = 3000): Promise<ReturnType<typeof parseEnvelope>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('keine Nachricht empfangen')), timeoutMs);
    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve(parseEnvelope(data.toString('utf8')));
    });
  });
}

function allPermissions(map: Record<string, string>): Record<string, string> {
  return {
    status: 'keine',
    programme: 'keine',
    fenster: 'keine',
    eingaben: 'keine',
    bildschirm: 'keine',
    dateien: 'keine',
    einstellungen: 'keine',
    audio: 'keine',
    ...map,
  };
}

test('Ende-zu-Ende: Kopplung, Verbindung, Befehle, Not-Aus, Widerruf', { timeout: 30000 }, async () => {
  const { gateway, store, port, dir } = await boot();
  try {
    // Ohne Admin-Token / Kontrolle
    const health = await get(port, '/healthz');
    assert.equal(health.status, 200);
    assert.equal(health.body.ok, true);

    const noAuth = await get(port, '/v1/control/devices');
    assert.equal(noAuth.status, 401);

    // Kopplungscode erzeugen und verbrauchen
    const codeRes = await post(port, '/v1/control/pairing-code', {}, ADMIN_HEADERS);
    assert.equal(codeRes.status, 200);
    assert.match(codeRes.body.code as string, /^[0-9]{6}$/);

    // Zweiter Code direkt daneben: beide gltig, der Reihenfolge halber nur ein Testbetrieb
    const pairRes = await post(port, '/v1/pair', {
      code: codeRes.body.code,
      deviceName: 'Hendriks PC',
      platform: 'windows',
      publicKeySpki,
      agentVersion: '0.2.0-phase2',
    });
    assert.equal(pairRes.status, 200);
    const deviceId = pairRes.body.deviceId as string;
    const deviceToken = pairRes.body.deviceToken as string;
    assert.match(pairRes.body.fingerprint as string, /^[0-9a-f]{16}$/);

    // Einmalcode ist verbraucht
    const reuse = await post(port, '/v1/pair', {
      code: codeRes.body.code,
      deviceName: 'Hendriks PC',
      platform: 'windows',
      publicKeySpki,
      agentVersion: '0.2.0-phase2',
    });
    assert.equal(reuse.status, 400);

    // Zugriff ohne Token wird abgelehnt
    const badAuth = await new Promise<string>((resolve) => {
      const ws = new WebSocket('ws://127.0.0.1:' + port + '/v1/ws', {
        headers: { 'x-mira-device': deviceId, authorization: 'Bearer falsch' },
      });
      ws.on('open', () => resolve('open'));
      ws.on('error', () => resolve('error'));
      ws.on('close', () => resolve('close'));
    });
    assert.notEqual(badAuth, 'open');

    // Saubere Verbindung: hello -> welcome
    const ws = new WebSocket('ws://127.0.0.1:' + port + '/v1/ws', {
      headers: { 'x-mira-device': deviceId, authorization: 'Bearer ' + deviceToken },
    });
    await new Promise((resolve, reject) => {
      ws.once('open', () => resolve(null));
      ws.once('error', reject);
    });
    const welcome = await nextEnvelope(ws);
    assert.equal(welcome?.type, 'welcome');
    const welcomePayload = JSON.parse(welcome?.payloadJson ?? '{}') as Record<string, unknown>;
    assert.deepEqual(welcomePayload.permissions, allPermissions({}));

    // Aktion vor Freigabe: Routing verweigert (keine Berechtigungsspiegel gesetzt)
    const rejected = await post(port, '/v1/control/action', { deviceId, toolId: 'programme.liste' }, ADMIN_HEADERS);
    assert.equal(rejected.status, 409);
    assert.equal(rejected.body.reason, 'berechtigung-fehlt');

    // Freigabe setzen -> welcome-Auffrischung
    const permRes = await post(
      port,
      '/v1/control/permissions',
      { deviceId, permissions: allPermissions({ programme: 'steuern' }) },
      ADMIN_HEADERS,
    );
    assert.equal(permRes.status, 200);
    const refreshed = await nextEnvelope(ws);
    assert.equal(refreshed?.type, 'welcome');
    const refreshedPayload = JSON.parse(refreshed?.payloadJson ?? '{}') as Record<string, unknown>;
    assert.deepEqual(
      (refreshedPayload.permissions as Record<string, string>).programme,
      'steuern',
    );

    // Aktionsrunde: request raus, result zurck an die Kontrolle
    const actionPromise = post(
      port,
      '/v1/control/action',
      { deviceId, toolId: 'programme.liste', args: {} },
      ADMIN_HEADERS,
    );
    const requestEnv = await nextEnvelope(ws);
    assert.equal(requestEnv?.type, 'action.request');
    const requestPayload = JSON.parse(requestEnv?.payloadJson ?? '{}') as Record<string, unknown>;
    assert.equal(requestPayload.toolId, 'programme.liste');
    ws.send(
      JSON.stringify(
        createEnvelope(MessageTypes.ActionResult, {
          requestId: requestPayload.requestId,
          status: 'ok',
          detail: 'test-bestanden',
        }),
      ),
    );
    const actionRes = await actionPromise;
    assert.equal(actionRes.status, 200);
    assert.equal(actionRes.body.status, 'ok');
    assert.equal(actionRes.body.detail, 'test-bestanden');

    // Herzschlag wird beantwortet
    ws.send(JSON.stringify(createEnvelope(MessageTypes.Heartbeat)));
    const beat = await nextEnvelope(ws);
    assert.equal(beat?.type, 'heartbeat');

    // Kritisch: ohne Besttigung abgelehnt
    await post(
      port,
      '/v1/control/permissions',
      { deviceId, permissions: allPermissions({ einstellungen: 'kritisch' }) },
      ADMIN_HEADERS,
    );
    await nextEnvelope(ws);
    const critDenied = await post(
      port,
      '/v1/control/action',
      { deviceId, toolId: 'einstellungen.herunterfahren' },
      ADMIN_HEADERS,
    );
    assert.equal(critDenied.status, 409);
    assert.equal(critDenied.body.reason, 'bestaetigung-erforderlich');

    // Kritisch mit Besttigung: Agent antwortet bestaetigung-erforderlich -> wird durchgereicht
    const critPromise = post(
      port,
      '/v1/control/action',
      { deviceId, toolId: 'einstellungen.herunterfahren', confirmation: true },
      ADMIN_HEADERS,
    );
    const critEnv = await nextEnvelope(ws);
    assert.equal(critEnv?.type, 'action.request');
    const critPayload = JSON.parse(critEnv?.payloadJson ?? '{}') as Record<string, unknown>;
    ws.send(
      JSON.stringify(
        createEnvelope(MessageTypes.ActionResult, {
          requestId: critPayload.requestId,
          status: 'bestaetigung-erforderlich',
          detail: '',
        }),
      ),
    );
    const critRes = await critPromise;
    assert.equal(critRes.status, 200);
    assert.equal(critRes.body.status, 'bestaetigung-erforderlich');

    // Bildschirm-Sitzung ohne Freigabe
    const screenDenied = await post(port, '/v1/control/screen', { deviceId, aktiv: true }, ADMIN_HEADERS);
    assert.equal(screenDenied.status, 409);
    assert.equal(screenDenied.body.reason, 'berechtigung-fehlt');

    // Bildschirm-Sitzung mit Freigabe: Frames flieen
    await post(
      port,
      '/v1/control/permissions',
      { deviceId, permissions: allPermissions({ bildschirm: 'steuern' }) },
      ADMIN_HEADERS,
    );
    await nextEnvelope(ws);
    let capturedFrame: string | null = null;
    let capturedSession: string | null = null;
    gateway.onScreenFrame = (frameDevice, frameSession, frameBase64) => {
      capturedSession = frameDevice + ':' + frameSession;
      capturedFrame = frameBase64;
    };
    const screenStart = await post(port, '/v1/control/screen', { deviceId, aktiv: true }, ADMIN_HEADERS);
    assert.equal(screenStart.status, 200);
    const sessionEnv = await nextEnvelope(ws);
    assert.equal(sessionEnv?.type, 'screen.session.start');
    const sessionPayload = JSON.parse(sessionEnv?.payloadJson ?? '{}') as Record<string, unknown>;
    ws.send(
      JSON.stringify(
        createEnvelope(MessageTypes.ScreenFrame, {
          sessionId: sessionPayload.sessionId,
          frameBase64: 'aGVsbG8=',
        }),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(capturedFrame, 'aGVsbG8=');
    assert.equal(capturedSession, deviceId + ':' + (sessionPayload.sessionId as string));

    // Not-Aus: Routing pausiert, Gert wird informiert
    const notaus = await post(port, '/v1/control/not-aus', { aktiv: true, grund: 'prfung' }, ADMIN_HEADERS);
    assert.equal(notaus.status, 200);
    const notausEnv = await nextEnvelope(ws);
    assert.equal(notausEnv?.type, 'not-aus');
    const blockedDuringNotAus = await post(
      port,
      '/v1/control/action',
      { deviceId, toolId: 'programme.liste' },
      ADMIN_HEADERS,
    );
    assert.equal(blockedDuringNotAus.status, 409);
    assert.equal(blockedDuringNotAus.body.reason, 'not-aus-aktiv');
    assert.equal(gateway.emergencyStop, true);

    await post(port, '/v1/control/not-aus', { aktiv: false }, ADMIN_HEADERS);
    assert.equal(gateway.emergencyStop, false);

    // Widerruf: revoke-Nachricht + Close-Code 4403
    const revoke = await post(port, '/v1/control/revoke', { deviceId, grund: 'test' }, ADMIN_HEADERS);
    assert.equal(revoke.status, 200);
    const revokeEnv = await nextEnvelope(ws);
    assert.equal(revokeEnv?.type, 'revoke');
    const closeCode = await new Promise<number>((resolve) => {
      ws.once('close', (code) => resolve(code));
    });
    assert.equal(closeCode, 4403);
    assert.notEqual(store.getDevice(deviceId)?.revokedAt, null);

    // Protokoll führt alles mit (minimiert, ohne Inhalte)
    const log = await get(port, '/v1/control/action-log?limit=50', ADMIN_HEADERS);
    assert.equal(log.status, 200);
    const entries = log.body.entries as Array<Record<string, unknown>>;
    assert.ok(entries.length >= 5);
    assert.equal(JSON.stringify(entries).includes('aGVsbG8='), false);
  } finally {
    await gateway.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Unbekannte Routen ergeben 404', async () => {
  const { gateway, port, dir } = await boot();
  try {
    const res = await get(port, '/v1/control/unbekannt', ADMIN_HEADERS);
    assert.equal(res.status, 404);
    const plain = await get(port, '/irgendetwas');
    assert.equal(plain.status, 404);
  } finally {
    await gateway.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
