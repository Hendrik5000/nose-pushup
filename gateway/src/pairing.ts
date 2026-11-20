
import { randomInt, timingSafeEqual } from 'node:crypto';

export type PairingCodeRecord = {
  code: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
};

export type PairingAttempt =
  | { ok: true }
  | { ok: false; reason: 'ungueltig' | 'abgelaufen' | 'bereits-verwendet' };

/** 6-stelliger Einmalcode mit TTL (Spezifikation: 5 Minuten). */
export function generatePairingCode(now: Date = new Date(), ttlMs: number = 5 * 60_000): PairingCodeRecord {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const createdAt = now.getTime();
  return {
    code,
    createdAt: new Date(createdAt).toISOString(),
    expiresAt: new Date(createdAt + ttlMs).toISOString(),
    usedAt: null,
  };
}

function stringsEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function checkPairingCode(
  record: PairingCodeRecord,
  code: unknown,
  now: Date = new Date(),
): PairingAttempt {
  if (typeof code !== 'string' || code.trim() === '') {
    return { ok: false, reason: 'ungueltig' };
  }
  if (!stringsEqual(record.code, code.trim())) {
    return { ok: false, reason: 'ungueltig' };
  }
  if (record.usedAt !== null) {
    return { ok: false, reason: 'bereits-verwendet' };
  }
  if (new Date(record.expiresAt).getTime() <= now.getTime()) {
    return { ok: false, reason: 'abgelaufen' };
  }
  return { ok: true };
}

/**
 * Schema-Sperre gegen Code-Raten: zhä Fehlversuche pro Schlüssel (z. B. IP)
 * in einem Zeitfenster. Erfolge zhä nicht.
 */
export class PairingAttemptLimiter {
  private failures: Map<string, number[]> = new Map();

  constructor(
    private maxFailures: number,
    private windowMs: number,
  ) {}

  private prune(key: string, now: number): number[] {
    const list = this.failures.get(key) ?? [];
    const kept = list.filter((t) => now - t < this.windowMs);
    this.failures.set(key, kept);
    return kept;
  }

  registerFailure(key: string, now: number = Date.now()): void {
    const kept = this.prune(key, now);
    kept.push(now);
  }

  isBlocked(key: string, now: number = Date.now()): boolean {
    return this.prune(key, now).length >= this.maxFailures;
  }

  reset(key: string): void {
    this.failures.delete(key);
  }
}

/** Prfung des Kopplungs- Payloads (POST /v1/pair). */
export type PairingRequestBody = {
  code: string;
  deviceName: string;
  platform: string;
  publicKeySpki: string;
  agentVersion: string;
};

const PLATFORMS = new Set(['windows', 'android', 'ipad']);

export function validatePairingBody(value: unknown): PairingRequestBody | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.code !== 'string' || !/^[0-9]{6}$/.test(v.code)) return null;
  if (typeof v.deviceName !== 'string' || v.deviceName.trim().length < 1 || v.deviceName.trim().length > 100) {
    return null;
  }
  if (typeof v.platform !== 'string' || !PLATFORMS.has(v.platform)) return null;
  if (typeof v.publicKeySpki !== 'string' || v.publicKeySpki.length < 200 || v.publicKeySpki.length > 4000) {
    return null;
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(v.publicKeySpki)) return null;
  if (typeof v.agentVersion !== 'string' || v.agentVersion.length < 1 || v.agentVersion.length > 50) return null;
  return {
    code: v.code,
    deviceName: v.deviceName.trim(),
    platform: v.platform,
    publicKeySpki: v.publicKeySpki,
    agentVersion: v.agentVersion,
  };
}
