export type QuickStartPlan = {
  title: string;
  headline: string;
  detail: string;
  sets: number;
  reps: number;
  rest_s: number;
  remaining: number;
};

export type RecoverySummary = {
  score: number;
  label: string;
  detail: string;
  recommendation: string;
  readiness: "high" | "medium" | "low";
};

export type WeeklyProgressSummary = {
  weekReps: number;
  target: number;
  percent: number;
  delta: number;
  state: "ahead" | "ontrack" | "behind";
  message: string;
};

export type ReminderSummary = {
  title: string;
  text: string;
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

export function getRecoverySummary({
  steps = 0,
  sleepMin = 0,
  activeKcal = 0,
  streak = 0,
  goal = 50,
  weekReps = 0,
}: {
  steps?: number;
  sleepMin?: number;
  activeKcal?: number;
  streak?: number;
  goal?: number;
  weekReps?: number;
}): RecoverySummary {
  const stepRatio = Math.min(1, steps / 10000);
  const sleepRatio = Math.min(1, sleepMin / 480);
  const calorieRatio = Math.min(1, activeKcal / 500);
  const consistencyRatio = Math.min(1, (streak + 1) / 6);
  const weeklyRatio = Math.min(1, weekReps / Math.max(150, goal * 5));
  const score = Math.max(0, Math.min(100, Math.round((stepRatio * 30 + sleepRatio * 25 + calorieRatio * 20 + consistencyRatio * 15 + weeklyRatio * 10) * 100)));

  if (score >= 75) {
    return {
      score,
      label: "Gut vorbereitet",
      detail: "Deine Erholung ist aktuell in einem starken Bereich – ideal für einen belastbaren Push-Tag.",
      recommendation: "Ziel: stabil halten",
      readiness: "high",
    };
  }

  if (score >= 45) {
    return {
      score,
      label: "Mittelmäßig",
      detail: "Es geht bergauf, aber die Erholung ist noch nicht voll da – kürzere, sauberere Sets sind sinnvoll.",
      recommendation: "Konsistenz vor Volumen",
      readiness: "medium",
    };
  }

  return {
    score,
    label: "Erholung niedrig",
    detail: "Heute lieber sauber und kontrolliert arbeiten, statt die Reihenfolge zu erzwingen.",
    recommendation: "Leichter Start",
    readiness: "low",
  };
}

export function getWeeklyProgress({
  weekReps,
  target,
}: {
  weekReps: number;
  target: number;
}): WeeklyProgressSummary {
  const safeTarget = Math.max(1, target);
  const total = Math.max(0, weekReps);
  const percent = Math.min(100, Math.round((total / safeTarget) * 100));
  const delta = Math.max(0, safeTarget - total);
  const state = total >= safeTarget ? "ahead" : total >= safeTarget * 0.75 ? "ontrack" : "behind";

  const message =
    state === "ahead"
      ? "Du bist über deinem Wochenziel – das gibt dir jetzt Luft für eine lockerere Session."
      : state === "ontrack"
        ? "Sehr gut – du bist auf Kurs und brauchst nur noch einen sauberen Schub."
        : "Der Rhythmus fehlt noch – ein kurzer, sauberer Block reicht schon aus, um wieder in den Flow zu kommen.";

  return {
    weekReps: total,
    target: safeTarget,
    percent,
    delta,
    state,
    message,
  };
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
}): ReminderSummary {
  if (score < 45) {
    return {
      title: "Leichter Fokus heute",
      text: "Deine Erholung ist noch nicht voll da. Mache zwei saubere Sätze, halte die Form hoch und starte entspannt.",
    };
  }

  if (todayReps < goal * 0.7) {
    return {
      title: "Zwischenstopp nicht vergessen",
      text: `Du bist noch ${Math.max(0, Math.round(goal * 0.7) - todayReps)} Reps von der guten Tagesbasis entfernt. Ein kurzer Block reicht schon.`,
    };
  }

  if (streak > 0) {
    return {
      title: "Streak am Leben halten",
      text: "Du bist im guten Rhythmus. Halte die Session kurz, sauber und konsistent, damit der Streak weiterläuft.",
    };
  }

  return {
    title: "Neues Kapitel starten",
    text: "Heute ist ein guter Tag für einen sauberen Neustart: kurz, kontrolliert und ohne Druck.",
  };
}

export function getClubChallengeState({
  clubGoal,
  teamReps,
}: {
  clubGoal: number;
  teamReps: number;
}) {
  const percent = Math.min(100, Math.round((teamReps / Math.max(1, clubGoal)) * 100));

  if (percent >= 100) {
    return {
      label: "Mission erfüllt",
      message: "Der Club hat das Wochenziel bereits knallhart geschafft.",
      percent,
    };
  }

  return {
    label: "Mission im Gange",
    message: `${Math.max(0, clubGoal - teamReps)} Reps bis zum Team-Ziel. Ein kurzer Block von jedem reicht aus.`,
    percent,
  };
}
