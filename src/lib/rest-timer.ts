// ─── Smart Rest Timer ────────────────────────────────────────────────────────
// Suggests rest duration from RPE and recent form quality.

export type RestSuggestion = {
  seconds: number;
  label: string;
  reason: string;
};

/**
 * Recommend rest between sets.
 * - Higher RPE → longer rest
 * - Poor form score → slightly longer rest
 * - Defaults to a sensible mid range for push-up style work
 */
export function suggestRest(opts: {
  rpe?: number | null;
  formScore?: number | null;
  exerciseId?: string;
}): RestSuggestion {
  const rpe = opts.rpe ?? 6;
  const form = opts.formScore ?? 3.5;

  let base = 45;
  if (rpe >= 9) base = 120;
  else if (rpe >= 8) base = 90;
  else if (rpe >= 7) base = 75;
  else if (rpe >= 5) base = 55;
  else base = 40;

  // Timer holds (plank etc.) need less "rest between sets" framing
  if (opts.exerciseId === "plank" || opts.exerciseId?.startsWith("cali_")) {
    base = Math.round(base * 0.85);
  }

  if (form < 3) base += 15;
  else if (form >= 4.5) base = Math.max(30, base - 10);

  base = Math.min(180, Math.max(20, base));

  let label = "Kurzpause";
  if (base >= 90) label = "Lange Pause";
  else if (base >= 60) label = "Standard-Pause";

  const reason =
    rpe >= 8
      ? "Hohe Anstrengung — nimm dir die Zeit."
      : form < 3
        ? "Form war wackelig — erhole dich kurz extra."
        : "Passt zu deiner letzten Leistung.";

  return { seconds: base, label, reason };
}

export function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m <= 0) return `${s}s`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
