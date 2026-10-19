export type QuickStartPlan = {
  title: string;
  headline: string;
  detail: string;
  sets: number;
  reps: number;
  rest_s: number;
  remaining: number;
  plannedReps: number;
};

export type DashboardRecommendation = QuickStartPlan & {
  readinessNote: string;
  recoveryDay: boolean;
};

export function getQuickStartPlan({
  best,
  todayReps,
  streak: _streak,
  goal,
}: {
  best: number;
  todayReps: number;
  streak: number;
  goal: number;
}): QuickStartPlan {
  const remaining = Math.max(0, goal - todayReps);
  const beginner = best <= 0;
  const sets = beginner ? 2 : remaining > 30 ? 3 : 2;
  const reps = beginner
    ? 5
    : remaining > 0
      ? Math.max(1, Math.min(20, Math.max(1, Math.round(best / 3)), Math.ceil(remaining / sets)))
      : Math.max(1, Math.min(8, Math.round((best || 10) / 5)));
  const plannedReps = sets * reps;
  const headline = beginner
    ? "Dein erster kurzer Trainingsplan"
    : remaining > 0
      ? `${remaining} Wiederholungen bis zum Tagesziel`
      : "Tagesziel erreicht";
  const detail = beginner
    ? "Allgemeiner Einstiegsplan ohne Leistungsprognose: 2 Sätze × 5 Wiederholungen mit 45 Sekunden Pause. Passe die Wiederholungen nach unten an, wenn die saubere Ausführung schwerfällt."
    : remaining > 0
      ? `Vorschlag: ${sets} Sätze × ${reps} Wiederholungen (${plannedReps} geplant). Das bringt dich rechnerisch auf ${todayReps + plannedReps} von ${goal} Tages-Wiederholungen, wenn du alle Wiederholungen schaffst.`
      : `Dein Tagesziel von ${goal} Wiederholungen ist erreicht. Wenn es sich gut anfühlt: locker ${sets} × ${reps} Wiederholungen als optionaler Zusatz.`;

  return {
    title: "Dein Start",
    headline,
    detail,
    sets,
    reps,
    rest_s: 45,
    remaining,
    plannedReps,
  };
}

/** A shared, structured dashboard recommendation; readiness never comes from proxies. */
export function getDashboardRecommendation({
  plan,
  readinessAvailable,
  readinessLabel,
  readinessLevel,
}: {
  plan: QuickStartPlan;
  readinessAvailable: boolean;
  readinessLabel?: string;
  readinessLevel?: "green" | "yellow" | "red";
}): DashboardRecommendation {
  if (readinessAvailable && readinessLevel === "red") {
    return {
      ...plan,
      title: "Optionaler Regenerationsblock",
      headline: "Heute regenerieren",
      detail:
        "Heute ist eine Pause sinnvoll. Wenn du dich beschwerdefrei bewegen möchtest, ist höchstens eine sehr leichte Einheit optional: 1 Satz × 3 Wiederholungen, ohne Leistungsziel. Bei Schmerzen oder Unwohlsein nicht trainieren.",
      sets: 1,
      reps: 3,
      rest_s: 60,
      plannedReps: 3,
      recoveryDay: true,
      readinessNote:
        "Niedrige geschätzte Tagesform: kein intensives Training empfohlen. Die Schätzung ersetzt nicht dein Körpergefühl.",
    };
  }
  return {
    ...plan,
    recoveryDay: false,
    readinessNote:
      readinessAvailable && readinessLabel
        ? `Readiness: ${readinessLabel}. Höre zusätzlich auf dein Körpergefühl.`
        : "Readiness noch nicht verfügbar. Dieser allgemeine Plan verwendet keine geschätzte Tagesform; dafür fehlen ausreichende Schlaf- und Trainingsdaten.",
  };
}

export function getCoachFocus(best: number, weekReps: number, streak: number) {
  if (streak === 0) {
    return "Starte behutsam und achte zuerst auf eine saubere Ausführung.";
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
        : `Noch ${Math.max(0, target - weekReps)} Wiederholungen bis zum Wochenziel.`;
  return { weekReps, target, percent, state, message };
}

export function getSmartReminder({
  todayReps,
  goal,
  streak,
}: {
  score?: number | null;
  todayReps: number;
  goal: number;
  streak: number;
}) {
  if (todayReps >= goal) {
    return { title: "Tagesziel erreicht", text: "Super! Gönn dir Erholung oder hol dir Bonus-XP." };
  }
  if (streak > 0) {
    return {
      title: `${streak} Tage Serie`,
      text: `Noch ${goal - todayReps} Wiederholungen, damit die Serie weiterläuft.`,
    };
  }
  return { title: "Heute starten", text: `${goal} Wiederholungen sind dein Ziel – leg los!` };
}
