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

export function getWeeklyProgress({ weekReps, target }: { weekReps: number; target: number }) {
  const percent = target > 0 ? Math.min(100, Math.round((weekReps / target) * 100)) : 0;
  const state: "ahead" | "ontrack" | "behind" =
    percent >= 100 ? "ahead" : percent >= 50 ? "ontrack" : "behind";
  const message =
    state === "ahead"
      ? "Stark! Dein Wochenziel ist geschafft."
      : state === "ontrack"
        ? "Du bist auf Kurs – bleib dran."
        : `Noch ${Math.max(0, target - weekReps)} Reps bis zum Wochenziel.`;
  return { weekReps, target, percent, state, message };
}

export function getRecoverySummary({
  steps,
  sleepMin,
  activeKcal,
  streak,
  goal,
  weekReps,
}: {
  steps: number;
  sleepMin: number;
  activeKcal: number;
  streak: number;
  goal: number;
  weekReps: number;
}) {
  let score = 70;
  score += Math.min(15, Math.round((sleepMin - 360) / 8));
  score -= Math.min(20, Math.round(activeKcal / 100));
  score -= Math.min(10, Math.max(0, streak - 5));
  score -= weekReps > goal * 7 ? 10 : 0;
  score += steps > 0 && steps < 12000 ? 5 : 0;
  score = Math.max(10, Math.min(100, score));
  const label = score >= 75 ? "Gut erholt" : score >= 50 ? "Solide" : "Erholung nötig";
  const detail =
    score >= 75
      ? "Dein Körper ist bereit für eine intensive Einheit."
      : score >= 50
        ? "Normales Training ist okay, achte auf saubere Technik."
        : "Heute lieber locker trainieren oder pausieren.";
  const recommendation =
    score >= 75 ? "Volle Power" : score >= 50 ? "Moderat trainieren" : "Mobilität & Pause";
  return { score, label, detail, recommendation };
}

export function getSmartReminder({
  score,
  todayReps,
  goal,
  streak,
}: {
  score: number;
  todayReps: number;
  goal: number;
  streak: number;
}) {
  if (todayReps >= goal) {
    return { title: "Tagesziel erreicht", text: "Super! Gönn dir Erholung oder hol dir Bonus-XP." };
  }
  if (score < 50) {
    return { title: "Sanft bleiben", text: "Ein kurzer, lockerer Satz hält deine Serie am Leben." };
  }
  if (streak > 0) {
    return {
      title: `${streak} Tage Serie`,
      text: `Noch ${goal - todayReps} Reps, damit die Serie weiterläuft.`,
    };
  }
  return { title: "Heute starten", text: `${goal} Reps sind dein Ziel – leg los!` };
}
