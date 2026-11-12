import { useEffect, useMemo, useState } from "react";
import { MiraAnswerText } from "@/components/mira/MiraAnswerText";
import { createMiraRevealPlan } from "@/lib/mira-reveal-plan";

type MiraRevealState = {
  text: string;
  visibleLength: number;
  animating: boolean;
};

export function MiraProgressiveAnswer({
  text,
  animate,
  className,
}: {
  text: string;
  animate: boolean;
  className?: string;
}) {
  const plan = useMemo(() => createMiraRevealPlan(text), [text]);
  const [reveal, setReveal] = useState<MiraRevealState>(() => ({
    text,
    visibleLength: animate ? 0 : text.length,
    animating: animate && text.length > 0,
  }));

  useEffect(() => {
    if (!animate || !text.length) {
      setReveal({ text, visibleLength: text.length, animating: false });
      return;
    }

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setReveal({ text, visibleLength: text.length, animating: false });
      return;
    }

    const startedAt = performance.now();
    let frame = 0;
    let lastBoundary = 0;
    setReveal({ text, visibleLength: 0, animating: true });

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / plan.durationMs);
      const boundaryCount =
        progress >= 1 ? plan.boundaries.length : Math.floor(progress * plan.boundaries.length);
      if (boundaryCount !== lastBoundary) {
        lastBoundary = boundaryCount;
        const visibleLength = plan.boundaries[boundaryCount - 1] ?? 0;
        setReveal({ text, visibleLength, animating: progress < 1 });
      }
      if (progress < 1) {
        frame = window.requestAnimationFrame(step);
      } else {
        setReveal({ text, visibleLength: text.length, animating: false });
      }
    };

    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [animate, plan, text]);

  const current =
    reveal.text === text
      ? reveal
      : { text, visibleLength: animate ? 0 : text.length, animating: animate && text.length > 0 };
  const wrapperClassName = [className, "min-w-0 max-w-full"].filter(Boolean).join(" ");

  if (!current.animating) {
    return (
      <div className={wrapperClassName}>
        <MiraAnswerText text={text} />
      </div>
    );
  }

  return (
    <>
      <div className={wrapperClassName} aria-hidden="true" inert>
        <MiraAnswerText text={text.slice(0, current.visibleLength)} />
      </div>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {text}
      </div>
    </>
  );
}
