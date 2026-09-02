import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

/**
 * Zufalls-Matchmaking: sucht einen wartenden Gegner mit gleichem Modus,
 * sonst wird der Nutzer selbst in die Warteschlange gestellt.
 */
export const findMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const raw = (input ?? {}) as { mode?: string; duration_s?: number };
    const mode = normalizeMode(raw.mode);
    const defaults = modeDefaults(mode);
    return {
      mode,
      duration_s: Math.max(15, Math.min(600, Number(raw.duration_s ?? defaults.duration_s) | 0)),
    };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString();

    const { data: waiting } = await supabaseAdmin
      .from("battle_queue")
      .select("user_id, created_at")
      .eq("mode", data.mode)
      .eq("duration_s", data.duration_s)
      .is("battle_id", null)
      .neq("user_id", userId)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(1);

    const opponent = (waiting ?? [])[0] as { user_id: string } | undefined;

    if (opponent) {
      const defaults = modeDefaults(data.mode);
      const code = makeCode();
      const { data: battle, error } = await supabaseAdmin
        .from("battles")
        .insert({
          code,
          host_id: opponent.user_id,
          guest_id: userId,
          duration_s: data.duration_s,
          mode: data.mode,
          target_reps: defaults.target_reps,
          is_bot: false,
          status: "waiting",
        })
        .select("id")
        .maybeSingle();
      if (error || !battle) throw new Error(error?.message ?? "Match fehlgeschlagen");
      const battleId = (battle as { id: string }).id;
      await supabaseAdmin
        .from("battle_queue")
        .update({ battle_id: battleId })
        .eq("user_id", opponent.user_id);
      await supabaseAdmin.from("battle_queue").delete().eq("user_id", userId);
      return { matched: true as const, id: battleId };
    }

    await supabaseAdmin.from("battle_queue").upsert(
      {
        user_id: userId,
        mode: data.mode,
        duration_s: data.duration_s,
        battle_id: null,
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    return { matched: false as const, id: null };
  });

/** Warteschlange verlassen. */
export const leaveQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("battle_queue").delete().eq("user_id", context.userId);
    return { ok: true };
  });

export const joinBattle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const code = String((input as { code?: string })?.code ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9]{4,8}$/.test(code)) throw new Error("Ungültiger Code");
    return { code };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Code lookup runs server-side: waiting battles are not readable by non-participants.
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
        url: `/battle/${(battle as { id: string }).id}`
      });
    } catch (pushErr) {
      console.error("Push fail:", pushErr);
    }

    return { id: (battle as { id: string }).id };
  });

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
    const row = b as {
      host_id: string;
      guest_id: string | null;
      is_bot: boolean;
      duration_s: number;
      status: string;
    };
    if (row.host_id !== userId) throw new Error("Nur Host darf starten");
    if (row.status !== "waiting") throw new Error("Battle bereits gestartet");
    if (!row.is_bot && !row.guest_id) throw new Error("Warte auf Gegner");
    const now = new Date();
    const ends = new Date(now.getTime() + row.duration_s * 1000);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin
      .from("battles")
      .update({
        status: "active",
        started_at: now.toISOString(),
        ends_at: ends.toISOString(),
      })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });


export const finishBattle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const raw = (input ?? {}) as { id?: string; guest_count?: number };
    if (!raw.id) throw new Error("Battle-ID fehlt");
    return {
      id: String(raw.id),
      // Only used for bot battles where host reports the bot's simulated count.
      guest_count: Math.max(0, Math.min(9999, Number(raw.guest_count ?? 0) | 0)),
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: b } = await supabase
      .from("battles")
      .select("id, host_id, guest_id, status, host_count, guest_count, is_bot")
      .eq("id", data.id)
      .maybeSingle();
    if (!b) throw new Error("Battle nicht gefunden");
    const row = b as {
      id: string;
      host_id: string;
      guest_id: string | null;
      status: string;
      host_count: number;
      guest_count: number;
      is_bot: boolean;
    };
    if (row.status === "finished") {
      return { winner_id: null, host_count: row.host_count, guest_count: row.guest_count };
    }
    const isHost = row.host_id === userId;
    const isGuest = row.guest_id === userId;
    if (!isHost && !isGuest) throw new Error("Nicht dein Battle");

    // Authoritative counts come from the battle_reps ledger — clients cannot inflate them.
    const { data: reps, error: repsErr } = await supabase
      .from("battle_reps")
      .select("user_id, count")
      .eq("battle_id", row.id);
    if (repsErr) throw new Error(repsErr.message);

    let host_count = 0;
    let guest_count = 0;
    for (const r of (reps ?? []) as Array<{ user_id: string; count: number }>) {
      if (r.user_id === row.host_id) host_count += r.count;
      else if (row.guest_id && r.user_id === row.guest_id) guest_count += r.count;
    }
    // Bot battles have no guest user — trust the host-reported simulated bot count.
    if (row.is_bot && isHost) {
      guest_count = data.guest_count;
    }

    let winner_id: string | null = null;
    if (host_count > guest_count) winner_id = row.host_id;
    else if (guest_count > host_count) winner_id = row.guest_id;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin
      .from("battles")
      .update({
        status: "finished",
        host_count,
        guest_count,
        winner_id,
      })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);
    return { winner_id, host_count, guest_count };
  });

