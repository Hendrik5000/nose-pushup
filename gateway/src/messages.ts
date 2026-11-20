import { randomUUID } from 'node:crypto';

/**
 * Envelope-Format v1 fr Bridge/Agent, siehe docs/device-control-gateway-spec.md
 * und windows-agent/src/MiraDeviceAgent/Messages.cs. Das Payload ist als
 * JSON-*String* eingebettet (PayloadJson), genau wie im C#-Agent.
 */
export type Envelope = {
  version: number;
  id: string;
  type: string;
  at: string;
  payloadJson?: string;
};

export const MessageTypes = {
  Hello: 'hello',
  Welcome: 'welcome',
  Heartbeat: 'heartbeat',
  ActionRequest: 'action.request',
  ActionResult: 'action.result',
  ScreenSessionStart: 'screen.session.start',
  ScreenSessionStop: 'screen.session.stop',
  ScreenFrame: 'screen.frame',
  NotAus: 'not-aus',
  Revoke: 'revoke',
} as const;

export type MessageType = (typeof MessageTypes)[keyof typeof MessageTypes];

export function createEnvelope(type: string, payload?: unknown): Envelope {
  const envelope: Envelope = {
    version: 1,
    id: randomUUID(),
    type,
    at: new Date().toISOString(),
  };
  if (payload !== undefined) {
    envelope.payloadJson = JSON.stringify(payload);
  }
  return envelope;
}

type EnvelopeLike = {
  version?: unknown;
  id?: unknown;
  type?: unknown;
  at?: unknown;
  payloadJson?: unknown;
};

/** Parsen mit Strenge: falsche Formate ergeben null statt Exception. */
export function parseEnvelope(raw: string): Envelope | null {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof obj !== 'object' || obj === null) {
    return null;
  }
  const o = obj as EnvelopeLike;
  if (o.version !== 1) return null;
  if (typeof o.type !== 'string' || o.type.length === 0 || o.type.length > 64) return null;
  if (typeof o.id !== 'string' || o.id.length === 0 || o.id.length > 64) return null;
  if (typeof o.at !== 'string' || o.at.length === 0 || o.at.length > 64) return null;
  if (o.payloadJson !== undefined && o.payloadJson !== null && typeof o.payloadJson !== 'string') {
    return null;
  }
  const payloadJson = o.payloadJson === null ? undefined : o.payloadJson;
  if (payloadJson !== undefined && payloadJson.length > 2_000_000) return null;
  return { version: 1, id: o.id, type: o.type, at: o.at, payloadJson };
}

/** Payload-String auspacken und gegen eine Validierungsfunktion pruefen. */
export function parsePayload<T>(
  envelope: Envelope,
  validate: (value: unknown) => T | null,
): T | null {
  if (envelope.payloadJson === undefined) {
    return validate(undefined);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(envelope.payloadJson);
  } catch {
    return null;
  }
  return validate(parsed);
}

/** Payload-Form fr hello (Agent -> Gateway). */
export type HelloPayload = {
  deviceId: string;
  platform: string;
  agentVersion: string;
};

export function validateHelloPayload(value: unknown): HelloPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.deviceId !== 'string' || v.deviceId.length === 0 || v.deviceId.length > 64) return null;
  if (typeof v.platform !== 'string' || v.platform.length === 0 || v.platform.length > 50) return null;
  if (typeof v.agentVersion !== 'string' || v.agentVersion.length === 0 || v.agentVersion.length > 50) {
    return null;
  }
  return { deviceId: v.deviceId, platform: v.platform, agentVersion: v.agentVersion };
}

/** Payload-Form fr action.result (Agent -> Gateway). */
export type ActionResultPayload = {
  requestId: string;
  status: 'ok' | 'error' | 'bestaetigung-erforderlich' | 'nicht-implementiert';
  detail?: string;
};

export function validateActionResultPayload(value: unknown): ActionResultPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.requestId !== 'string' || v.requestId.length === 0 || v.requestId.length > 64) return null;
  const allowed = ['ok', 'error', 'bestaetigung-erforderlich', 'nicht-implementiert'];
  if (typeof v.status !== 'string' || !allowed.includes(v.status)) return null;
  if (v.detail !== undefined && v.detail !== null && typeof v.detail !== 'string') return null;
  if (typeof v.detail === 'string' && v.detail.length > 500) {
    // Minimierter Detailtext: hart kappen, damit keine Inhalte mitschleppen.
    return { requestId: v.requestId, status: v.status as ActionResultPayload['status'], detail: v.detail.slice(0, 500) };
  }
  return {
    requestId: v.requestId,
    status: v.status as ActionResultPayload['status'],
    detail: typeof v.detail === 'string' ? v.detail : undefined,
  };
}
