import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

async function makeCode() {
  const { generateInvitationCode } = await import("./invitation-codes.server");
  return generateInvitationCode();
}

export const BATTLE_MODES = ["timed", "first_to", "sprint", "endurance"] as const;
export type BattleMode = (typeof BATTLE_MODES)[number];

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
      const code = await makeCode();
      const { data: row, error } = await supabase
        .from("battles")
        .insert({
          code,
          host_id: userId,
          is_public: false,
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

export const findMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const raw = (input ?? {}) as { duration_s?: number; mode?: string; target_reps?: number };
    const mode = normalizeMode(raw.mode);
    const defaults = modeDefaults(mode);
    return {
      duration_s: Math.max(15, Math.min(600, raw.duration_s ?? defaults.duration_s)),
      mode,
      target_reps: Math.max(0, Math.min(500, Number(raw.target_reps ?? defaults.target_reps) | 0)),
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: matches, error: matchError } = await supabase.rpc("claim_public_battle", {
      _mode: data.mode,
      _duration_s: data.duration_s,
    });
    if (matchError) throw new Error(matchError.message);
    const waiting = (matches as unknown as Array<{ id: string; code: string }> | null)?.[0];
    if (waiting) {
      return { id: waiting.id, code: waiting.code, matched: true };
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = await makeCode();
      const { data: row, error } = await supabase
        .from("battles")
        .insert({
          code,
          host_id: userId,
          is_public: true,
          duration_s: data.duration_s,
          is_bot: false,
          mode: data.mode,
          target_reps: data.target_reps,
          status: "waiting",
        })
        .select("id, code")
        .maybeSingle();
      if (!error && row) return { id: row.id as string, code: row.code as string, matched: false };
      if (error && !String(error.message).includes("duplicate")) throw new Error(error.message);
    }
    throw new Error("Matchmaking fehlgeschlagen");
  });

export const leaveQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const id = String((input as { id?: string })?.id ?? "");
    if (!id) throw new Error("Battle-ID fehlt");
    return { id };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("battles")
      .delete()
      .eq("id", data.id)
      .eq("host_id", userId)
      .eq("status", "waiting")
      .is("guest_id", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const joinBattle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const code = String((input as { code?: string })?.code ?? "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z0-9]{4,16}$/.test(code)) throw new Error("Ungültiger Code");
    return { code };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    checkJoinRateLimit(userId);
    const { data: rows, error } = await supabase.rpc("join_battle_by_code", {
      _code: data.code,
    });
    if (error) throw new Error(error.message);
    const result = rows?.[0];
    if (!result?.success || !result.joined_id) {
      const message =
        result?.error_code === "not_found"
          ? "Battle nicht gefunden"
          : result?.error_code === "unavailable"
            ? "Battle nicht mehr verfügbar"
            : "Ungültiger Code";
      throw new Error(message);
    }
    const id = result.joined_id;
    const { data: battle } = await supabase
      .from("battles")
      .select("host_id")
      .eq("id", id)
      .maybeSingle();
    if (battle && battle.host_id !== userId) {
      try {
        const { sendPushNotification } = await import("./push-notifications.server");
        await sendPushNotification(battle.host_id, {
          title: "Gegner gefunden! ⚔️",
          body: "Jemand ist deinem Battle beigetreten. Starte jetzt!",
          url: `/battle/${id}`,
        });
      } catch (pushErr) {
        console.error("Push fail:", pushErr);
      }
    }
    return { id };
  });

export const startBattle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const id = String((input as { id?: string })?.id ?? "");
    if (!id) throw new Error("Battle-ID fehlt");
    return { id };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("start_battle", { _battle_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const finishBattle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const raw = (input ?? {}) as { id?: string; guest_count?: number };
    const id = String(raw.id ?? "");
    if (!id) throw new Error("Battle-ID fehlt");
    return {
      id,
      guest_count: Math.max(0, Math.min(10000, Number(raw.guest_count) | 0)),
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.rpc("finish_battle", {
      _battle_id: data.id,
      _guest_count: data.guest_count,
    });
    if (error) throw new Error(error.message);
    const result = rows?.[0];
    if (!result) throw new Error("Battle nicht gefunden");
    return {
      winner_id: result.winner_id,
      host_count: result.host_count,
      guest_count: result.guest_count,
    };
  });

// Battle state transitions are enforced by authenticated database RPCs.
