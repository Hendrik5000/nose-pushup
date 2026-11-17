import { useCallback, useEffect, useRef, useState } from "react";
import {
  advanceTutorial,
  completeTutorial,
  EMPTY_TUTORIAL_STATE,
  getTutorial,
  loadTutorialState,
  MAIN_TUTORIAL,
  MAIN_TUTORIAL_ID,
  saveTutorialState,
  shouldAutoStartMainTour,
  startTutorial,
  type TutorialActiveRun,
  type TutorialState,
  type TutorialStep,
} from "@/lib/tutorials";

const CARD_WIDTH = 384;
const CARD_HEIGHT_ESTIMATE = 320;
const EDGE_PADDING = 12;

function readState(userId: string): TutorialState {
  try {
    return loadTutorialState(window.localStorage, userId);
  } catch {
    return EMPTY_TUTORIAL_STATE;
  }
}

function persistState(userId: string, state: TutorialState): void {
  try {
    saveTutorialState(window.localStorage, userId, state);
  } catch {
    /* run continues without persistence */
  }
}

export function TutorialOverlay({
  userId,
  autoStart = false,
}: {
  userId: string;
  autoStart?: boolean;
}) {
  const [run, setRun] = useState<TutorialActiveRun | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const runRef = useRef<TutorialActiveRun | null>(null);
  runRef.current = run;
  const cardRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const finishRun = useCallback(() => {
    previousFocus.current?.focus();
  }, []);

  const advance = useCallback(() => {
    const current = runRef.current;
    if (!current) return;
    const next = advanceTutorial(readState(userId), current.id);
    persistState(userId, next);
    setRect(null);
    if (!next.active) {
      setRun(null);
      finishRun();
      return;
    }
    setRun(next.active);
  }, [userId, finishRun]);

  const skip = useCallback(() => {
    const current = runRef.current;
    if (!current) return;
    const next = completeTutorial(readState(userId), current.id);
    persistState(userId, next);
    setRun(null);
    setRect(null);
    finishRun();
  }, [userId, finishRun]);

  useEffect(() => {
    if (!userId) return;
    const state = readState(userId);
    if (state.active) {
      setRun(state.active);
      return;
    }
    if (!autoStart) return;
    if (window.location.pathname !== MAIN_TUTORIAL.route) return;
    if (!shouldAutoStartMainTour(state, window.localStorage, userId)) return;
    const next = startTutorial(state, MAIN_TUTORIAL_ID);
    persistState(userId, next);
    if (next.active) setRun(next.active);
  }, [userId, autoStart]);

  const tutorial = run ? getTutorial(run.id) : null;
  const step: TutorialStep | undefined = tutorial && run ? tutorial.steps[run.step] : undefined;
  const hasRun = run !== null;
  const runId = run?.id ?? null;
  const stepNumber = run?.step ?? null;
  const stepSelector = step?.selector ?? null;
  const stepInteraction = step?.requireInteraction === true;

  useEffect(() => {
    if (!hasRun) return;
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    requestAnimationFrame(() => {
      setMounted(true);
      cardRef.current?.focus();
    });
  }, [hasRun]);

  useEffect(() => {
    if (!hasRun) return;
    const selector = stepSelector;
    const measure = () => {
      if (!selector) {
        setRect(null);
        return;
      }
      const element = document.querySelector(selector);
      if (!element) {
        setRect(null);
        return;
      }
      setRect(element.getBoundingClientRect());
    };
    if (selector) {
      const element = document.querySelector(selector);
      element?.scrollIntoView({ block: "center" });
    }
    measure();
    const frame = requestAnimationFrame(measure);
    const remeasure = () => measure();
    window.addEventListener("scroll", remeasure, true);
    window.addEventListener("resize", remeasure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", remeasure, true);
      window.removeEventListener("resize", remeasure);
    };
  }, [hasRun, runId, stepNumber, stepSelector]);

  useEffect(() => {
    if (!hasRun || !stepInteraction || !stepSelector) return;
    const target = document.querySelector(stepSelector);
    if (!target) return;
    const onClick = () => advance();
    target.addEventListener("click", onClick, { capture: true, once: true });
    return () => target.removeEventListener("click", onClick, { capture: true });
  }, [hasRun, runId, stepNumber, stepSelector, stepInteraction, advance]);

  useEffect(() => {
    if (!hasRun) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        skip();
        return;
      }
      if (event.key !== "Tab" || !cardRef.current) return;
      const buttons = [...cardRef.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
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
  }, [hasRun, skip]);

  if (!run || !tutorial || !step || !userId) return null;

  const total = tutorial.steps.length;
  const spotlighted = rect !== null;
  const interactive = step.requireInteraction === true && spotlighted;

  const cardStyle: React.CSSProperties = (() => {
    if (!rect) {
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    }
    const left = Math.min(
      Math.max(EDGE_PADDING, rect.left + rect.width / 2 - CARD_WIDTH / 2),
      Math.max(EDGE_PADDING, window.innerWidth - CARD_WIDTH - EDGE_PADDING),
    );
    const below = rect.bottom + EDGE_PADDING;
    if (below + CARD_HEIGHT_ESTIMATE <= window.innerHeight - EDGE_PADDING) {
      return { top: below, left };
    }
    const above = rect.top - EDGE_PADDING - CARD_HEIGHT_ESTIMATE;
    if (above >= EDGE_PADDING) {
      return { top: above, left };
    }
    return {
      top: Math.max(EDGE_PADDING, Math.min(below, window.innerHeight - CARD_HEIGHT_ESTIMATE)),
      left,
    };
  })();

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="tutorial-overlay-title">
      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[99] rounded-2xl ring-2 ring-primary transition-all duration-200"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.65)",
          }}
        />
      )}
      {spotlighted && !interactive && <div aria-hidden="true" className="fixed inset-0 z-[98]" />}
      <div
        ref={cardRef}
        tabIndex={-1}
        style={cardStyle}
        className={`fixed z-[100] w-full max-w-sm rounded-3xl border border-border bg-card/95 p-5 shadow-2xl outline-none backdrop-blur-2xl transition-all duration-200 ${
          mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Alo · Schritt {run.step + 1} von {total}
          </span>
          <button
            type="button"
            onClick={skip}
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Überspringen
          </button>
        </div>
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex flex-col items-center text-center"
        >
          {step.requireInteraction === true && (
            <span className="mb-3 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
              Jetzt du
            </span>
          )}
          <h2 id="tutorial-overlay-title" className="text-xl font-bold tracking-tight">
            {step.title}
          </h2>
          <p className="mt-2 max-h-40 overflow-y-auto text-sm leading-relaxed text-muted-foreground">
            {step.text}
          </p>
          {interactive && (
            <p className="mt-3 rounded-xl bg-secondary/60 px-3 py-2 text-xs font-semibold">
              Tippe auf das markierte Element, um weiterzumachen.
            </p>
          )}
        </div>
        <div className="mt-5 flex gap-1.5" aria-label={`Fortschritt ${run.step + 1} von ${total}`}>
          {tutorial.steps.map((_, index) => (
            <span
              key={index}
              className={`h-1.5 flex-1 rounded-full ${
                index <= run.step ? "bg-primary" : "bg-secondary"
              }`}
            />
          ))}
        </div>
        <div className="mt-5 flex items-center gap-3">
          {run.step > 0 && (
            <button
              type="button"
              onClick={() => {
                setRect(null);
                const previous = Math.max(0, run.step - 1);
                persistState(userId, {
                  completed: readState(userId).completed,
                  active: { id: run.id, step: previous },
                });
                setRun({ id: run.id, step: previous });
              }}
              className="min-h-11 flex-1 rounded-xl border border-border px-4 py-3 text-sm font-medium"
            >
              Zurück
            </button>
          )}
          {!interactive && (
            <button
              type="button"
              onClick={advance}
              className="min-h-11 flex-[2] rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
            >
              {run.step === total - 1 ? "Tour abschließen" : "Weiter"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
