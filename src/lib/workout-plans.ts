export type QuickStartPlan = {
  title: string;
  headline: string;
  detail: string;
  sets: number;
  reps: number;
  rest_s: number;
  remaining: number;
};

export function getQuickStartPlan({
  best,
  todayReps,
  streak,
  goal,
}: {
  best: number;
  todayReps: number;
  streak: number;
  goal: number;
}): QuickStartPlan {
  const remaining = Math.max(0, goal - todayReps);
  const baseTarget = Math.max(8, Math.round((best || 10) * 1.05) + (streak > 0 ? 2 : 0));
  const sets = streak > 0 ? 3 : 2;
  const reps = Math.max(8, Math.min(20, Math.round(baseTarget / sets)));

  const headline = remaining > 0 ? `Noch ${remaining} Reps bis zum Ziel` : "Ziel für heute schon drin";
  const detail =
    streak === 0
      ? "Ein kurzer, sauberer Start reicht heute schon."
      : remaining > 0
        ? "Eine kompakte Session bringt dich noch sicher über den Tag."
        : "Heute warst du schon aktiv – gönn dir einen lockeren Finish.";

  return {
    title: "Schnellstart",
    headline,
    detail,
    sets,
    reps,
    rest_s: 45,
    remaining,
  };
}

export function getCoachFocus(best: number, weekReps: number, streak: number) {
  if (streak === 0) {
    return "Starte heute mit zwei sauberen Sets und baue dir sofort Vertrauen auf.";
  }

  if (weekReps < 80) {
    return "Heute zählt besonders die Konsistenz – halte die Form sauber und komm wieder in den Flow.";
  }

  return "Bleib im Rhythmus, zieh die Wiederholungen ruhig und halte das Tempo gleichmäßig.";
}
