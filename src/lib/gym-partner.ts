/** A set recorded by the current user. Partner set-level details are never returned. */
export interface GymSet {
  id: string;
  /** Present for flat history entries; omitted in the current-session snapshot. */
  sessionId?: string;
  exercise: string;
  reps: number;
  weightKg: number;
  createdAt: string;
}

export interface GymPerson {
  userId: string;
  alias: string;
  sharing: boolean;
  visitSharing: { counts: boolean; days: boolean };
  sets: GymSet[];
}

export interface GymPartner {
  alias: string;
  sharing: boolean;
  /** Present only when the partner has explicitly enabled sharing. */
  stats: { sets: number; reps: number; volumeKg: number } | null;
  visitSharing: { counts: boolean; days: boolean };
  visitStats: { weekDays: number; monthDays: number } | null;
  visitDays: string[] | null;
}

export interface GymSnapshot {
  id: string;
  status: "waiting" | "active";
  /** Returned only to the host while the invite remains usable. */
  inviteCode: string | null;
  inviteExpiresAt: string | null;
  own: GymPerson;
  partner: GymPartner | null;
}

interface RpcResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}
interface RpcClient {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<RpcResult<unknown>>;
}

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

export function normalizeGymAlias(alias: string): string {
  if (typeof alias !== "string") throw new Error("Alias muss Text sein");
  const value = alias.trim();
  if (value.length < 1 || value.length > 40 || hasControlCharacters(value)) {
    throw new Error("Alias muss 1–40 druckbare Zeichen enthalten");
  }
  return value;
}

export function normalizeGymInviteCode(code: string): string {
  const value = typeof code === "string" ? code.trim().toUpperCase() : "";
  if (!/^[0-9A-F]{12}$/.test(value)) throw new Error("Ungültiger Einladungscode");
  return value;
}

export function normalizeGymExercise(exercise: string): string {
  if (typeof exercise !== "string") throw new Error("Übung muss Text sein");
  const value = exercise.trim();
  if (value.length < 1 || value.length > 80 || hasControlCharacters(value)) {
    throw new Error("Übung muss 1–80 druckbare Zeichen enthalten");
  }
  return value;
}

function requireUuid(value: string, label: string): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new Error(`${label} ist ungültig`);
  }
  return value;
}

export function validateGymSetInput(reps: number, weightKg: number): void {
  if (!Number.isInteger(reps) || reps < 1 || reps > 1000) {
    throw new Error("Wiederholungen müssen eine ganze Zahl von 1 bis 1000 sein");
  }
  if (
    !Number.isFinite(weightKg) ||
    weightKg < 0 ||
    weightKg > 1000 ||
    Math.round(weightKg * 4) !== weightKg * 4
  ) {
    throw new Error("Gewicht muss 0–1000 kg in Schritten von 0,25 kg betragen");
  }
}

export function validateGymDay(day: string): string {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error("Datum muss im Format JJJJ-MM-TT angegeben werden");
  }
  const parsed = new Date(`${day}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== day ||
    day < "2000-01-01"
  ) {
    throw new Error("Ungültiger Trainingstag");
  }
  return day;
}

function localGymDay(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return validateGymDay(`${year}-${month}-${day}`);
}

async function callRpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  // Lazy import allows the pure domain validators to run in Node tests without
  // initializing the browser Supabase client or generated Database type.
  const { supabase } = await import("@/integrations/supabase/client");
  const rpcClient = supabase as unknown as RpcClient;
  const { data, error } = await rpcClient.rpc(name, args);
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      throw new Error(
        "Der Gym-Modus ist vorbereitet, aber die Datenbank-Erweiterung ist noch nicht eingerichtet.",
      );
    }
    const messages: Record<string, string> = {
      real_account_required: "Für den Gym-Modus ist ein registriertes Konto nötig.",
      active_session_exists:
        "Du hast bereits eine offene Einheit. Bitte aktualisieren oder zuerst beenden.",
      invite_unavailable: "Der Einladungscode ist abgelaufen, bereits verwendet oder ungültig.",
      host_cannot_join_own_session:
        "Du kannst deiner eigenen Einheit nicht als zweites Konto beitreten.",
      session_full: "Diese Einheit hat bereits zwei Teilnehmer.",
      session_set_limit: "Pro Person sind maximal 500 Sätze je Einheit möglich.",
      not_active_session_member:
        "Die Einheit ist noch nicht aktiv oder wurde bereits beendet. Bitte aktualisieren.",
      not_open_session_member: "Die Einheit wurde beendet oder gehört nicht zu deinem Konto.",
      not_session_member: "Du kannst nur deine eigenen Daten einer offenen Einheit ändern.",
    };
    throw new Error(messages[error.message] ?? error.message);
  }
  return data as T;
}

/** Read the caller's open session; null means no open gym session exists. */
export async function getGymSnapshot(): Promise<GymSnapshot | null> {
  return (
    (await callRpc<GymSnapshot | null>("gym_get_snapshot", { p_today: localGymDay() })) ?? null
  );
}

/** Create a host session and return its initial snapshot (including its invite code). */
export async function createGymSession(alias: string): Promise<GymSnapshot> {
  return callRpc<GymSnapshot>("gym_create_session", { p_alias: normalizeGymAlias(alias) });
}

/** Join the waiting host session identified by its expiring invite code. */
export async function joinGymSession(code: string, alias: string): Promise<GymSnapshot> {
  return callRpc<GymSnapshot>("gym_join_session", {
    p_code: normalizeGymInviteCode(code),
    p_alias: normalizeGymAlias(alias),
  });
}

/** Change this participant's independent, revocable aggregate-sharing consent. */
export async function setGymSharing(
  sessionId: string,
  share: boolean,
): Promise<GymSnapshot | null> {
  requireUuid(sessionId, "Sitzung");
  if (typeof share !== "boolean") throw new Error("Freigabe muss true oder false sein");
  await callRpc<null>("gym_set_sharing", { p_session_id: sessionId, p_share: share });
  return getGymSnapshot();
}

/** Record the caller's own set; sets are private and only aggregate totals may be shared. */
export async function addGymSet(
  sessionId: string,
  exercise: string,
  reps: number,
  weightKg: number,
): Promise<GymSet> {
  requireUuid(sessionId, "Sitzung");
  validateGymSetInput(reps, weightKg);
  return callRpc<GymSet>("gym_add_set", {
    p_session_id: sessionId,
    p_exercise: normalizeGymExercise(exercise),
    p_reps: reps,
    p_weight_kg: weightKg,
    p_visit_day: localGymDay(),
  });
}

/** Read private deduplicated attendance days in an inclusive range of at most 366 days. */
export async function getGymVisits(startDay: string, endDay: string): Promise<string[]> {
  const start = validateGymDay(startDay);
  const end = validateGymDay(endDay);
  if (end < start) throw new Error("Das Enddatum muss am oder nach dem Startdatum liegen");
  if (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`) > 365 * 86400000) {
    throw new Error("Es können höchstens 366 Besuchstage auf einmal geladen werden");
  }
  return (await callRpc<string[]>("gym_get_visits", { p_start: start, p_end: end })) ?? [];
}

/** Add or remove the caller's own private calendar attendance day. */
export async function setGymVisit(day: string, attended: boolean): Promise<void> {
  const validDay = validateGymDay(day);
  if (typeof attended !== "boolean") throw new Error("Besuchsstatus muss true oder false sein");
  await callRpc<null>("gym_set_visit", { p_day: validDay, p_attended: attended });
}

export async function setGymVisitSharing(
  sessionId: string,
  counts: boolean,
  days: boolean,
): Promise<void> {
  requireUuid(sessionId, "Sitzung");
  if (typeof counts !== "boolean" || typeof days !== "boolean")
    throw new Error("Freigaben müssen true oder false sein");
  await callRpc<null>("gym_set_visit_sharing", {
    p_session_id: sessionId,
    p_counts: counts,
    p_days: days,
  });
}

/** Delete only a set owned by the caller; past-session entries remain available for history. */
export async function deleteGymSet(sessionId: string, setId: string): Promise<void> {
  requireUuid(sessionId, "Sitzung");
  requireUuid(setId, "Set");
  await callRpc<null>("gym_delete_set", { p_session_id: sessionId, p_set_id: setId });
}

/** Close a session. The backend expires the invite and removes its active memberships. */
export async function closeGymSession(sessionId: string): Promise<void> {
  requireUuid(sessionId, "Sitzung");
  await callRpc<null>("gym_close_session", { p_session_id: sessionId });
}

/** Return the caller's own sets from closed sessions, newest first (max 500). */
export async function getGymHistory(): Promise<GymSet[]> {
  return (await callRpc<GymSet[]>("gym_get_history")) ?? [];
}
