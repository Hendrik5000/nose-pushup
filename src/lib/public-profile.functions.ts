import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

export type PublicProfile = {
  display_name: string | null;
  avatar_url: string | null;
  level: number;
  xp: number;
  current_streak: number;
  longest_streak: number;
  best_count: number;
  battle_wins: number;
};

/**
 * Öffentliches Profil per Slug laden – ohne Anmeldung nutzbar.
 * Liest nur die vom Nutzer freigegebenen Felder über eine geprüfte DB-Funktion.
 */
export const getPublicProfile = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => ({ slug: String(input.slug).slice(0, 60) }))
  .handler(async ({ data }): Promise<PublicProfile | null> => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const url = process.env["SUPABASE_URL"]!;
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const rpc = client.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: PublicProfile[] | null; error: unknown }>;
    const { data: rows, error } = await rpc("public_profile", { _slug: data.slug });
    if (error || !rows || rows.length === 0) return null;
    return rows[0] ?? null;
  });
