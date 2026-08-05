import { useEffect, useState } from "react";

type Step = {
  icon: string;
  title: string;
  body: string;
  accent?: string;
};

const STEPS: Step[] = [
  {
    icon: "👃",
    title: "Willkommen bei Nose Push!",
    body: "Deine Fitness, spielerisch. Zähle Wiederholungen, sammle XP und halte deine Streak am Leben. Ein kurzer Rundgang zeigt dir das Wichtigste.",
  },
  {
    icon: "⭕",
    title: "Dein Aktivitäts-Ring",
    body: "Auf der Startseite siehst du deinen Tagesfortschritt: Reps, Bestwert, Streak und Schritte. Fülle den Ring, um dein Tagesziel zu erreichen.",
  },
  {
    icon: "💪",
    title: "Push-Ups auf 3 Arten",
    body: "Tippe die Nase aufs Display (👃), trag Reps manuell ein (👆) oder lass die Kamera zählen (📷). Starte direkt vom Dashboard aus.",
  },
  {
    icon: "⚔️",
    title: "Tritt gegen andere an",
    body: "Unter „Together“ findest du Rangliste, Freunde und Live-Battles. Fordere jemanden heraus und miss dich in Echtzeit.",
  },
  {
    icon: "🤖",
    title: "Dein Smart Coach",
    body: "Der KI-Coach gibt dir Tipps, passt Ziele an und hält dich motiviert. Du bist startklar — auf geht’s!",
  },
];

function storageKey(userId: string) {
  return `nose-push:tour-seen:${userId}`;
}

const RESTART_EVENT = "nose-push:restart-tour";

/**
 * Startet die Willkommenstour erneut — löscht das „gesehen"-Flag und
 * signalisiert der gemounteten WelcomeTour, sich wieder zu öffnen.
 */
export function restartWelcomeTour(userId: string) {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    /* Storage nicht verfügbar — trotzdem Event feuern. */
  }
  window.dispatchEvent(new CustomEvent(RESTART_EVENT));
}

/**
 * Onboarding-Tour für neue bzw. Gast-Konten.
 * Zeigt einmalig pro Gerät/Konto die wichtigsten Funktionen.
 */
export function WelcomeTour({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let seen = false;
    try {
      seen = localStorage.getItem(storageKey(userId)) === "1";
    } catch {
      seen = false;
    }
    if (!seen) {
      setOpen(true);
      // Nächster Frame → sanfte Einblend-Animation.
      requestAnimationFrame(() => setMounted(true));
    }
  }, [userId]);

  // Manueller Neustart (z. B. aus den Einstellungen).
  useEffect(() => {
    const handler = () => {
      setStep(0);
      setOpen(true);
      requestAnimationFrame(() => setMounted(true));
    };
    window.addEventListener(RESTART_EVENT, handler);
    return () => window.removeEventListener(RESTART_EVENT, handler);
  }, []);

  const finish = () => {
    try {
      localStorage.setItem(storageKey(userId), "1");
    } catch {
      /* Storage nicht verfügbar — Tour einfach schließen. */
    }
    setMounted(false);
    // Nach der Ausblend-Transition aus dem DOM nehmen.
    window.setTimeout(() => setOpen(false), 200);
  };

  if (!open) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Tour überspringen"
        onClick={finish}
        className={`absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-200 ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Karte */}
      <div
        className={`relative m-4 w-full max-w-sm rounded-3xl border border-border bg-card/90 p-6 shadow-[0_24px_80px_-20px_oklch(0_0_0/0.8)] backdrop-blur-2xl transition-all duration-200 ${
          mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
            Schritt {step + 1} / {STEPS.length}
          </span>
          <button
            type="button"
            onClick={finish}
            className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            Überspringen
          </button>
        </div>

        <div className="mt-6 flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-primary/40 bg-primary/15 text-4xl shadow-[0_0_30px_-8px_var(--color-primary)]">
            {current.icon}
          </div>
          <h2 id="tour-title" className="mt-5 text-xl font-bold tracking-tight text-balance">
            {current.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
            {current.body}
          </p>
        </div>

        {/* Fortschritts-Punkte */}
        <div className="mt-6 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? "w-6 bg-primary" : "w-1.5 bg-secondary"
              }`}
            />
          ))}
        </div>

        {/* Aktionen */}
        <div className="mt-6 flex items-center gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="flex-1 rounded-xl border border-border bg-secondary/60 px-4 py-3 text-sm font-medium text-secondary-foreground transition active:scale-[0.98] hover:bg-secondary"
            >
              Zurück
            </button>
          )}
          <button
            type="button"
            onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
            className="flex-[2] rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98]"
          >
            {isLast ? "Los geht’s 🚀" : "Weiter"}
          </button>
        </div>
      </div>
    </div>
  );
}
