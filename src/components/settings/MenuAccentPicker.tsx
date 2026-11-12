import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import {
  applyMenuAccent,
  getStoredMenuAccent,
  MENU_ACCENTS,
  type MenuAccentId,
} from "@/lib/menu-accent";

export function MenuAccentPicker() {
  const [active, setActive] = useState<MenuAccentId>("blue");

  useEffect(() => {
    const sync = () => setActive(getStoredMenuAccent());
    sync();
    window.addEventListener("alo-menu-accent-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("alo-menu-accent-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const select = (id: MenuAccentId) => {
    setActive(id);
    applyMenuAccent(id);
  };

  return (
    <div>
      <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
        Die Akzentfarbe gilt für Alo-Navigation, App-Menüs und diese Einstellungsübersicht. Deine
        Farbwelt und andere persönliche Darstellungsoptionen bleiben unverändert.
      </p>
      <div role="group" aria-label="Menü-Akzentfarbe wählen" className="grid grid-cols-2 gap-2">
        {MENU_ACCENTS.map((accent) => (
          <button
            key={accent.id}
            type="button"
            aria-label={`${accent.label} auswählen`}
            aria-pressed={active === accent.id}
            onClick={() => select(accent.id)}
            className="flex min-h-11 items-center gap-3 rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-left text-sm font-semibold transition hover:border-[var(--menu-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--menu-accent)]"
          >
            <span
              aria-hidden="true"
              className="h-5 w-5 shrink-0 rounded-full border border-foreground/20"
              style={{ backgroundColor: accent.swatch }}
            />
            <span className="min-w-0 flex-1">{accent.label}</span>
            {active === accent.id && (
              <Check className="h-4 w-4 shrink-0 text-[var(--menu-accent)]" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
      <p role="status" aria-live="polite" className="mt-3 text-xs text-muted-foreground">
        {MENU_ACCENTS.find((accent) => accent.id === active)?.label} ist auf diesem Gerät aktiv.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Wird nur lokal auf diesem Gerät gespeichert.
      </p>
    </div>
  );
}
