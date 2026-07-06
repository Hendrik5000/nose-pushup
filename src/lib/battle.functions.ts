import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export const createBattle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const raw = (input ?? {}) as { duration_s?: number; is_bot?: boolean };
    return {
      duration_s: Math.max(15, Math.min(300, raw.duration_s ?? 60)),
      is_bot: !!raw.is_bot,
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
          status: data.is_bot ? "waiting" : "waiting",
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
    const code = String((input as { code?: string })?.code ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9]{4,8}$/.test(code)) throw new Error("Ungültiger Code");
    return { code };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: battle, error } = await supabase
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
    const { error: upErr } = await supabase
      .from("battles")
      .update({ guest_id: userId })
      .eq("id", (battle as { id: string }).id)
      .is("guest_id", null);
    if (upErr) throw new Error(upErr.message);
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

    const { error: upErr } = await supabase
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
