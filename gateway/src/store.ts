
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { generatePairingCode, type PairingCodeRecord } from './pairing.js';
import { defaultPermissions, type Permissions } from './policy.js';

export type DeviceRecord = {
  deviceId: string;
  name: string;
  platform: string;
  publicKeySpki: string;
  fingerprint: string;
  agentVersion: string;
  tokenHash: string;
  tokenSalt: string;
  createdAt: string;
  revokedAt: string | null;
  permissions: Permissions;
};

export type ActionLogKind =
  | 'aktion'
  | 'kopplung'
  | 'widerruf'
  | 'not-aus'
  | 'sitzung'
  | 'ablehnung'
  | 'verbindung';

export type ActionLogEntry = {
  at: string;
  kind: ActionLogKind;
  deviceId?: string;
  toolId?: string;
  status?: string;
  detail?: string;
};

export type GatewayData = {
  version: 1;
  devices: DeviceRecord[];
  pairingCodes: PairingCodeRecord[];
  actionLog: ActionLogEntry[];
};

/** Token wird nur als SHA-256-Hash mit Salt gespeichert, nie im Klartext. */
export function hashToken(token: string, salt: string): string {
  return createHash('sha256').update(salt + ':' + token).digest('hex');
}

export type TokenMaterial = { token: string; salt: string; tokenHash: string };

export function createTokenMaterial(): TokenMaterial {
  const token = randomBytesBase64Url(32);
  const salt = randomBytesHex(16);
  return { token, salt, tokenHash: hashToken(token, salt) };
}

function randomBytesBase64Url(size: number): string {
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  return bufferToBase64Url(bytes);
}

function bufferToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomBytesHex(size: number): string {
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

export type SanitizedDevice = Omit<DeviceRecord, 'tokenHash' | 'tokenSalt'>;

export function sanitizeDevice(device: DeviceRecord): SanitizedDevice {
  return {
    deviceId: device.deviceId,
    name: device.name,
    platform: device.platform,
    publicKeySpki: device.publicKeySpki,
    fingerprint: device.fingerprint,
    agentVersion: device.agentVersion,
    createdAt: device.createdAt,
    revokedAt: device.revokedAt,
    permissions: device.permissions,
  };
}

export type StoreOptions = { actionLogMax?: number };

/**
 * Dateibasierte persistenter Speicher des Gateways. Bewusst kein Anteil an der
 * Supabase-Datenbank des Repos (dort gilt weiterhin Einfrieren von
 * Datenbankaenderungen). Zustand: Geräte, Kopplungscodes, minimiertes Protokoll.
 */
export class GatewayStore {
  private data: GatewayData;
  private readonly actionLogMax: number;

  constructor(
    private readonly filePath: string,
    options: StoreOptions = {},
  ) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.actionLogMax = options.actionLogMax ?? 1000;
    this.data = this.load();
  }

  private load(): GatewayData {
    const fallback: GatewayData = { version: 1, devices: [], pairingCodes: [], actionLog: [] };
    if (!fs.existsSync(this.filePath)) return fallback;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Partial<GatewayData>;
      return {
        version: 1,
        devices: Array.isArray(parsed.devices) ? parsed.devices : [],
        pairingCodes: Array.isArray(parsed.pairingCodes)
          ? parsed.pairingCodes.filter((c) => typeof c.code === 'string')
          : [],
        actionLog: Array.isArray(parsed.actionLog) ? parsed.actionLog.slice(-this.actionLogMax) : [],
      };
    } catch {
      // Kaputten Zustand nicht weiterschleppen: mit leerem Zustand neu starten.
      return fallback;
    }
  }

  save(): void {
    const tmp = this.filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(tmp, this.filePath);
  }

  getDevice(deviceId: string): DeviceRecord | null {
    return this.data.devices.find((d) => d.deviceId === deviceId) ?? null;
  }

  /** Findet ein nicht widerrufenes Gerät anhand des Klartext-Tokens (timing-sicher). */
  getDeviceByToken(token: string): DeviceRecord | null {
    for (const device of this.data.devices) {
      if (device.revokedAt !== null) continue;
      const expected = Buffer.from(device.tokenHash, 'hex');
      const actual = Buffer.from(hashToken(token, device.tokenSalt), 'hex');
      if (expected.length === actual.length && timingSafeEqual(expected, actual)) {
        return device;
      }
    }
    return null;
  }

  createPairingCode(now: Date = new Date(), ttlMs: number = 5 * 60_000): PairingCodeRecord {
    this.data.pairingCodes = this.data.pairingCodes.filter(
      (c) => c.usedAt === null && new Date(c.expiresAt).getTime() > now.getTime(),
    );
    const record = generatePairingCode(now, ttlMs);
    this.data.pairingCodes.push(record);
    this.save();
    return record;
  }

  /**
   * Prft einen Code ohne ihn zu verbrauchen; Grund frs Protokoll.
   * Abgelaufene codes zhä als abgelaufen, alles andere als ungueltig.
   */
  checkPairing(codeInput: unknown, now: Date = new Date()): { record: PairingCodeRecord | null; reason: string } {
    for (const candidate of this.data.pairingCodes) {
      if (candidate.usedAt !== null) continue;
      if (candidate.code === codeInput) {
        if (new Date(candidate.expiresAt).getTime() <= now.getTime()) {
          return { record: null, reason: 'abgelaufen' };
        }
        return { record: candidate, reason: 'ok' };
      }
    }
    return { record: null, reason: 'ungueltig' };
  }

  markPairingUsed(code: string, now: Date = new Date()): void {
    const record = this.data.pairingCodes.find((c) => c.code === code);
    if (!record) return;
    record.usedAt = now.toISOString();
    this.save();
  }

  pairDevice(
    input: {
      name: string;
      platform: string;
      publicKeySpki: string;
      agentVersion: string;
      salt: string;
      tokenHash: string;
    },
    now: Date = new Date(),
  ): DeviceRecord {
    const fingerprint = createHash('sha256').update(input.publicKeySpki, 'utf8').digest('hex').slice(0, 16);
    const device: DeviceRecord = {
      deviceId: randomUUID(),
      name: input.name,
      platform: input.platform,
      publicKeySpki: input.publicKeySpki,
      fingerprint,
      agentVersion: input.agentVersion,
      tokenHash: input.tokenHash,
      tokenSalt: input.salt,
      createdAt: now.toISOString(),
      revokedAt: null,
      permissions: defaultPermissions(),
    };
    this.data.devices.push(device);
    this.save();
    return device;
  }

  setPermissions(deviceId: string, permissions: Permissions): DeviceRecord | null {
    const device = this.getDevice(deviceId);
    if (!device) return null;
    device.permissions = permissions;
    this.save();
    return device;
  }

  revokeDevice(deviceId: string, now: Date = new Date()): boolean {
    const device = this.getDevice(deviceId);
    if (!device) return false;
    device.revokedAt = now.toISOString();
    this.save();
    return true;
  }

  listDevices(): SanitizedDevice[] {
    return this.data.devices.map(sanitizeDevice);
  }

  appendLog(entry: Omit<ActionLogEntry, 'at'> & { at?: string }): void {
    this.data.actionLog.push({ at: entry.at ?? new Date().toISOString(), ...entry });
    if (this.data.actionLog.length > this.actionLogMax) {
      this.data.actionLog = this.data.actionLog.slice(-this.actionLogMax);
    }
    this.save();
  }

  getActionLog(limit: number = 100): ActionLogEntry[] {
    return this.data.actionLog.slice(-limit);
  }

  getActionLogMax(): number {
    return this.actionLogMax;
  }
}
