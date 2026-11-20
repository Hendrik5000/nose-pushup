

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PairingAttemptLimiter,
  checkPairingCode,
  generatePairingCode,
  validatePairingBody,
} from '../src/pairing.js';

test('Kopplungscode: genau 6 Ziffern, Ablauf nach 5 Minuten', () => {
  const now = new Date('2026-11-20T12:00:00Z');
  const record = generatePairingCode(now, 5 * 60_000);
  assert.match(record.code, /^[0-9]{6}$/);
  assert.equal(new Date(record.expiresAt).getTime() - now.getTime(), 5 * 60_000);
  assert.equal(record.usedAt, null);
});

test('checkPairingCode: richtig, falsch, abgelaufen, bereits verwendet', () => {
  const now = new Date('2026-11-20T12:00:00Z');
  const record = generatePairingCode(now, 5 * 60_000);
  assert.equal(checkPairingCode(record, record.code, now).ok, true);
  assert.deepEqual(checkPairingCode(record, '000000', now), { ok: false, reason: 'ungueltig' });
  assert.deepEqual(checkPairingCode(record, '00000', now), { ok: false, reason: 'ungueltig' });
  assert.deepEqual(checkPairingCode(record, '0000000', now), { ok: false, reason: 'ungueltig' });
  const expired = generatePairingCode(new Date(now.getTime() - 10 * 60_000), 5 * 60_000);
  assert.deepEqual(checkPairingCode(expired, expired.code, now), { ok: false, reason: 'abgelaufen' });
  const used = generatePairingCode(now, 5 * 60_000);
  used.usedAt = now.toISOString();
  assert.deepEqual(checkPairingCode(used, used.code, now), { ok: false, reason: 'bereits-verwendet' });
});

test('Versuch-Sperre blockiert nach zu vielen Fehlversuchen, Erfolg zählt nicht', () => {
  const limiter = new PairingAttemptLimiter(3, 60_000);
  const now = 1_000_000;
  assert.equal(limiter.isBlocked('ip', now), false);
  limiter.registerFailure('ip', now);
  limiter.registerFailure('ip', now);
  assert.equal(limiter.isBlocked('ip', now), false);
  limiter.registerFailure('ip', now);
  assert.equal(limiter.isBlocked('ip', now + 1000), true);
  assert.equal(limiter.isBlocked('_andere', now + 1000), false);
  assert.equal(limiter.isBlocked('ip', now + 61_000), false);
  limiter.reset('ip');
  assert.equal(limiter.isBlocked('ip', now + 62_000), false);
});

test('Kopplungs-Body-Validierung:', () => {
  assert.deepEqual(
    Object.keys(
      validatePairingBody({
        code: '123456',
        deviceName: 'Test-PC',
        platform: 'windows',
        publicKeySpki: 'A'.repeat(400),
        agentVersion: '0.2.0-phase2',
      }) ?? {},
    ).sort(),
    ['agentVersion', 'code', 'deviceName', 'platform', 'publicKeySpki'],
  );
  const valid = validatePairingBody({
    code: '123456',
    deviceName: 'Test-PC',
    platform: 'windows',
    publicKeySpki: 'A'.repeat(400),
    agentVersion: '0.2.0-phase2',
  });
  assert.ok(valid !== null);
  assert.equal(valid?.platform, 'windows');

  const base = {
    code: '123456',
    deviceName: 'Test-PC',
    platform: 'windows',
    publicKeySpki: 'A'.repeat(400),
    agentVersion: '0.2.0-phase2',
  };
  assert.equal(validatePairingBody({ ...base, code: '12345' }), null);
  assert.equal(validatePairingBody({ ...base, code: '12345a' }), null);
  assert.equal(validatePairingBody({ ...base, platform: 'linux' }), null);
  assert.equal(validatePairingBody({ ...base, publicKeySpki: 'A'.repeat(50) }), null);
  assert.equal(validatePairingBody({ ...base, publicKeySpki: 'x'.repeat(400) }), null);
  assert.equal(validatePairingBody({ ...base, deviceName: '  ' }), null);
  assert.equal(validatePairingBody(null), null);
});
