import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Dumbbell,
  Expand,
  Grid2X2,
  House,
  MessageCircle,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Store,
  SunMoon,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  applyCustomAccent,
  applyTheme,
  applyThemeMode,
  getStoredCustomAccent,
  getStoredTheme,
  getStoredThemeMode,
  THEMES,
  type ThemeId,
  type ThemeMode,
} from "@/lib/theme";

const APP_SHORTCUTS = [
  { to: "/", label: "Startseite", icon: House, description: "Dein Alo-Homescreen" },
  { to: "/ai", label: "Mira", icon: Sparkles, description: "Dein KI-Assistent" },
  { to: "/chat", label: "Nexus Chat", icon: MessageCircle, description: "Deine Gespräche" },
  { to: "/exercises", label: "Alo Health", icon: Dumbbell, description: "Gesundheit und Übungen" },
  { to: "/marketplace", label: "Marketplace", icon: Store, description: "Apps und Erweiterungen" },
  { to: "/profile", label: "Einstellungen", icon: Settings2, description: "Alo anpassen" },
] as const;

function pageLabel(pathname: string) {
  if (pathname === "/") return "Startseite";
  if (pathname.startsWith("/ai")) return "Mira";
  if (pathname.startsWith("/chat")) return "Nexus Chat";
  if (pathname.startsWith("/exercises") || pathname.startsWith("/health")) return "Alo Health";
  if (pathname.startsWith("/marketplace")) return "Marketplace";
  if (pathname.startsWith("/profile") || pathname.startsWith("/settings")) return "Einstellungen";
  if (pathname.startsWith("/training")) return "Training & Gym";
  if (pathname.startsWith("/browser")) return "Browser";
  if (pathname.startsWith("/admin")) return "Admin";
  return "Alo";
}

/** Visible browser-native system controls; never relies on gestures alone. */
export function AloSystemChrome() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [appsOpen, setAppsOpen] = useState(false);
  const [controlOpen, setControlOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>(getStoredTheme);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getStoredThemeMode);
  const [customAccent, setCustomAccent] = useState(
    () =>
      getStoredCustomAccent() ??
      THEMES.find((item) => item.id === getStoredTheme())?.swatch[0] ??
      "#9bddff",
  );
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [fullscreen, setFullscreen] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const updateNetwork = () => setOnline(navigator.onLine);
    const updateFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    const updateTheme = () => {
      setTheme(getStoredTheme());
      setThemeMode(getStoredThemeMode());
      setCustomAccent(
        getStoredCustomAccent() ??
          THEMES.find((item) => item.id === getStoredTheme())?.swatch[0] ??
          "#9bddff",
      );
    };
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    window.addEventListener("np-theme-change", updateTheme);
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => {
      window.removeEventListener("online", updateNetwork);
      window.removeEventListener("offline", updateNetwork);
      window.removeEventListener("np-theme-change", updateTheme);
      document.removeEventListener("fullscreenchange", updateFullscreen);
    };
  }, []);

  const openSearch = () => {
    window.dispatchEvent(new CustomEvent("alo-open", { detail: "search" }));
  };

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else void navigate({ to: "/" });
  };

  const toggleFullscreen = async () => {
    setFeedback("");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
      else setFeedback("Vollbild wird von diesem Browser nicht unterstützt.");
    } catch {
      setFeedback("Vollbild konnte nicht aktiviert werden. Prüfe die Browserberechtigung.");
    }
  };

  const selectTheme = (id: ThemeId) => {
    applyCustomAccent(null);
    applyTheme(id);
    setTheme(id);
    setCustomAccent(THEMES.find((item) => item.id === id)?.swatch[0] ?? "#9bddff");
    setFeedback(`${THEMES.find((item) => item.id === id)?.label ?? "Design"} aktiviert.`);
  };

  const selectThemeMode = (mode: ThemeMode) => {
    applyThemeMode(mode);
    setThemeMode(mode);
    setFeedback(
      mode === "system"
        ? "Alo folgt jetzt deiner Geräteeinstellung."
        : mode === "light"
          ? "Heller Modus aktiviert."
          : "Dunkler Modus aktiviert.",
    );
  };

  const selectCustomAccent = (color: string) => {
    applyCustomAccent(color);
    setCustomAccent(color);
    setFeedback("Eigene Akzentfarbe übernommen.");
  };

  return (
    <>
      <header className="alo-system-chrome" aria-label="Alo-Systemleiste">
        <div className="alo-system-brand-group">
          <Link to="/" className="alo-system-brand" aria-label="Alo Startseite">
            <span className="alo-system-mark" aria-hidden="true">
              A
            </span>
            <span>Alo</span>
          </Link>
          <span className="alo-system-divider" aria-hidden="true" />
          <span className="alo-system-current" aria-live="polite">
            {pageLabel(pathname)}
          </span>
        </div>

        <nav className="alo-system-actions" aria-label="Systemaktionen">
          <button
            type="button"
            className="alo-system-button"
            onClick={goBack}
            aria-label="Zurück"
            title="Zurück"
          >
            <ArrowLeft aria-hidden="true" />
          </button>
          <Link to="/" className="alo-system-button" aria-label="Startseite" title="Startseite">
            <House aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="alo-system-button alo-system-search"
            onClick={openSearch}
            aria-label="Alo durchsuchen"
            title="Suche"
          >
            <Search aria-hidden="true" />
            <span>Suchen</span>
            <kbd>⌘ K</kbd>
          </button>
          <button
            type="button"
            className="alo-system-button"
            onClick={() => setAppsOpen(true)}
            aria-label="Apps wechseln"
            title="Apps wechseln"
          >
            <Grid2X2 aria-hidden="true" />
          </button>
          <button
            type="button"
            className="alo-system-button alo-system-control-trigger"
            onClick={() => setControlOpen(true)}
            aria-label="Kontrollzentrum öffnen"
            title="Kontrollzentrum"
          >
            <SunMoon aria-hidden="true" />
            <span>Kontrollzentrum</span>
            <ChevronDown aria-hidden="true" className="alo-system-chevron" />
          </button>
        </nav>
      </header>

      <Dialog open={appsOpen} onOpenChange={setAppsOpen}>
        <DialogContent className="alo-system-dialog alo-app-switcher">
          <div className="alo-system-dialog-heading">
            <div>
              <DialogTitle>Apps wechseln</DialogTitle>
              <DialogDescription>Deine Alo-Bereiche auf einen Blick.</DialogDescription>
            </div>
            <button
              type="button"
              className="alo-system-dialog-close"
              onClick={() => setAppsOpen(false)}
              aria-label="Schließen"
            >
              <X />
            </button>
          </div>
          <div className="alo-app-switcher-grid">
            {APP_SHORTCUTS.map((app) => {
              const active =
                pathname === app.to || (app.to !== "/" && pathname.startsWith(`${app.to}/`));
              return (
                <Link
                  key={app.to}
                  to={app.to}
                  onClick={() => setAppsOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className="alo-app-switcher-item"
                >
                  <span className="alo-app-switcher-icon">
                    <app.icon aria-hidden="true" />
                  </span>
                  <span className="alo-app-switcher-copy">
                    <strong>{app.label}</strong>
                    <small>{app.description}</small>
                  </span>
                  {active && <Check className="alo-app-switcher-check" aria-label="Aktiv" />}
                </Link>
              );
            })}
          </div>
          <p className="alo-system-dialog-footnote">
            Die App-Auswahl navigiert zwischen deinen Bereichen. Mehrfenster-Arbeitsbereiche werden
            als eigener Ausbau ergänzt.
          </p>
        </DialogContent>
      </Dialog>

      <Dialog open={controlOpen} onOpenChange={setControlOpen}>
        <DialogContent className="alo-system-dialog alo-control-center">
          <div className="alo-system-dialog-heading">
            <div>
              <DialogTitle>Kontrollzentrum</DialogTitle>
              <DialogDescription>Schnelle Systemsteuerung und Darstellung.</DialogDescription>
            </div>
            <button
              type="button"
              className="alo-system-dialog-close"
              onClick={() => setControlOpen(false)}
              aria-label="Schließen"
            >
              <X />
            </button>
          </div>

          <section className="alo-control-status" aria-label="Systemstatus">
            <div className="alo-control-status-icon">
              {online ? <Wifi aria-hidden="true" /> : <WifiOff aria-hidden="true" />}
            </div>
            <div>
              <strong>{online ? "Verbunden" : "Offline"}</strong>
              <span>
                {online
                  ? "Internetverbindung verfügbar"
                  : "Einige Online-Funktionen sind eingeschränkt"}
              </span>
            </div>
            <span className={`alo-control-status-pill ${online ? "is-online" : "is-offline"}`}>
              {online ? "Online" : "Offline"}
            </span>
          </section>

          <section className="alo-control-section">
            <div className="alo-control-section-heading">
              <div>
                <h3>Darstellung</h3>
                <p>Automatisch oder mit festem Hell-/Dunkel-Modus.</p>
              </div>
              <SunMoon aria-hidden="true" />
            </div>
            <div
              className="alo-theme-mode-options"
              role="group"
              aria-label="Darstellungsmodus auswählen"
            >
              {[
                { id: "system", label: "Automatisch" },
                { id: "light", label: "Hell" },
                { id: "dark", label: "Dunkel" },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => selectThemeMode(option.id as ThemeMode)}
                  aria-pressed={themeMode === option.id}
                >
                  {option.label}
                  {themeMode === option.id && <Check aria-hidden="true" />}
                </button>
              ))}
            </div>
          </section>

          <section className="alo-control-section">
            <div className="alo-control-section-heading">
              <div>
                <h3>Design & Farben</h3>
                <p>Wähle eine Alo-Farbwelt oder eine eigene Akzentfarbe.</p>
              </div>
              <SunMoon aria-hidden="true" />
            </div>
            <label className="alo-custom-accent-control">
              <span>
                <strong>Eigene Akzentfarbe</strong>
                <small>Frei wählbar und auf Alo angewendet</small>
              </span>
              <input
                type="color"
                value={customAccent}
                onChange={(event) => selectCustomAccent(event.target.value)}
                aria-label="Eigene Akzentfarbe wählen"
              />
            </label>
            <div className="alo-theme-grid" role="group" aria-label="Alo-Farbwelt auswählen">
              {THEMES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="alo-theme-option"
                  onClick={() => selectTheme(item.id)}
                  aria-pressed={theme === item.id}
                >
                  <span
                    className="alo-theme-swatch"
                    style={{
                      background: `linear-gradient(135deg, ${item.swatch[0]}, ${item.swatch[1]})`,
                    }}
                  />
                  <span>{item.label}</span>
                  {theme === item.id && <Check aria-hidden="true" />}
                </button>
              ))}
            </div>
          </section>

          <div className="alo-control-actions">
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              className="alo-control-action"
            >
              <Expand aria-hidden="true" />
              <span>{fullscreen ? "Vollbild verlassen" : "Vollbild"}</span>
            </button>
            <Link
              to="/profile"
              onClick={() => setControlOpen(false)}
              className="alo-control-action"
            >
              <Settings2 aria-hidden="true" />
              <span>Alle Einstellungen</span>
            </Link>
            <Link
              to="/profile"
              onClick={() => setControlOpen(false)}
              className="alo-control-action"
            >
              <ShieldCheck aria-hidden="true" />
              <span>Sicherheit & Datenschutz</span>
            </Link>
          </div>
          {feedback && (
            <p role="status" className="alo-control-feedback">
              {feedback}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
