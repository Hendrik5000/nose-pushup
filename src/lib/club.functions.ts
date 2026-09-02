import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** Club gründen: erzeugt Code, Club und Owner-Mitgliedschaft in einem Schritt. */
export const createClub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const raw = (input ?? {}) as { name?: string; motto?: string; color?: string; weekly_goal?: number };
    const name = String(raw.name ?? "").trim();
    if (name.length < 2 || name.length > 40) throw new Error("Name muss 2–40 Zeichen haben");
    return {
      name,
      motto: String(raw.motto ?? "").trim().slice(0, 120),
      color: /^#[0-9a-fA-F]{6}$/.test(String(raw.color ?? "")) ? String(raw.color) : "#38bdf8",
      weekly_goal: Math.max(100, Math.min(100000, Number(raw.weekly_goal ?? 1000) | 0)),
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeCode();
      const { data: club, error } = await supabase
        .from("clubs")
        .insert({ ...data, code, owner_id: userId })
        .select("id, code")
        .maybeSingle();
      if (error) {
        if (String(error.message).includes("duplicate")) continue;
        throw new Error(error.message);
      }
      if (!club) continue;
      const row = club as { id: string; code: string };
      const { error: memErr } = await supabase
        .from("club_members")
        .insert({ club_id: row.id, user_id: userId, role: "owner" });
      if (memErr) throw new Error(memErr.message);
      return row;
    }
    throw new Error("Konnte keinen freien Code erzeugen");
  });

/** Club per Einladungscode beitreten (Mitgliederlimit serverseitig geprüft). */
export const joinClubByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const code = String((input as { code?: string })?.code ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9]{4,8}$/.test(code)) throw new Error("Ungültiger Code");
    return { code };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: id, error } = await supabase.rpc("join_club_by_code" as never, {
      _code: data.code,
    } as never);
    if (error) throw new Error(error.message);
    return { id: id as unknown as string };
  });
