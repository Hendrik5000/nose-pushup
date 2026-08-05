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

// ─── Calisthenics Skill Configs ───────────────────────────────────────────────
// These IDs map to skills defined in src/lib/calisthenics.ts.
// All hold-based skills use "timer" detection; rep-based ones use "touch".

Object.assign(EXERCISE_CONFIG, {
  cali_planche_lean: {
    minIntervalMs: 1000,
    idleHint: "Position einnehmen: Schultern leicht vor die Hände, Körper Brett-gerade.",
    activeHint: "Halten — Spannung im gesamten Körper!",
    repLabel: "Sekunde",
  },
  cali_pseudo_pushup: {
    minIntervalMs: 600,
    idleHint: "Finger zeigen nach hinten, Handy auf den Boden — Nase antippen.",
    activeHint: "Schultern vorverlagern — kontrolliert rauf!",
    repLabel: "Pseudo Planche Push-Up",
  },
  cali_tuck_planche: {
    minIntervalMs: 1000,
    idleHint: "Knie zur Brust ziehen und Position halten.",
    activeHint: "Halten — Schulterblätter auseinander drücken!",
    repLabel: "Sekunde",
  },
  cali_adv_tuck_planche: {
    minIntervalMs: 1000,
    idleHint: "Rücken flach, Knie locker gebeugt — Position einnehmen.",
    activeHint: "Halten — Rücken flach, maximale Spannung!",
    repLabel: "Sekunde",
  },
  cali_straddle_planche: {
    minIntervalMs: 1000,
    idleHint: "Beine V-förmig spreizen, Hüfte auf Schulterniveau.",
    activeHint: "Halten — Gleichgewicht halten!",
    repLabel: "Sekunde",
  },
  cali_full_planche: {
    minIntervalMs: 1000,
    idleHint: "Beine gestreckt zusammen, Körper waagerecht — volle Spannung.",
    activeHint: "Halten — Elite Level! Nicht aufgeben!",
    repLabel: "Sekunde",
  },
  cali_dead_hang: {
    minIntervalMs: 1000,
    idleHint: "An der Stange hängen — Schultern aktiv nach unten ziehen.",
    activeHint: "Halten — Rumpf leicht angespannt!",
    repLabel: "Sekunde",
  },
  cali_tuck_fl: {
    minIntervalMs: 1000,
    idleHint: "Knie zur Brust, Hüfte auf Stangehöhe halten.",
    activeHint: "Halten — Schultern aktiv!",
    repLabel: "Sekunde",
  },
  cali_adv_tuck_fl: {
    minIntervalMs: 1000,
    idleHint: "Rücken schrittweise flacher, Knie noch gebeugt.",
    activeHint: "Halten — Rücken flach halten!",
    repLabel: "Sekunde",
  },
  cali_straddle_fl: {
    minIntervalMs: 1000,
    idleHint: "Beine gespreizt, Körper waagerecht an der Stange.",
    activeHint: "Halten — Latissimus aktivieren!",
    repLabel: "Sekunde",
  },
  cali_full_fl: {
    minIntervalMs: 1000,
    idleHint: "Beine gestreckt zusammen, Körper parallel zum Boden.",
    activeHint: "Halten — volle Körperspannung!",
    repLabel: "Sekunde",
  },
  cali_wall_hs: {
    minIntervalMs: 1000,
    idleHint: "Hände schulterbreit, Rücken zur Wand — Handstand einnehmen.",
    activeHint: "Halten — Schultern über Handgelenken!",
    repLabel: "Sekunde",
  },
  cali_chest_wall_hs: {
    minIntervalMs: 1000,
    idleHint: "Brust zur Wand, Körper gerade ausrichten.",
    activeHint: "Halten — Bauch zur Wand, gerade Linie!",
    repLabel: "Sekunde",
  },
  cali_freestand_hs: {
    minIntervalMs: 1000,
    idleHint: "Kein Wandkontakt — Balance über Finger steuern.",
    activeHint: "Halten — kleine Korrekturen mit den Fingern!",
    repLabel: "Sekunde",
  },
  cali_hs_pushup: {
    minIntervalMs: 700,
    idleHint: "Handstand einnehmen, Handy auf den Boden — Kopf antippen.",
    activeHint: "Runter und hoch — volle Streckung oben!",
    repLabel: "Handstand Push-Up",
  },
} satisfies Record<string, ExerciseConfig>);

export function getConfig(id: string): ExerciseConfig {
  return EXERCISE_CONFIG[id] ?? EXERCISE_CONFIG.pushup;
}
