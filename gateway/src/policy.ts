


/**
 * Berechtigungs-Mirror (Phase 4): Das Gateway spiegelt die pro Gerät und
 * Funktionsgruppe gesetzten Stufen (keine / lesen / steuern / kritisch) und
 * entscheidet über das Routing von Aktionen. Quellen: Spezifikation v1 und
 * Phase-1-Datenmodell (src/lib/mira-device-control.ts).
 */
export type PermissionLevel = 'keine' | 'lesen' | 'steuern' | 'kritisch';
export type Capability =
  | 'status'
  | 'programme'
  | 'fenster'
  | 'eingaben'
  | 'bildschirm'
  | 'dateien'
  | 'einstellungen'
  | 'audio';

export const CAPABILITIES: readonly Capability[] = [
  'status',
  'programme',
  'fenster',
  'eingaben',
  'bildschirm',
  'dateien',
  'einstellungen',
  'audio',
];

export const PERMISSION_LEVELS: readonly PermissionLevel[] = ['keine', 'lesen', 'steuern', 'kritisch'];

const LEVEL_RANK: Record<PermissionLevel, number> = {
  keine: 0,
  lesen: 1,
  steuern: 2,
  kritisch: 3,
};

export function normalizeLevel(value: unknown): PermissionLevel | null {
  if (typeof value !== 'string') return null;
  if (!(PERMISSION_LEVELS as readonly string[]).includes(value)) return null;
  return value as PermissionLevel;
}

export type Permissions = Record<Capability, PermissionLevel>;

export function defaultPermissions(): Permissions {
  const permissions = {} as Permissions;
  for (const capability of CAPABILITIES) {
    permissions[capability] = 'keine';
  }
  return permissions;
}

export type ToolPolicy = {
  capability: Capability;
  minimumLevel: PermissionLevel;
};

/**
 * Bekannte Werkzeuge des Agents (Phase 3). Alles Unbekannte wird nie geroutet;
 * der Agent leistet zusätzlich seine eigene Allowlist-Prüfung.
 */
export const TOOL_POLICIES: Record<string, ToolPolicy> = {
  'status.ping': { capability: 'status', minimumLevel: 'lesen' },
  'status.info': { capability: 'status', minimumLevel: 'lesen' },
  'programme.liste': { capability: 'programme', minimumLevel: 'lesen' },
  'programme.starten': { capability: 'programme', minimumLevel: 'steuern' },
  'programme.beenden': { capability: 'programme', minimumLevel: 'steuern' },
  'fenster.liste': { capability: 'fenster', minimumLevel: 'lesen' },
  'fenster.fokussieren': { capability: 'fenster', minimumLevel: 'steuern' },
  'fenster.minimieren': { capability: 'fenster', minimumLevel: 'steuern' },
  'fenster.maximieren': { capability: 'fenster', minimumLevel: 'steuern' },
  'eingabe.maus': { capability: 'eingaben', minimumLevel: 'steuern' },
  'eingabe.tastatur': { capability: 'eingaben', minimumLevel: 'steuern' },
  'dateien.auflisten': { capability: 'dateien', minimumLevel: 'lesen' },
  'dateien.lesen': { capability: 'dateien', minimumLevel: 'lesen' },
  'dateien.schreiben': { capability: 'dateien', minimumLevel: 'steuern' },
  'dateien.umbenennen': { capability: 'dateien', minimumLevel: 'steuern' },
  'dateien.verschieben': { capability: 'dateien', minimumLevel: 'steuern' },
  'einstellungen.oeffnen': { capability: 'einstellungen', minimumLevel: 'steuern' },
  'einstellungen.herunterfahren': { capability: 'einstellungen', minimumLevel: 'kritisch' },
  'einstellungen.abbrechen-herunterfahren': { capability: 'einstellungen', minimumLevel: 'steuern' },
  'audio.lautstaerke': { capability: 'audio', minimumLevel: 'steuern' },
  'audio.stummschalten': { capability: 'audio', minimumLevel: 'steuern' },
};

export function policyForTool(toolId: unknown): ToolPolicy | null {
  if (typeof toolId !== 'string' || toolId.length === 0 || toolId.length > 64) return null;
  const policy = TOOL_POLICIES[toolId];
  return policy ?? null;
}

export type AuthorizationInput = {
  toolId: string;
  permissions: Partial<Record<Capability, PermissionLevel>>;
  confirmationGranted?: boolean;
  hasActiveScreenSession?: boolean;
};

export type AuthorizationResult = {
  allowed: boolean;
  reason: string;
  requiredLevel?: PermissionLevel;
};

/**
 * Zentrale Routing-Entscheidung. Regeln (Spezifikation):
 * - Unbekanntes Werkzeug: nie routen.
 * - Aktivitt benötigt mindestens die Freigabe der Werkzeug-Gruppe.
 * - Kritische Aktionen nur mit ausdrücklicher Bestätigung aus der Mira-UI.
 * - Bildschirm-Aktionen nur in einer laufenden, explizit gestarteten Sitzung.
 */
export function authorizeAction(input: AuthorizationInput): AuthorizationResult {
  const policy = policyForTool(input.toolId);
  if (!policy) {
    return { allowed: false, reason: 'tool-unbekannt' };
  }
  const level = normalizeLevel(input.permissions[policy.capability]);
  if (level === null) {
    return { allowed: false, reason: 'berechtigungs-unbekannt' };
  }
  if (LEVEL_RANK[level] < LEVEL_RANK[policy.minimumLevel]) {
    return { allowed: false, reason: 'berechtigung-fehlt', requiredLevel: policy.minimumLevel };
  }
  if (policy.minimumLevel === 'kritisch' && input.confirmationGranted !== true) {
    return { allowed: false, reason: 'bestaetigung-erforderlich', requiredLevel: 'kritisch' };
  }
  if (policy.capability === 'bildschirm' && input.hasActiveScreenSession !== true) {
    return { allowed: false, reason: 'keine-bildschirm-sitzung', requiredLevel: policy.minimumLevel };
  }
  return { allowed: true, reason: 'ok' };
}

export function validatePermissionMap(value: unknown): Permissions | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const result = {} as Permissions;
  for (const capability of CAPABILITIES) {
    const level = normalizeLevel(v[capability]);
    if (level === null) return null;
    result[capability] = level;
  }
  const extra = Object.keys(v).filter((k) => !(CAPABILITIES as readonly string[]).includes(k));
  if (extra.length > 0) return null;
  return result;
}

/** Payload-Form für action.request (Gateway -> Agent). */
export type ActionRequestPayload = {
  requestId: string;
  toolId: string;
  args: Record<string, unknown>;
  confirmationGranted: boolean;
};

export function buildActionRequestPayload(
  requestId: string,
  toolId: string,
  args: unknown,
  confirmationGranted = false,
): ActionRequestPayload {
  const safeArgs = typeof args === 'object' && args !== null && !Array.isArray(args)
    ? args as Record<string, unknown>
    : {};
  return { requestId, toolId, args: safeArgs, confirmationGranted };
}
