


import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeAction,
  defaultPermissions,
  validatePermissionMap,
  policyForTool,
  CAPABILITIES,
} from '../src/policy.js';

test('Standard: jede Funktionsgruppe auf keine', () => {
  const permissions = defaultPermissions();
  for (const capability of CAPABILITIES) {
    assert.equal(permissions[capability], 'keine');
  }
});

test('Unbekannte Werkzeuge werden nie geroutet', () => {
  const result = authorizeAction({ toolId: 'shell.exec', permissions: { status: 'kritisch' } });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'tool-unbekannt');
  assert.equal(policyForTool(''), null);
  assert.equal(policyForTool(undefined), null);
});

test('Aktivität setzt mindestens lesen voraus', () => {
  const denied = authorizeAction({ toolId: 'status.info', permissions: { status: 'keine' } });
  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, 'berechtigung-fehlt');
  assert.equal(denied.requiredLevel, 'lesen');
  const allowed = authorizeAction({ toolId: 'status.info', permissions: { status: 'lesen' } });
  assert.equal(allowed.allowed, true);
});

test('steuern-Tools brauchen steuern oder höher', () => {
  assert.equal(authorizeAction({ toolId: 'programme.starten', permissions: { programme: 'lesen' } }).allowed, false);
  assert.equal(authorizeAction({ toolId: 'programme.starten', permissions: { programme: 'steuern' } }).allowed, true);
  assert.equal(authorizeAction({ toolId: 'eingabe.maus', permissions: { eingaben: 'kritisch' } }).allowed, true);
});

test('kritisch nur nach Bestätigung', () => {
  const without = authorizeAction({
    toolId: 'einstellungen.herunterfahren',
    permissions: { einstellungen: 'kritisch' },
  });
  assert.equal(without.allowed, false);
  assert.equal(without.reason, 'bestaetigung-erforderlich');
  const withConfirmation = authorizeAction({
    toolId: 'einstellungen.herunterfahren',
    permissions: { einstellungen: 'kritisch' },
    confirmationGranted: true,
  });
  assert.equal(withConfirmation.allowed, true);
});

test('stufen-fremde Stufen führen zur Ablehnung', () => {
  const result = authorizeAction({ toolId: 'programme.liste', permissions: { programme: 'irgendwas' as never } });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'berechtigungs-unbekannt');
});

test('Berechtigungs-Spiegel wird vollständig validiert', () => {
  const full = {
    status: 'lesen',
    programme: 'steuern',
    fenster: 'keine',
    eingaben: 'keine',
    bildschirm: 'steuern',
    dateien: 'lesen',
    einstellungen: 'kritisch',
    audio: 'keine',
  };
  assert.ok(validatePermissionMap(full) !== null);
  const missing = { ...full } as Record<string, string>;
  delete missing.audio;
  assert.equal(validatePermissionMap(missing), null);
  assert.equal(validatePermissionMap({ ...full, unbekannt: 'lesen' }), null);
  assert.equal(validatePermissionMap({ ...full, status: 'alles' }), null);
  assert.equal(validatePermissionMap('keine'), null);
});


test('action payload carries explicit critical-action confirmation', async () => {
  const { buildActionRequestPayload } = await import('../src/policy.js');
  assert.equal(buildActionRequestPayload('r1', 'einstellungen.herunterfahren', {}, true).confirmationGranted, true);
  assert.equal(buildActionRequestPayload('r2', 'einstellungen.herunterfahren', {}).confirmationGranted, false);
});
