const SENTENCE_END = /[.!?…]+["'“”’)}\]]*$/u;
const MAX_SENTENCE_PAUSE_MS = 110;

export function createMiraRevealPlan(text: string) {
  const boundaries: number[] = [];
  const sentenceEndBoundaries: number[] = [];
  for (const match of text.matchAll(/\S+\s*/gu)) {
    const boundary = (match.index ?? 0) + match[0].length;
    boundaries.push(boundary);
    const word = match[0].trimEnd();
    if (SENTENCE_END.test(word) && !(word.endsWith(".") && /\d\.\d$/u.test(word))) {
      sentenceEndBoundaries.push(boundary);
    }
  }
  if (text.length && boundaries.at(-1) !== text.length) boundaries.push(text.length);

  const baseDurationMs = Math.min(1800, Math.max(420, boundaries.length * 42));
  const pauses = new Set(sentenceEndBoundaries);
  const durationMs = Math.min(
    1800,
    baseDurationMs + sentenceEndBoundaries.length * MAX_SENTENCE_PAUSE_MS,
  );
  const boundaryTimesMs: number[] = [];
  let elapsedMs = 0;
  for (const boundary of boundaries) {
    elapsedMs += 42 + (pauses.has(boundary) ? MAX_SENTENCE_PAUSE_MS : 0);
    boundaryTimesMs.push(elapsedMs);
  }
  const scheduleScale = elapsedMs > durationMs ? durationMs / elapsedMs : 1;

  return {
    boundaries,
    sentenceEndBoundaries,
    boundaryTimesMs: boundaryTimesMs.map((time) => time * scheduleScale),
    durationMs,
  };
}
