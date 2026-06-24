// Exercise registry: detection strategies + metadata.
// Detection types match the DB enum constraint on public.exercises.detection_type.

export type DetectionType = "touch" | "motion_vertical" | "timer" | "combo";
export type ExerciseUnit = "reps" | "seconds";

export type ExerciseMeta = {
  id: string;
  name: string;
  icon: string;
  detection_type: DetectionType;
  unit: ExerciseUnit;
  description: string | null;
  sort_order: number;
};

export type ExerciseConfig = {
  /** Min ms between counted events (debounce). */
  minIntervalMs: number;
  /** For motion_vertical: acceleration threshold in m/s². */
  motionThreshold?: number;
  /** UI hint when the screen is idle. */
  idleHint: string;
  /** UI hint while active. */
  activeHint: string;
  /** Verb for the rep, e.g. "Push-Up". */
  repLabel: string;
};

export const EXERCISE_CONFIG: Record<string, ExerciseConfig> = {
  pushup: {
    minIntervalMs: 280,
    idleHint: "Lege das Handy auf den Boden und tippe es mit der Nase an.",
    activeHint: "Weiter so — runter, Nase tippen, hoch.",
    repLabel: "Push-Up",
  },
  situp: {
    minIntervalMs: 350,
    idleHint: "Handy an die Knie halten und mit der Nase antippen.",
    activeHint: "Hoch — Nase tippt das Handy — zurück.",
    repLabel: "Sit-Up",
  },
  squat: {
    minIntervalMs: 500,
    motionThreshold: 3.2,
    idleHint: "Handy in die Hosentasche und starten. Tiefe Kniebeugen werden erkannt.",
    activeHint: "Tief runter, kontrolliert hoch.",
    repLabel: "Squat",
  },
  plank: {
    minIntervalMs: 1000,
    idleHint: "Position einnehmen und starten. Wir zählen die Sekunden für dich.",
    activeHint: "Halten — du schaffst das!",
    repLabel: "Sekunde",
  },
  burpee: {
    minIntervalMs: 800,
    motionThreshold: 4.0,
    idleHint: "Runter mit Nase aufs Display, hoch mit Sprung. Wir erkennen die Kombi.",
    activeHint: "Runter, tippen, Sprung — wiederholen.",
    repLabel: "Burpee",
  },
};

export function getConfig(id: string): ExerciseConfig {
  return EXERCISE_CONFIG[id] ?? EXERCISE_CONFIG.pushup;
}
