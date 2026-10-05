import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Schalter für das öffentliche Profil + Einladungslink. */
export function PublicProfileSettings() {
  const [userId, setUserId] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUserId(u.user.id);
      const { data } = await supabase
        .from("profiles")
        .select("public_slug, public_enabled, display_name")
        .eq("id", u.user.id)
        .maybeSingle();
      const row = data as { public_slug: string | null; public_enabled: boolean; display_name: string | null } | null;
      setEnabled(row?.public_enabled ?? false);
      setSlug(
        row?.public_slug ??
          (row?.display_name ?? "athlet").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24) +
            "-" +
            u.user.id.slice(0, 4),
      );
    })();
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const profileUrl = `${origin}/u/${slug}`;
  const inviteUrl = `${origin}/auth?ref=${encodeURIComponent(slug)}`;

  const save = async (nextEnabled: boolean) => {
    if (!userId) return;
    const clean = slug.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
    if (clean.length < 3) {
      setHint("Adresse braucht mindestens 3 Zeichen");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ public_slug: clean, public_enabled: nextEnabled } as never)
      .eq("id", userId);
    setSaving(false);
    if (error) {
      setHint(error.code === "23505" ? "Adresse ist schon vergeben" : "Speichern fehlgeschlagen");
      return;
    }
    setSlug(clean);
    setEnabled(nextEnabled);
    setHint(nextEnabled ? "Profil ist öffentlich" : "Profil ist privat");
  };

  const copy = async (text: string, label: string) => {
    try {
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
      if (nav.share) {
        await nav.share({ title: "Nosy Push-Ups", url: text });
      } else {
        await navigator.clipboard.writeText(text);
        setHint(`${label} kopiert`);
      }
    } catch {
      /* abgebrochen */
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          Name, Level, Streak und Bestwert teilen
        </span>
        <button
          onClick={() => save(!enabled)}
          disabled={saving}
          className={`h-7 w-12 shrink-0 rounded-full p-0.5 transition ${enabled ? "bg-primary" : "bg-secondary"}`}
          aria-label="Öffentliches Profil umschalten"
        >
          <span
            className={`block h-6 w-6 rounded-full bg-background transition ${enabled ? "translate-x-5" : ""}`}
          />
        </button>
      </div>

      <label className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Adresse
      </label>
      <div className="mt-1 flex gap-2">
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-border bg-background/50 px-3 py-2 text-sm"
        />
        <button
          onClick={() => save(enabled)}
          disabled={saving}
          className="rounded-xl border border-border bg-secondary px-3 text-xs font-medium text-secondary-foreground"
        >
          Speichern
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => copy(profileUrl, "Profil-Link")}
          disabled={!enabled}
          className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        >
          Profil teilen
        </button>
        <button
          onClick={() => copy(inviteUrl, "Einladungslink")}
          className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"
        >
          Freunde einladen
        </button>
      </div>
      {hint && <p className="mt-2 text-center text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
