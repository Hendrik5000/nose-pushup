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
  const [message, setMessage] = useState("");

  useEffect(() => {
    const stored = getStoredDesignStyle();
    setActive(stored);
    applyDesignStyle(stored);
    const sync = () => {
      setActive(getStoredDesignStyle());
      setMessage("");
    };
    window.addEventListener("np-appearance-change", sync);
    return () => window.removeEventListener("np-appearance-change", sync);
  }, []);

  const select = (id: DesignStyleId) => {
    setActive(id);
    applyDesignStyle(id);
    setMessage(`${DESIGN_STYLES.find((style) => style.id === id)?.label} ist aktiv.`);
  };

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Nicht nur eine andere Farbe: Ändere Schrift, Kartenformen, Abstände und Navigation. Alle
        Stile lassen sich mit jeder Farbwelt kombinieren.
      </p>
      <div role="group" aria-label="Designstil auswählen" className="grid grid-cols-2 gap-3">
        {DESIGN_STYLES.map((style) => (
          <button
            key={style.id}
            type="button"
            aria-label={`${style.label} – ${style.description}`}
            aria-pressed={active === style.id}
            onClick={() => select(style.id)}
            className="min-w-0 overflow-hidden rounded-xl border-2 p-2 text-left transition hover:-translate-y-0.5 motion-reduce:transform-none"
            style={{
              borderColor: active === style.id ? "var(--primary)" : "var(--border)",
              background: "var(--card)",
            }}
          >
            <span
              data-design-style={style.id}
              aria-hidden="true"
              className="block bg-background p-3 text-foreground"
              style={{
                fontFamily: "var(--design-body-font)",
                borderRadius: "var(--design-card-radius)",
              }}
            >
              <span className="mb-2 flex gap-1 border-b border-border pb-1">
                <span className="h-1 w-5 bg-primary" />
                <span className="h-1 w-5 bg-muted" />
                <span className="h-1 w-5 bg-muted" />
              </span>
              <span
                className="mb-2 block text-base font-bold"
                style={{ fontFamily: "var(--design-heading-font)" }}
              >
                Dein Training
              </span>
              <span className="flex" style={{ gap: "var(--design-gap)" }}>
                {["12", "3"].map((value) => (
                  <span
                    key={value}
                    className="flex min-w-0 flex-1 flex-col border border-border bg-card p-2 text-sm font-bold text-primary"
                    style={{
                      borderRadius: "var(--design-card-radius)",
                      borderWidth: "var(--design-border-width)",
                      boxShadow: "var(--design-shadow)",
                    }}
                  >
                    {value}
                    <span className="mt-1 h-1 w-4/5 bg-muted" />
                  </span>
                ))}
              </span>
            </span>
            <span className="mt-2 flex items-center justify-between gap-1 text-sm font-semibold">
              {style.label}
              {active === style.id && (
                <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              )}
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              {style.description}
            </span>
          </button>
        ))}
      </div>
      <p role="status" aria-live="polite" className="mt-3 text-xs text-muted-foreground">
        {message || `Aktuell: ${DESIGN_STYLES.find((style) => style.id === active)?.label}.`}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Der Designstil wird auf diesem Gerät gespeichert. Deine Widget-Auswahl und Reihenfolge
        bleiben erhalten.
      </p>
    </div>
  );
}
