import { useEffect, useMemo, useState } from "react";
import { MiraAnswerText } from "@/components/mira/MiraAnswerText";
import { createMiraRevealPlan } from "@/lib/mira-reveal-plan";

type MiraRevealState = {
  text: string;
  visibleLength: number;
  animating: boolean;
};

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

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
  const [reveal, setReveal] = useState<MiraRevealState>(() => {
    const shouldAnimate = animate && text.length > 0 && !prefersReducedMotion();
    return {
      text,
      visibleLength: shouldAnimate ? 0 : text.length,
      animating: shouldAnimate,
    };
  });

  useEffect(() => {
    if (!animate || !text.length) {
      setReveal({ text, visibleLength: text.length, animating: false });
      return;
    }

    if (prefersReducedMotion()) {
      setReveal({ text, visibleLength: text.length, animating: false });
      return;
    }

    const startedAt = performance.now();
    let frame = 0;
    let lastBoundary = 0;
    setReveal({ text, visibleLength: 0, animating: true });

    const step = (now: number) => {
      const elapsedMs = now - startedAt;
      const progress = Math.min(1, elapsedMs / plan.durationMs);
      let boundaryCount = 0;
      while (
        boundaryCount < plan.boundaryTimesMs.length &&
        elapsedMs >= plan.boundaryTimesMs[boundaryCount]
      ) {
        boundaryCount += 1;
      }
      if (progress >= 1) boundaryCount = plan.boundaries.length;
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

  const shouldAnimate = animate && text.length > 0 && !prefersReducedMotion();
  const current =
    reveal.text === text
      ? reveal
      : { text, visibleLength: shouldAnimate ? 0 : text.length, animating: shouldAnimate };
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
