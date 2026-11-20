

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GatewayStore, createTokenMaterial, hashToken, sanitizeDevice } from '../src/store.js';

function tempStore(actionLogMax = 1000): { store: GatewayStore; dir: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mira-store-'));
  return { store: new GatewayStore(path.join(dir, 'state.json'), { actionLogMax }), dir };
}

test('Token-Hash ist deterministisch und salzabhngig', () => {
  assert.equal(hashToken('t', 's'), hashToken('t', 's'));
  assert.notEqual(hashToken('t', 's1'), hashToken('t', 's2'));
  const material = createTokenMaterial();
  assert.equal(material.tokenHash, hashToken(material.token, material.salt));
});

test('Kopplungscode: erzeugen, finden, verbrauchen', () => {
  const { store, dir } = tempStore();
  try {
    const now = new Date('2026-11-20T12:00:00Z');
    const record = store.createPairingCode(now, 5 * 60_000);
    const check = store.checkPairing(record.code, now);
    assert.equal(check.reason, 'ok');
    store.markPairingUsed(record.code, now);
    const again = store.checkPairing(record.code, now);
    assert.equal(again.record, null);
    assert.equal(store.checkPairing('999999', now).reason, 'ungueltig');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Gerät koppeln, Token wiederfinden, widerrufen', () => {
  const { store, dir } = tempStore();
  try {
    const material = createTokenMaterial();
    const device = store.pairDevice({
      name: 'Hendriks PC',
      platform: 'windows',
      publicKeySpki: 'Q'.repeat(400),
      agentVersion: '0.2.0-phase2',
      salt: material.salt,
      tokenHash: material.tokenHash,
    });
    assert.ok(device.deviceId.length > 0);
    assert.match(device.fingerprint, /^[0-9a-f]{16}$/);
    assert.equal(store.getDeviceByToken(material.token)?.deviceId, device.deviceId);
    assert.equal(store.getDeviceByToken('falsch'), null);

    for (const capability of ['status', 'programme', 'fenster', 'eingaben', 'bildschirm', 'dateien', 'einstellungen', 'audio'] as const) {
      assert.equal(device.permissions[capability], 'keine');
    }

    store.setPermissions(device.deviceId, {
      status: 'lesen',
      programme: 'steuern',
      fenster: 'keine',
      eingaben: 'keine',
      bildschirm: 'steuern',
      dateien: 'keine',
      einstellungen: 'kritisch',
      audio: 'keine',
    });
    assert.equal(store.getDevice(device.deviceId)?.permissions.programme, 'steuern');

    assert.equal(store.revokeDevice(device.deviceId), true);
    assert.equal(store.getDeviceByToken(material.token), null);
    assert.notEqual(store.getDevice(device.deviceId)?.revokedAt, null);
    assert.equal(store.revokeDevice('unbekannt'), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Sanitisierte Geräteliste enthält keine Token-Geheimnisse', () => {
  const { store, dir } = tempStore();
  try {
    const material = createTokenMaterial();
    store.pairDevice({
      name: 'PC',
      platform: 'windows',
      publicKeySpki: 'Q'.repeat(400),
      agentVersion: '1',
      salt: material.salt,
      tokenHash: material.tokenHash,
    });
    const listed = store.listDevices();
    assert.equal(listed.length, 1);
    const raw = JSON.stringify(listed);
    assert.equal(raw.includes('tokenHash'), false);
    assert.equal(raw.includes('tokenSalt'), false);
    const sanitized = sanitizeDevice(store.listDevices()[0] as never) as Record<string, unknown>;
    assert.equal('tokenHash' in sanitized, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Protokoll wächst mit und wird auf maximal Gre gekappt', () => {
  const { store, dir } = tempStore(3);
  try {
    store.appendLog({ kind: 'kopplung', status: 'a' });
    store.appendLog({ kind: 'kopplung', status: 'b' });
    store.appendLog({ kind: 'kopplung', status: 'c' });
    store.appendLog({ kind: 'kopplung', status: 'd' });
    store.appendLog({ kind: 'kopplung', status: 'e' });
    assert.equal(store.getActionLog().length, 3);
    assert.deepEqual(
      store.getActionLog().map((entry) => entry.status),
      ['c', 'd', 'e'],
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Zustand überlebt Prozessgrenzen (Datei-Persistenz)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mira-store-'));
  const filePath = path.join(dir, 'state.json');
  try {
    const first = new GatewayStore(filePath);
    const material = createTokenMaterial();
    const device = first.pairDevice({
      name: 'PC',
      platform: 'windows',
      publicKeySpki: 'Q'.repeat(400),
      agentVersion: '1',
      salt: material.salt,
      tokenHash: material.tokenHash,
    });
    first.save();
    const second = new GatewayStore(filePath);
    assert.equal(second.getDeviceByToken(material.token)?.deviceId, device.deviceId);
    assert.equal(second.listDevices().length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
