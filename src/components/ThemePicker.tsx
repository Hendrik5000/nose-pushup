import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  applyTheme,
  DEFAULT_THEME,
  getStoredTheme,
  isThemeId,
  THEMES,
  type ThemeId,
} from "@/lib/theme";

export function ThemePicker({
  profileId,
  initialTheme,
}: {
  profileId?: string;
  initialTheme?: string | null;
}) {
  const [active, setActive] = useState<ThemeId>(DEFAULT_THEME);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const savingRef = useRef(false);

  useEffect(() => {
    const next = isThemeId(initialTheme) ? initialTheme : getStoredTheme();
    setActive(next);
    applyTheme(next);
  }, [initialTheme]);

  const select = async (id: ThemeId) => {
    // Do not let slower requests overwrite a later choice in the account.
    if (savingRef.current) return;
    setActive(id);
    applyTheme(id);
    setMessage("Design übernommen.");
    if (!profileId) return;
    savingRef.current = true;
    setSaving(true);
    setMessage("Design wird im Profil gespeichert …");
    try {
      const { error } = await supabase.from("profiles").update({ theme: id }).eq("id", profileId);
      if (error) throw error;
      setMessage("Design im Profil gespeichert.");
    } catch {
      setMessage(
        "Design übernommen, aber nicht im Profil gespeichert. Prüfe deine Verbindung und wähle das Design erneut.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        {THEMES.length} Farbwelten – von hell und ruhig bis dunkel und kontrastreich. Deine Auswahl
        verändert die gesamte App sofort.
      </p>
      <div
        role="group"
        aria-label="Design auswählen"
        aria-busy={saving}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => void select(t.id)}
            aria-label={`${t.label} – ${t.description}`}
            aria-pressed={active === t.id}
            disabled={saving}
            className="min-w-0 overflow-hidden rounded-xl border-2 p-2 text-left transition hover:-translate-y-0.5 motion-reduce:transform-none disabled:cursor-wait"
            style={{
              borderColor: active === t.id ? "var(--primary)" : "var(--border)",
              background: "var(--card)",
            }}
          >
            <span
              data-theme={t.id}
              aria-hidden="true"
              className="block rounded-lg border p-2"
              style={{ background: "var(--background)", borderColor: "var(--border)" }}
            >
              <span className="mb-2 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: "var(--primary)" }} />
                <span
                  className="h-1 w-9 rounded-full"
                  style={{ background: "var(--muted-foreground)" }}
                />
              </span>
              <span className="flex gap-2 rounded-md p-2" style={{ background: "var(--card)" }}>
                <span
                  className="h-6 w-6 shrink-0 rounded-full border-4"
                  style={{ borderColor: "var(--primary)" }}
                />
                <span className="flex flex-1 flex-col justify-center gap-1">
                  <span
                    className="h-1 w-3/4 rounded-full"
                    style={{ background: "var(--foreground)" }}
                  />
                  <span
                    className="h-1 w-1/2 rounded-full"
                    style={{ background: "var(--muted-foreground)" }}
                  />
                </span>
              </span>
              <span
                className="mt-2 block h-2 w-full rounded-full"
                style={{ background: "var(--primary)" }}
              />
            </span>
            <span className="mt-2 flex items-center justify-between gap-1 text-xs font-semibold">
              {t.label}
              {active === t.id && (
                <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              )}
            </span>
            <span className="mt-1 block text-xs leading-snug text-muted-foreground">
              {t.description}
            </span>
          </button>
        ))}
      </div>
      <p role="status" aria-live="polite" className="mt-3 text-xs text-muted-foreground">
        {message ||
          `Aktuell: ${THEMES.find((t) => t.id === active)?.label}. Häkchen markiert die Auswahl.`}
      </p>
    </div>
  );
}
