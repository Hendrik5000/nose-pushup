import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Compass,
  Dumbbell,
  MessageCircle,
  Sparkles,
  Users,
} from "lucide-react";

type Step = { icon: string; title: string; body: string };
const STEPS: Step[] = [
  {
    icon: "✦",
    title: "Willkommen bei Alo",
    body: "Alo heißt All in one: Drei gleichwertige Bereiche wohnen hier zusammen – Training, Mira als vielseitige KI und Nexus Chat für den Austausch. Kein Bereich ist die ganze App.",
  },
  {
    icon: "↔",
    title: "Zwischen Modulen wischen",
    body: "Auf einer freien Stelle horizontal wischen: nach links geht es vom Training über Mira und Nexus Chat zu den Einstellungen. Nach rechts geht es zurück. Einstellungen sind ein eigener Bildschirm, kein viertes Modul. Vertikales Scrollen bleibt normal. Formulare, Chat-Eingaben, Dialoge, Karussells und aktive Workouts sind vom Wechsel ausgenommen.",
  },
  {
    icon: "✍️",
    title: "Mira ist deine Alltags-KI",
    body: "Frag Mira nach Wissen, Schreiben, Ideen, Lernen und Alltag. Trainings- oder Nexus-Chat-Kontext ist optional und standardmäßig aus. Du entscheidest in Miras Einstellungen, ob du passende App-Daten freigibst.",
  },
  {
    icon: "⚙️",
    title: "Kompakt starten, alles behalten",
    body: "Tippe oben auf Training, Mira oder Nexus, wenn du nicht wischen möchtest. Das kompakte Menü blendet sich nach zwei Sekunden aus und gibt den Platz frei. Nach einem Seitenwechsel oder einer Berührung am oberen Bildschirmrand erscheint es kurz wieder; mit der Maus genügt der obere Rand. Die Design-Schaltfläche bleibt als direkter Weg zu den Einstellungen sichtbar. Die große Menüleiste ist anfangs aus; aktivierst du sie, verschwindet sie beim Herunterscrollen und erscheint beim Hochscrollen wieder. Diese Tour kannst du im Profil wiederholen.",
  },
];
const VERSION = "v2";
function storageKey(userId: string) {
  return `nose-push:tour-seen:${VERSION}:${userId}`;
}
const RESTART_EVENT = "nose-push:restart-tour";
export function restartWelcomeTour(userId: string) {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    /* storage may be unavailable */
  }
  window.dispatchEvent(new CustomEvent(RESTART_EVENT));
}
export function WelcomeTour({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!userId) return;
    try {
      if (localStorage.getItem(storageKey(userId)) !== "1") setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [userId]);
  useEffect(() => {
    if (!open) return;
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    requestAnimationFrame(() => {
      setMounted(true);
      card.current?.querySelector<HTMLElement>("button")?.focus();
    });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish();
        return;
      }
      if (event.key !== "Tab" || !card.current) return;
      const buttons = [...card.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
      if (!buttons.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) {
        event.preventDefault();
        buttons.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === buttons.at(-1)) {
        event.preventDefault();
        buttons[0]?.focus();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [open]);
  useEffect(() => {
    const handler = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(RESTART_EVENT, handler);
    return () => window.removeEventListener(RESTART_EVENT, handler);
  }, []);
  const finish = () => {
    try {
      localStorage.setItem(storageKey(userId), "1");
    } catch {
      /* simply close */
    }
    setMounted(false);
    window.setTimeout(() => {
      setOpen(false);
      previousFocus.current?.focus();
    }, 180);
  };
  if (!open) return null;
  const current = STEPS[step];
  const Icon = [Sparkles, Compass, Activity, Dumbbell][step] ?? Users;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      <button
        type="button"
        aria-label="Tour überspringen"
        onClick={finish}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
      />
      <div
        ref={card}
        className={`welcome-tour-card relative m-4 w-full max-w-md rounded-3xl border border-border bg-card/95 p-5 shadow-2xl backdrop-blur-2xl transition-all duration-200 ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Alo · Schritt {step + 1} von {STEPS.length}
          </span>
          <button
            type="button"
            onClick={finish}
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Überspringen
          </button>
        </div>
        <div className="mt-4 flex flex-col items-center text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/40 bg-primary/15 text-3xl"
            aria-hidden="true"
          >
            <span className="classic-only">{current.icon}</span>
            <Icon className="sport-only h-7 w-7" />
          </div>
          <h2 id="tour-title" className="mt-3 text-xl font-bold tracking-tight">
            {current.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{current.body}</p>
          {step === 1 && (
            <div
              className="mt-4 flex w-full items-center justify-between rounded-xl bg-secondary/60 px-3 py-3 text-xs font-semibold"
              aria-label="Modulfolge; links wischen führt weiter"
            >
              <span>Training</span>
              <ArrowLeft className="h-4 w-4 rotate-180 text-primary" aria-hidden="true" />
              <span>Mira</span>
              <ArrowRight className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>Nexus Chat</span>
            </div>
          )}
        </div>
        <div
          className="mt-5 flex gap-1.5"
          aria-label={`Fortschritt ${step + 1} von ${STEPS.length}`}
        >
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-secondary"}`}
            />
          ))}
        </div>
        <div className="mt-5 flex items-center gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="min-h-11 flex-1 rounded-xl border border-border px-4 py-3 text-sm font-medium"
            >
              Zurück
            </button>
          )}
          <button
            type="button"
            onClick={() => (step === STEPS.length - 1 ? finish() : setStep((s) => s + 1))}
            className="min-h-11 flex-[2] rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
          >
            {step === STEPS.length - 1 ? "Tour abschließen" : "Weiter"}
          </button>
        </div>
      </div>
    </div>
  );
}
