import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEnvelope,
  parseEnvelope,
  parsePayload,
  validateHelloPayload,
  validateActionResultPayload,
  MessageTypes,
} from '../src/messages.js';

test('Envelope erzeugt Payload als eingebetteten JSON-String (wie C#-Agent)', () => {
  const envelope = createEnvelope(MessageTypes.Hello, {
    deviceId: 'dev-1',
    platform: 'windows',
    agentVersion: '0.2.0-phase2',
  });
  assert.equal(envelope.version, 1);
  assert.equal(envelope.type, 'hello');
  assert.ok(envelope.payloadJson);
  const payload = JSON.parse(envelope.payloadJson) as Record<string, unknown>;
  assert.equal(payload.deviceId, 'dev-1');
  assert.equal(payload.agentVersion, '0.2.0-phase2');
});

test('Envelope ohne Payload laesst payloadJson weg', () => {
  const envelope = createEnvelope(MessageTypes.Heartbeat);
  assert.equal(envelope.payloadJson, undefined);
  const parsed = parseEnvelope(JSON.stringify(envelope));
  assert.ok(parsed !== null);
  assert.equal(parsed?.type, 'heartbeat');
  assert.equal(parsed?.payloadJson, undefined);
});

test('Rundreise: eigener Envelope laesst sich exakt zurueckparsen', () => {
  const envelope = createEnvelope(MessageTypes.ActionRequest, { requestId: 'r1', toolId: 'status.ping', args: {} });
  const parsed = parseEnvelope(JSON.stringify(envelope));
  assert.ok(parsed !== null);
  assert.equal(parsed?.id, envelope.id);
  assert.equal(parsed?.at, envelope.at);
  assert.equal(parsed?.payloadJson, envelope.payloadJson);
});

test('Ungueltige Envelopes ergeben null statt Exception', () => {
  assert.equal(parseEnvelope('kein json'), null);
  assert.equal(parseEnvelope('{}'), null);
  assert.equal(parseEnvelope(JSON.stringify({ version: 2, id: 'x', type: 'hello', at: 'x' })), null);
  assert.equal(parseEnvelope(JSON.stringify({ version: 1, id: 'x', type: '', at: 'x' })), null);
  assert.equal(parseEnvelope(JSON.stringify({ version: 1, id: 'x' })), null);
  assert.equal(
    parseEnvelope(JSON.stringify({ version: 1, id: 'x', type: 'hello', at: 'x', payloadJson: { nicht: 'string' } })),
    null,
  );
});

test('Hello-Payload-Validierung verlangt die drei Felder', () => {
  assert.ok(validateHelloPayload({ deviceId: 'a', platform: 'windows', agentVersion: '1' }) !== null);
  assert.equal(validateHelloPayload({ deviceId: 'a', platform: 'windows' }), null);
  assert.equal(validateHelloPayload({ deviceId: 'a', platform: 'windows', agentVersion: 'x', extra: true }), null);
  assert.equal(validateHelloPayload(null), null);
  assert.equal(validateHelloPayload('text'), null);
});

test('ActionResult-Status ist auf die vier erlaubten Werte beschraenkt', () => {
  assert.ok(validateActionResultPayload({ requestId: 'r1', status: 'ok' }) !== null);
  assert.ok(
    validateActionResultPayload({ requestId: 'r1', status: 'bestaetigung-erforderlich', detail: 'kurz' }) !== null,
  );
  assert.ok(validateActionResultPayload({ requestId: 'r1', status: 'nicht-implementiert' }) !== null);
  assert.equal(validateActionResultPayload({ requestId: 'r1', status: 'irgendwas' }), null);
  assert.equal(validateActionResultPayload({ status: 'ok' }), null);
});

test('Detail-Texte werden hart gekappt (minimierte Inhalte)', () => {
  const result = validateActionResultPayload({ requestId: 'r1', status: 'error', detail: 'x'.repeat(900) });
  assert.ok(result !== null);
  assert.equal(result?.detail?.length, 500);
});

test('parsePayload gibt null bei kaputtem Payload-String', () => {
  const envelope = createEnvelope(MessageTypes.Hello);
  envelope.payloadJson = 'kein json';
  assert.equal(parsePayload(envelope, validateHelloPayload), null);
});
