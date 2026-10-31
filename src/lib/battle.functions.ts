import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Simple per-user join rate limit (codes are short; slow down guessing). */
const joinRateBuckets = new Map<string, number[]>();
const JOIN_RATE_WINDOW_MS = 60_000;
const JOIN_RATE_MAX = 8;

function checkJoinRateLimit(userId: string) {
  const now = Date.now();
  const prev = joinRateBuckets.get(userId) ?? [];
  const recent = prev.filter((t) => now - t < JOIN_RATE_WINDOW_MS);
  if (recent.length >= JOIN_RATE_MAX) {
    throw new Error("Zu viele Beitrittsversuche — bitte eine Minute warten.");
  }
  recent.push(now);
  joinRateBuckets.set(userId, recent);
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export const BATTLE_MODES = ["timed", "first_to", "sprint", "endurance"] as const;
export type BattleMode = (typeof BATTLE_MODES)[number];

/** Modus-Defaults: Dauer + Zielreps. */
export function modeDefaults(mode: BattleMode) {
  switch (mode) {
    case "first_to":
      return { duration_s: 180, target_reps: 30 };
    case "sprint":
      return { duration_s: 60, target_reps: 0 };
    case "endurance":
      return { duration_s: 300, target_reps: 0 };
    default:
      return { duration_s: 60, target_reps: 0 };
  }
}

function normalizeMode(value: unknown): BattleMode {
  const m = String(value ?? "timed") as BattleMode;
  return (BATTLE_MODES as readonly string[]).includes(m) ? m : "timed";
}

export const createBattle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const raw = (input ?? {}) as {
      duration_s?: number;
      is_bot?: boolean;
      mode?: string;
      target_reps?: number;
      rematch_of?: string;
    };
    const mode = normalizeMode(raw.mode);
    const defaults = modeDefaults(mode);
    return {
      duration_s: Math.max(15, Math.min(600, raw.duration_s ?? defaults.duration_s)),
      is_bot: !!raw.is_bot,
      mode,
      target_reps: Math.max(0, Math.min(500, Number(raw.target_reps ?? defaults.target_reps) | 0)),
      rematch_of: raw.rematch_of ? String(raw.rematch_of) : null,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeCode();
      const { data: row, error } = await supabase
        .from("battles")
        .insert({
          code,
          host_id: userId,
          duration_s: data.duration_s,
          is_bot: data.is_bot,
          mode: data.mode,
          target_reps: data.target_reps,
          rematch_of: data.rematch_of,
          status: "waiting",
        })
        .select("id, code")
        .maybeSingle();
      if (!error && row) return { id: row.id as string, code: row.code as string };
      if (error && !String(error.message).includes("duplicate")) throw new Error(error.message);
    }
    throw new Error("Konnte keinen freien Code erzeugen");
  });

export const joinBattle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const code = String((input as { code?: string })?.code ?? "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z0-9]{4,8}$/.test(code)) throw new Error("Ungültiger Code");
    return { code };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    checkJoinRateLimit(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: battle, error } = await supabaseAdmin
      .from("battles")
      .select("id, host_id, guest_id, status")
      .eq("code", data.code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!battle) throw new Error("Battle nicht gefunden");
    if ((battle as { host_id: string }).host_id === userId) {
      return { id: (battle as { id: string }).id };
    }
    if ((battle as { status: string }).status !== "waiting") {
      throw new Error("Battle nicht mehr verfügbar");
    }
    const { error: upErr } = await supabaseAdmin
      .from("battles")
      .update({ guest_id: userId })
      .eq("id", (battle as { id: string }).id)
      .eq("status", "waiting")
      .is("guest_id", null);
    if (upErr) throw new Error(upErr.message);
    try {
      const { sendPushNotification } = await import("./push-notifications.server");
      await sendPushNotification((battle as { host_id: string }).host_id, {
        title: "Gegner gefunden! ⚔️",
        body: "Jemand ist deinem Battle beigetreten. Starte jetzt!",
        url: `/battle/${(battle as { id: string }).id}`,
      });
    } catch (pushErr) {
      console.error("Push fail:", pushErr);
    }
    return { id: (battle as { id: string }).id };
  });

// NOTE: remaining battle handlers (startBattle, submitScore, etc.) restored from stable base in follow-up if truncated.
export const startBattle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const id = String((input as { id?: string })?.id ?? "");
    if (!id) throw new Error("Battle-ID fehlt");
    return { id };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: b, error } = await supabase
      .from("battles")
      .select("id, host_id, guest_id, is_bot, duration_s, status")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !b) throw new Error("Battle nicht gefunden");
    const row = b as { host_id: string; guest_id: string | null; is_bot: boolean; status: string };
    if (row.host_id !== userId) throw new Error("Nur der Host kann starten");
    if (row.status !== "waiting") throw new Error("Battle nicht im Wartezustand");
    if (!row.guest_id && !row.is_bot) throw new Error("Noch kein Gegner");
    const { error: upErr } = await supabase
      .from("battles")
      .update({ status: "active", started_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("status", "waiting");
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });
