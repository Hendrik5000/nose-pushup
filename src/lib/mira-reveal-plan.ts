export function createMiraRevealPlan(text: string) {
  const boundaries: number[] = [];
  for (const match of text.matchAll(/\S+\s*/gu)) {
    boundaries.push((match.index ?? 0) + match[0].length);
  }
  if (text.length && boundaries.at(-1) !== text.length) boundaries.push(text.length);

  return {
    boundaries,
    durationMs: Math.min(1800, Math.max(420, boundaries.length * 42)),
  };
}
