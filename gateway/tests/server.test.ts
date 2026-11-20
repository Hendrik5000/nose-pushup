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
const TEST_USER_ID = '123e4567-e89b-12d3-a456-426614174000';
const OTHER_USER_ID = '123e4567-e89b-12d3-a456-426614174001';

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

type ParsedEnvelope = ReturnType<typeof parseEnvelope>;
type MessageWaiter = {
  resolve: (envelope: ParsedEnvelope) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
type MessageQueue = { messages: ParsedEnvelope[]; waiters: MessageWaiter[] };
const messageQueues = new WeakMap<WebSocket, MessageQueue>();

function messageQueue(ws: WebSocket): MessageQueue {
  const existing = messageQueues.get(ws);
  if (existing) return existing;
  const queue: MessageQueue = { messages: [], waiters: [] };
  messageQueues.set(ws, queue);
  ws.on('message', (data) => {
    const envelope = parseEnvelope(data.toString('utf8'));
    const waiter = queue.waiters.shift();
    if (waiter) {
      clearTimeout(waiter.timer);
      waiter.resolve(envelope);
    } else {
      queue.messages.push(envelope);
    }
  });
  return queue;
}

function nextEnvelope(ws: WebSocket, timeoutMs = 3000, label = 'unbekannt'): Promise<ParsedEnvelope> {
  const queue = messageQueue(ws);
  if (queue.messages.length > 0) return Promise.resolve(queue.messages.shift() ?? null);
  return new Promise((resolve, reject) => {
    const waiter: MessageWaiter = {
      resolve,
      reject,
      timer: setTimeout(() => {
        const index = queue.waiters.indexOf(waiter);
        if (index >= 0) queue.waiters.splice(index, 1);
        reject(new Error('keine Nachricht empfangen: ' + label));
      }, timeoutMs),
    };
    queue.waiters.push(waiter);
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
    const codeRes = await post(port, '/v1/control/pairing-code', { userId: TEST_USER_ID }, ADMIN_HEADERS);
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


    const foreignDevices = await get(port, '/v1/control/devices?userId=' + OTHER_USER_ID, ADMIN_HEADERS);
    assert.equal(foreignDevices.status, 200);
    assert.deepEqual(foreignDevices.body.devices, []);
    const foreignAction = await post(port, '/v1/control/action', { userId: OTHER_USER_ID, deviceId, toolId: 'programme.liste' }, ADMIN_HEADERS);
    assert.equal(foreignAction.status, 404);

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
    ws.send(
      JSON.stringify(
        createEnvelope(MessageTypes.Hello, {
          deviceId,
          platform: 'windows',
          agentVersion: '0.3.0-phase3',
        }),
      ),
    );
    const welcome = await nextEnvelope(ws, 3000, "welcome");
    assert.equal(welcome?.type, 'welcome');
    const welcomePayload = JSON.parse(welcome?.payloadJson ?? '{}') as Record<string, unknown>;
    assert.deepEqual(welcomePayload.permissions, allPermissions({}));

    // Aktion vor Freigabe: Routing verweigert (keine Berechtigungsspiegel gesetzt)
    const rejected = await post(port, '/v1/control/action', { userId: TEST_USER_ID, deviceId, toolId: 'programme.liste' }, ADMIN_HEADERS);
    assert.equal(rejected.status, 409);
    assert.equal(rejected.body.reason, 'berechtigung-fehlt');

    // Freigabe setzen -> welcome-Auffrischung
    const permRes = await post(
      port,
      '/v1/control/permissions',
      { userId: TEST_USER_ID, deviceId, permissions: allPermissions({ programme: 'steuern' }) },
      ADMIN_HEADERS,
    );
    assert.equal(permRes.status, 200);
    const refreshed = await nextEnvelope(ws, 3000, "permission-refresh-program");
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
      { userId: TEST_USER_ID, deviceId, toolId: 'programme.liste', args: {} },
      ADMIN_HEADERS,
    );
    const requestEnv = await nextEnvelope(ws, 3000, "action-request-program");
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
    const beat = await nextEnvelope(ws, 3000, "heartbeat-reply");
    assert.equal(beat?.type, 'heartbeat');

    // Kritisch: ohne Besttigung abgelehnt
    await post(
      port,
      '/v1/control/permissions',
      { userId: TEST_USER_ID, deviceId, permissions: allPermissions({ einstellungen: 'kritisch' }) },
      ADMIN_HEADERS,
    );
    await nextEnvelope(ws, 3000, "permission-refresh-shutdown");
    const critDenied = await post(
      port,
      '/v1/control/action',
      { userId: TEST_USER_ID, deviceId, toolId: 'einstellungen.herunterfahren' },
      ADMIN_HEADERS,
    );
    assert.equal(critDenied.status, 409);
    assert.equal(critDenied.body.reason, 'bestaetigung-erforderlich');

    // Kritisch mit Besttigung: Agent antwortet bestaetigung-erforderlich -> wird durchgereicht
    const critPromise = post(
      port,
      '/v1/control/action',
      { userId: TEST_USER_ID, deviceId, toolId: 'einstellungen.herunterfahren', confirmation: true },
      ADMIN_HEADERS,
    );
    const critEnv = await nextEnvelope(ws, 3000, "action-request-shutdown");
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
    const screenDenied = await post(port, '/v1/control/screen', { userId: TEST_USER_ID, deviceId, aktiv: true }, ADMIN_HEADERS);
    assert.equal(screenDenied.status, 409);
    assert.equal(screenDenied.body.reason, 'berechtigung-fehlt');

    // Bildschirm-Sitzung mit Freigabe: Frames flieen
    await post(
      port,
      '/v1/control/permissions',
      { userId: TEST_USER_ID, deviceId, permissions: allPermissions({ bildschirm: 'steuern' }) },
      ADMIN_HEADERS,
    );
    await nextEnvelope(ws, 3000, "permission-refresh-screen");
    let capturedFrame: string | null = null;
    let capturedSession: string | null = null;
    gateway.onScreenFrame = (frameDevice, frameSession, frameBase64) => {
      capturedSession = frameDevice + ':' + frameSession;
      capturedFrame = frameBase64;
    };
    const screenStart = await post(port, '/v1/control/screen', { userId: TEST_USER_ID, deviceId, aktiv: true }, ADMIN_HEADERS);
    assert.equal(screenStart.status, 200);
    const sessionEnv = await nextEnvelope(ws, 3000, "screen-session-start");
    assert.equal(sessionEnv?.type, 'screen.session.start');
    const sessionPayload = JSON.parse(sessionEnv?.payloadJson ?? '{}') as Record<string, unknown>;
    ws.send(
      JSON.stringify(
        createEnvelope(MessageTypes.ScreenFrame, {
          sessionId: 'stale-session',
          frameBase64: 'aGVsbG8=',
        }),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(capturedFrame, null);
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

    // Live-Frame kann nur vom Geräteinhaber und nur während der aktiven Sitzung abgerufen werden.
    const liveFrame = await get(
      port,
      '/v1/control/screen-frame?deviceId=' + deviceId + '&userId=' + TEST_USER_ID,
      ADMIN_HEADERS,
    );
    assert.equal(liveFrame.status, 200);
    assert.equal(liveFrame.body.active, true);
    assert.equal(liveFrame.body.sessionId, sessionPayload.sessionId);
    assert.equal(liveFrame.body.frameBase64, 'aGVsbG8=');
    const foreignFrame = await get(
      port,
      '/v1/control/screen-frame?deviceId=' + deviceId + '&userId=' + OTHER_USER_ID,
      ADMIN_HEADERS,
    );
    assert.equal(foreignFrame.status, 404);

    // Eine entzogene Bildschirmberechtigung beendet die Freigabe sofort.
    const downgrade = await post(
      port,
      '/v1/control/permissions',
      { userId: TEST_USER_ID, deviceId, permissions: allPermissions({ bildschirm: 'lesen' }) },
      ADMIN_HEADERS,
    );
    assert.equal(downgrade.status, 200);
    const permissionStop = await nextEnvelope(ws, 3000, "screen-permission-stop");
    assert.equal(permissionStop?.type, 'screen.session.stop');
    await nextEnvelope(ws, 3000, "screen-permission-refresh");
    const blockedAfterDowngrade = await get(
      port,
      '/v1/control/screen-frame?deviceId=' + deviceId + '&userId=' + TEST_USER_ID,
      ADMIN_HEADERS,
    );
    assert.equal(blockedAfterDowngrade.body.active, false);

    // Für den Not-Aus-Test wird die Freigabe erneut erteilt und eine neue Sitzung gestartet.
    await post(
      port,
      '/v1/control/permissions',
      { userId: TEST_USER_ID, deviceId, permissions: allPermissions({ bildschirm: 'steuern' }) },
      ADMIN_HEADERS,
    );
    await nextEnvelope(ws, 3000, "screen-permission-regrant");
    const secondScreenStart = await post(
      port,
      '/v1/control/screen',
      { userId: TEST_USER_ID, deviceId, aktiv: true },
      ADMIN_HEADERS,
    );
    assert.equal(secondScreenStart.status, 200);
    await nextEnvelope(ws, 3000, "screen-session-restart");

    // Not-Aus: Routing pausiert, Gert wird informiert
    const notaus = await post(port, '/v1/control/not-aus?userId=' + TEST_USER_ID, { userId: TEST_USER_ID, aktiv: true, grund: 'prfung' }, ADMIN_HEADERS);
    assert.equal(notaus.status, 200);
    const screenStopEnv = await nextEnvelope(ws, 3000, "screen-session-stop");
    assert.equal(screenStopEnv?.type, 'screen.session.stop');
    const stoppedFrame = await get(
      port,
      '/v1/control/screen-frame?deviceId=' + deviceId + '&userId=' + TEST_USER_ID,
      ADMIN_HEADERS,
    );
    assert.equal(stoppedFrame.status, 200);
    assert.equal(stoppedFrame.body.active, false);
    assert.equal(stoppedFrame.body.frameBase64, null);
    const notausEnv = await nextEnvelope(ws, 3000, "not-aus");
    assert.equal(notausEnv?.type, 'not-aus');
    const blockedDuringNotAus = await post(
      port,
      '/v1/control/action',
      { userId: TEST_USER_ID, deviceId, toolId: 'programme.liste' },
      ADMIN_HEADERS,
    );
    assert.equal(blockedDuringNotAus.status, 409);
    assert.equal(blockedDuringNotAus.body.reason, 'not-aus-aktiv');
    assert.equal(gateway.emergencyStop, true);

    await post(port, '/v1/control/not-aus', { userId: TEST_USER_ID, aktiv: false }, ADMIN_HEADERS);
    assert.equal(gateway.emergencyStop, false);

    // Widerruf: revoke-Nachricht + Close-Code 4403
    const revoke = await post(port, '/v1/control/revoke', { userId: TEST_USER_ID, deviceId, grund: 'test' }, ADMIN_HEADERS);
    assert.equal(revoke.status, 200);
    const revokeEnv = await nextEnvelope(ws, 3000, "revoke");
    assert.equal(revokeEnv?.type, 'revoke');
    const closeCode = await new Promise<number>((resolve) => {
      ws.once('close', (code) => resolve(code));
    });
    assert.equal(closeCode, 4403);
    assert.notEqual(store.getDevice(deviceId)?.revokedAt, null);

    // Protokoll führt alles mit (minimiert, ohne Inhalte)
    const log = await get(port, '/v1/control/action-log?limit=50&userId=' + TEST_USER_ID, ADMIN_HEADERS);
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
