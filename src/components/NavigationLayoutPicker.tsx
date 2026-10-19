import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import {
  applyNavigationLayout,
  applyNavigationVisibility,
  DEFAULT_NAVIGATION_LAYOUT,
  getStoredNavigationLayout,
  getNavigationVisible,
  NAVIGATION_LAYOUTS,
  type NavigationLayoutId,
} from "@/lib/navigation-layout";

export function NavigationLayoutPicker() {
  const [active, setActive] = useState<NavigationLayoutId>(DEFAULT_NAVIGATION_LAYOUT);
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    setActive(getStoredNavigationLayout());
    setVisible(getNavigationVisible());
    const sync = () => {
      setActive(getStoredNavigationLayout());
      setVisible(getNavigationVisible());
      setMessage("");
    };
    window.addEventListener("np-appearance-change", sync);
    return () => window.removeEventListener("np-appearance-change", sync);
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-border p-3">
        <div>
          <p className="text-sm font-semibold">Erweiterte Navigation</p>
          <p className="text-xs text-muted-foreground">
            Standardmäßig ausgeblendet – die drei Alo-Module bleiben oben direkt erreichbar.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={visible}
          aria-label="Erweiterte Navigation einblenden"
          onClick={() => {
            const next = !visible;
            applyNavigationVisibility(next);
            setVisible(next);
            window.dispatchEvent(new Event("np-appearance-change"));
            setMessage(
              next ? "Erweiterte Navigation eingeblendet." : "Erweiterte Navigation ausgeblendet.",
            );
          }}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${visible ? "bg-primary" : "bg-secondary"}`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-background transition-all ${visible ? "left-6" : "left-1"}`}
          />
        </button>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Wo soll deine Homebar sitzen? Position und Variante sind frei mit jedem Designstil und jeder
        Farbwelt kombinierbar. Die Änderung siehst du sofort.
      </p>
      <div role="group" aria-label="Homebar auswählen" className="grid grid-cols-2 gap-3">
        {NAVIGATION_LAYOUTS.map((layout) => (
          <button
            key={layout.id}
            type="button"
            aria-label={`${layout.label} – ${layout.description}`}
            aria-pressed={active === layout.id}
            onClick={() => {
              applyNavigationLayout(layout.id);
              setActive(layout.id);
              setMessage(`${layout.label} ist aktiv.`);
            }}
            className="min-w-0 rounded-xl border-2 p-3 text-left"
            style={{ borderColor: active === layout.id ? "var(--primary)" : "var(--border)" }}
          >
            <span aria-hidden="true" className="homebar-preview" data-preview-layout={layout.id}>
              <span className="homebar-preview-content">
                <span />
                <span />
                <span />
              </span>
              <span className="homebar-preview-nav">
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
            </span>
            <span className="mt-2 flex items-center justify-between gap-1 text-sm font-semibold">
              {layout.label}
              {active === layout.id && (
                <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              )}
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              {layout.description}
            </span>
          </button>
        ))}
      </div>
      <p role="status" aria-live="polite" className="mt-3 text-xs text-muted-foreground">
        {message || `Aktuell: ${NAVIGATION_LAYOUTS.find((layout) => layout.id === active)?.label}.`}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Auf diesem Gerät gespeichert. Farben, Designstil und Widgets bleiben unverändert.
      </p>
    </div>
  );
}
