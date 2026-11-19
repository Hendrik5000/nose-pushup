import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import {
  applyDesignStyle,
  DEFAULT_DESIGN_STYLE,
  DESIGN_STYLES,
  getStoredDesignStyle,
  type DesignStyleId,
} from "@/lib/design-style";

export function DesignStylePicker() {
  const [active, setActive] = useState<DesignStyleId>(DEFAULT_DESIGN_STYLE);

  useEffect(() => {
    setActive(getStoredDesignStyle());
  }, []);

  const select = (style: DesignStyleId) => {
    applyDesignStyle(style);
    setActive(style === "legacy-performance" ? "performance" : style);
    window.dispatchEvent(new Event("np-appearance-change"));
  };

  return (
    <section
      className="design-style-picker rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm"
      aria-labelledby="alo-design-title"
    >
      <div className="mb-4">
        <h3 id="alo-design-title" className="text-base font-semibold">
          Designstil
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Wähle aus sechs Oberflächenstilen. Deine Farbwelt, Navigation, Widgets und Trainingsdaten
          bleiben davon unabhängig.
        </p>
      </div>
      <div role="group" aria-label="Designstil auswählen" className="grid gap-2 sm:grid-cols-2">
        {DESIGN_STYLES.map((style) => (
          <button
            key={style.id}
            type="button"
            data-design-style-option={style.id}
            aria-pressed={active === style.id}
            onClick={() => select(style.id)}
            className="flex min-h-16 items-start justify-between gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{style.label}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {style.description}
              </span>
            </span>
            {active === style.id && (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
      <p role="status" aria-live="polite" className="mt-3 text-xs text-muted-foreground">
        Aktiv: {DESIGN_STYLES.find((style) => style.id === active)?.label ?? "Apple HIG"}.
      </p>
    </section>
  );
}
