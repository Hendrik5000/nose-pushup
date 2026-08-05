// ─── Cali System — Skill Tree & Progression Engine ───────────────────────────
// Based on the "Zero to Planche in 229 Days" concept:
// Zero-Day Prevention · Detailed Tracking · Smart Load Management · Progression Gates

export type CaliUnit = "seconds" | "reps";
export type SkillStatus = "locked" | "active" | "mastered";

export type CaliSkill = {
  id: string;
  name: string;
  icon: string;
  description: string;
  unit: CaliUnit;
  detection_type: "timer" | "touch";
  /** Personal best needed to UNLOCK this skill (from prerequisite skill). */
  unlock_threshold: number;
  /** Personal best needed to be considered MASTERED. */
  mastery_threshold: number;
  /** ID of the prerequisite skill (null = always available). */
  prerequisite: string | null;
  /** Which joint groups are stressed — shown in load manager. */
  stress: ("wrist" | "shoulder" | "elbow" | "core")[];
  tip: string;
};

export type CaliPath = {
  id: string;
  name: string;
  icon: string;
  color: string;
  skills: CaliSkill[];
};

// ─── Skill Tree Definitions ───────────────────────────────────────────────────

export const CALI_PATHS: CaliPath[] = [
  {
    id: "planche",
    name: "Planche",
    icon: "🤸",
    color: "oklch(0.75 0.18 90)",   // yellow-gold
    skills: [
      {
        id: "cali_planche_lean",
        name: "Planche Lean",
        icon: "🪄",
        description: "Vorgelehnte Plank-Position — Grundlage für alle Planche-Skills.",
        unit: "seconds",
        detection_type: "timer",
        unlock_threshold: 0,
        mastery_threshold: 30,
        prerequisite: null,
        stress: ["wrist", "shoulder"],
        tip: "Schultern leicht vor die Hände, Körper Brett-gerade, Ellbogen eindrehen.",
      },
      {
        id: "cali_pseudo_pushup",
        name: "Pseudo Planche Push-Up",
        icon: "💪",
        description: "Push-Up mit nach hinten zeigenden Fingern und vorgelagertem Körperschwerpunkt.",
        unit: "reps",
        detection_type: "touch",
        unlock_threshold: 15,
        mastery_threshold: 10,
        prerequisite: "cali_planche_lean",
        stress: ["wrist", "shoulder", "elbow"],
        tip: "Finger zeigen nach hinten, Ellbogen nah am Körper, Schultern maximal vorverlagern.",
      },
      {
        id: "cali_tuck_planche",
        name: "Tuck Planche",
        icon: "🔮",
        description: "Beide Beine eng an den Bauch gezogen, Hüfte parallel zum Boden.",
        unit: "seconds",
        detection_type: "timer",
        unlock_threshold: 5,
        mastery_threshold: 15,
        prerequisite: "cali_pseudo_pushup",
        stress: ["wrist", "shoulder", "core"],
        tip: "Rücken rund, Knie maximal zur Brust, Schulterblätter auseinander drücken.",
      },
      {
        id: "cali_adv_tuck_planche",
        name: "Advanced Tuck Planche",
        icon: "⚡",
        description: "Rücken flach, Knie noch nah am Bauch, Hüfte tiefer.",
        unit: "seconds",
        detection_type: "timer",
        unlock_threshold: 10,
        mastery_threshold: 10,
        prerequisite: "cali_tuck_planche",
        stress: ["wrist", "shoulder", "core"],
        tip: "Rücken so flach wie möglich, Knie locker, Spannung im gesamten Oberkörper.",
      },
      {
        id: "cali_straddle_planche",
        name: "Straddle Planche",
        icon: "✨",
        description: "Beine V-förmig gespreizt, Hüfte auf Schulterniveau.",
        unit: "seconds",
        detection_type: "timer",
        unlock_threshold: 7,
        mastery_threshold: 5,
        prerequisite: "cali_adv_tuck_planche",
        stress: ["wrist", "shoulder", "core"],
        tip: "Je weiter die Beine gespreizt, desto einfacher — schrittweise schließen.",
      },
      {
        id: "cali_full_planche",
        name: "Full Planche",
        icon: "🏆",
        description: "Körper waagerecht, Beine zusammen. Elite-Level.",
        unit: "seconds",
        detection_type: "timer",
        unlock_threshold: 3,
        mastery_threshold: 3,
        prerequisite: "cali_straddle_planche",
        stress: ["wrist", "shoulder", "core"],
        tip: "Maximale Spannung, Blick nach vorne unten, gleichmäßig atmen.",
      },
    ],
  },
  {
    id: "front_lever",
    name: "Front Lever",
    icon: "🎯",
    color: "oklch(0.70 0.18 200)",  // cyan-blue
    skills: [
      {
        id: "cali_dead_hang",
        name: "Dead Hang",
        icon: "🙌",
        description: "Passives Hängen an der Stange — Grundlage für alle Reck-Skills.",
        unit: "seconds",
        detection_type: "timer",
        unlock_threshold: 0,
        mastery_threshold: 30,
        prerequisite: null,
        stress: ["shoulder", "elbow"],
        tip: "Schultern aktiv nach unten ziehen (keine passive Überdehnung), Rumpf leicht angespannt.",
      },
      {
        id: "cali_tuck_fl",
        name: "Tuck Front Lever",
        icon: "🔵",
        description: "Knie zur Brust, Hüfte auf Stangehöhe, Körper waagerecht.",
        unit: "seconds",
        detection_type: "timer",
        unlock_threshold: 20,
        mastery_threshold: 10,
        prerequisite: "cali_dead_hang",
        stress: ["shoulder", "core"],
        tip: "Rücken rund erlaubt, Schultern aktiv, Hüfte nicht unter die Stange fallen lassen.",
      },
      {
        id: "cali_adv_tuck_fl",
        name: "Advanced Tuck Front Lever",
        icon: "🟦",
        description: "Rücken flacher, Knie noch in Tucking-Position.",
        unit: "seconds",
        detection_type: "timer",
        unlock_threshold: 8,
        mastery_threshold: 10,
        prerequisite: "cali_tuck_fl",
        stress: ["shoulder", "core"],
        tip: "Rücken schrittweise flacher, Schultern aktiv nach unten, Blick zur Stange.",
      },
      {
        id: "cali_straddle_fl",
        name: "Straddle Front Lever",
        icon: "💠",
        description: "Beine V-förmig gespreizt, Körper waagerecht.",
        unit: "seconds",
        detection_type: "timer",
        unlock_threshold: 8,
        mastery_threshold: 5,
        prerequisite: "cali_adv_tuck_fl",
        stress: ["shoulder", "core"],
        tip: "Je weiter die Beine, desto weniger Hebelkraft — schrittweise schließen.",
      },
      {
        id: "cali_full_fl",
        name: "Full Front Lever",
        icon: "🏅",
        description: "Körper waagerecht, Beine zusammen gestreckt. Elite.",
        unit: "seconds",
        detection_type: "timer",
        unlock_threshold: 3,
        mastery_threshold: 3,
        prerequisite: "cali_straddle_fl",
        stress: ["shoulder", "core"],
        tip: "Maximale Latissimus-Aktivierung, Hüfte nicht abfallen lassen.",
      },
    ],
  },
  {
    id: "handstand",
    name: "Handstand",
    icon: "🙃",
    color: "oklch(0.72 0.18 300)",  // violet
    skills: [
      {
        id: "cali_wall_hs",
        name: "Wall Handstand",
        icon: "🧱",
        description: "Handstand mit dem Rücken zur Wand — Grundposition.",
        unit: "seconds",
        detection_type: "timer",
        unlock_threshold: 0,
        mastery_threshold: 30,
        prerequisite: null,
        stress: ["wrist", "shoulder"],
        tip: "Schultern über Handgelenken, Körper gespannt, Fersen leicht an Wand.",
      },
      {
        id: "cali_chest_wall_hs",
        name: "Chest-to-Wall HS",
        icon: "🫀",
        description: "Brust zur Wand — trainiert gerades Alignment.",
        unit: "seconds",
        detection_type: "timer",
        unlock_threshold: 15,
        mastery_threshold: 20,
        prerequisite: "cali_wall_hs",
        stress: ["wrist", "shoulder"],
        tip: "Bauch und Brust zur Wand, Hüfte in Linie, Körper gerade wie ein Brett.",
      },
      {
        id: "cali_freestand_hs",
        name: "Freistehender Handstand",
        icon: "🌟",
        description: "Balance ohne Wand — der eigentliche Handstand.",
        unit: "seconds",
        detection_type: "timer",
        unlock_threshold: 15,
        mastery_threshold: 10,
        prerequisite: "cali_chest_wall_hs",
        stress: ["wrist", "shoulder"],
        tip: "Finger aktiv ins Gleichgewicht drücken, kleine Korrekturen, Blick nach unten.",
      },
      {
        id: "cali_hs_pushup",
        name: "Handstand Push-Up",
        icon: "👑",
        description: "Push-Up im Handstand. Maximale Schulter-Kraft.",
        unit: "reps",
        detection_type: "touch",
        unlock_threshold: 5,
        mastery_threshold: 5,
        prerequisite: "cali_freestand_hs",
        stress: ["wrist", "shoulder", "elbow"],
        tip: "Nacken neutral, Ellbogen parallel oder leicht nach außen, volle Streckung oben.",
      },
    ],
  },
];

// ─── Utility Functions ────────────────────────────────────────────────────────

/** Get all skills in a flat array. */
export function allSkills(): CaliSkill[] {
  return CALI_PATHS.flatMap((p) => p.skills);
}

/** Get a skill's current status given the user's personal bests. */
export function getSkillStatus(
  bests: Record<string, number>,
  skill: CaliSkill,
): SkillStatus {
  // Check if prerequisite is met
  if (skill.prerequisite) {
    const prereqBest = bests[skill.prerequisite] ?? 0;
    if (prereqBest < skill.unlock_threshold) return "locked";
  }
  // Check if mastered
  const myBest = bests[skill.id] ?? 0;
  if (myBest >= skill.mastery_threshold) return "mastered";
  return "active";
}

/** Get the recommended skill to train today for a given path. */
export function getRecommendedSkill(
  bests: Record<string, number>,
  path: CaliPath,
): CaliSkill {
  const active = path.skills.find(
    (s) => getSkillStatus(bests, s) === "active",
  );
  return active ?? path.skills[path.skills.length - 1];
}

/** Progress (0–1) toward mastery for a given skill. */
export function skillProgress(bests: Record<string, number>, skill: CaliSkill): number {
  const best = bests[skill.id] ?? 0;
  return Math.min(1, best / skill.mastery_threshold);
}

// ─── Fatigue / Load Management ────────────────────────────────────────────────

export type FatigueLevel = "green" | "yellow" | "red";

export type CheckinData = {
  energy: number;     // 1–5
  soreness: number;   // 1–5 (joints)
  date: string;       // YYYY-MM-DD
};

export function getFatigueLevel(
  workoutsLast7Days: number,
  avgSoreness: number,  // 1–5
): FatigueLevel {
  if (avgSoreness >= 4 || workoutsLast7Days >= 7) return "red";
  if (avgSoreness >= 3 || workoutsLast7Days >= 5) return "yellow";
  return "green";
}

export type FatigueAdvice = {
  level: FatigueLevel;
  emoji: string;
  title: string;
  message: string;
  color: string;
};

export function getFatigueAdvice(level: FatigueLevel): FatigueAdvice {
  if (level === "red") {
    return {
      level,
      emoji: "🔴",
      title: "Hohe Belastung",
      message:
        "Dein Körper braucht Erholung. Heute: aktive Regeneration (Mobilität, Stretching, Spaziergang) — kein intensives Training.",
      color: "text-red-400",
    };
  }
  if (level === "yellow") {
    return {
      level,
      emoji: "🟡",
      title: "Moderate Belastung",
      message:
        "Reduziere Volumen um ~30 %. Fokus auf Technik statt Maximalleistung. Pausen zwischen Sets verlängern.",
      color: "text-yellow-400",
    };
  }
  return {
    level,
    emoji: "🟢",
    title: "Bereit",
    message: "Optimale Trainingsbereitschaft. Voller Einsatz möglich. Nutze heute deine Bestform.",
    color: "text-green-400",
  };
}

// ─── Daily Check-in ───────────────────────────────────────────────────────────

const CHECKIN_KEY = (date: string) => `cali_checkin_${date}`;

export function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function loadCheckin(date: string): CheckinData | null {
  try {
    const raw = localStorage.getItem(CHECKIN_KEY(date));
    return raw ? (JSON.parse(raw) as CheckinData) : null;
  } catch {
    return null;
  }
}

export function saveCheckin(data: CheckinData): void {
  localStorage.setItem(CHECKIN_KEY(data.date), JSON.stringify(data));
}

/** Load last N check-ins (most recent first). */
export function loadRecentCheckins(days: number): CheckinData[] {
  const result: CheckinData[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const c = loadCheckin(d);
    if (c) result.push(c);
  }
  return result;
}
