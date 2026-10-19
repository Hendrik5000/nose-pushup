import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, Compass, Dumbbell, Sparkles, Users } from "lucide-react";

type Step = {
  icon: string;
  title: string;
  body: string;
  accent?: string;
};

const STEPS: Step[] = [
  {
    icon: "🏡",
    title: "Dein erstes Training",
    body: "Wähle auf der Startseite eine Empfehlung und starte das Training. Du siehst dein Satzziel, machst Pausen und speicherst danach deine tatsächlich geschafften Wiederholungen. Erst dann erscheint dein Fortschritt.",
  },
  {
    icon: "🧭",
    title: "Hauptfunktionen schnell erreichen",
    body: "Über die Hauptnavigation erreichst du Übersicht, Training, Super-KI, Chat und Profil. Das Bereiche-Menü öffnet alle weiteren Funktionen.",
  },
  {
    icon: "💪",
    title: "Workout starten",
    body: "Von der Startseite aus kannst du sofort ein Push-Up-Workout beginnen. Wähle zwischen Nase, manuell oder Kamera und starte direkt in deinen Trainingseinstieg.",
  },
  {
    icon: "🤖",
    title: "Coach und Tipps nutzen",
    body: "Der KI-Coach begleitet dich mit personalisierten Empfehlungen, Trainingsideen und motivierenden Tipps. So wird dein Workout noch effektiver.",
  },
  {
    icon: "⚔️",
    title: "Mit Freunden und der Community antreten",
    body: "In Together findest du Battles, Ranglisten und gemeinsame Aktivitäten. So bringst du den Trainingsspaß direkt in die Gemeinschaft.",
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
  const StepIcon = [Dumbbell, Compass, Activity, Sparkles, Users][step] ?? Activity;

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
        className={`welcome-tour-card relative m-4 w-full max-w-sm rounded-3xl border border-border bg-card/90 p-6 shadow-[0_24px_80px_-20px_oklch(0_0_0/0.8)] backdrop-blur-2xl transition-all duration-200 ${
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
            <span className="classic-only">{current.icon}</span>
            <StepIcon className="sport-only h-9 w-9" aria-hidden="true" />
          </div>
          <h2 id="tour-title" className="mt-5 text-xl font-bold tracking-tight text-balance">
            {current.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
            {current.body}
          </p>
        </div>

        <div className="sport-only mt-6 flex items-center gap-3" aria-hidden="true">
          <span className="text-xs font-bold text-primary">0{step + 1}</span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">0{STEPS.length}</span>
        </div>
        {/* Fortschritts-Punkte */}
        <div className="classic-only mt-6 flex items-center justify-center gap-1.5">
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
            <span className="classic-only">{isLast ? "Los geht’s 🚀" : "Weiter"}</span>
            <span className="sport-only flex items-center justify-center gap-2">
              {isLast ? "Dein Training beginnt" : "Weiter"}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
