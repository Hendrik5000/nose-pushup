import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { applyTheme, DEFAULT_THEME, getStoredTheme, isThemeId, THEMES, type ThemeId } from "@/lib/theme";

export function ThemePicker({ profileId, initialTheme }: { profileId?: string; initialTheme?: string | null }) {
  const [active, setActive] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const next = isThemeId(initialTheme) ? initialTheme : getStoredTheme();
    setActive(next);
    applyTheme(next);
  }, [initialTheme]);

  const select = async (id: ThemeId) => {
    setActive(id);
    applyTheme(id);
    if (profileId) {
      await supabase.from("profiles").update({ theme: id }).eq("id", profileId);
    }
  };

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
      <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Design</h2>
      <p className="mt-1 text-xs text-muted-foreground">Wähle deine Farbwelt – wirkt sofort in der ganzen App.</p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => select(t.id)}
            aria-pressed={active === t.id}
            className={`rounded-2xl border p-3 text-left transition active:scale-[0.97] ${
              active === t.id
                ? "border-primary bg-primary/10"
                : "border-border bg-secondary/40 hover:border-muted-foreground/40"
            }`}
          >
            <span className="flex gap-1">
              <span className="h-6 w-6 rounded-full" style={{ background: t.swatch[0] }} />
              <span className="h-6 w-6 -ml-3 rounded-full" style={{ background: t.swatch[1] }} />
            </span>
            <span className="mt-2 block text-xs font-semibold">{t.label}</span>
            <span className="block text-[10px] leading-tight text-muted-foreground">{t.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
