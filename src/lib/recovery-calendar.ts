// ─── Muscle / Joint Recovery Calendar ────────────────────────────────────────
// 7-day overview of load on wrist, shoulder, elbow, core from recent workouts
// (via calisthenics stress tags) + daily check-in soreness.

import { allSkills, loadRecentCheckins, type CaliSkill } from "./calisthenics";

export type Joint = "wrist" | "shoulder" | "elbow" | "core";

export const JOINT_LABELS: Record<Joint, string> = {
  wrist: "Handgelenk",
  shoulder: "Schulter",
  elbow: "Ellbogen",
  core: "Rumpf",
};

export const JOINT_ICONS: Record<Joint, string> = {
  wrist: "✋",
  shoulder: "💪",
  elbow: "🦾",
  core: "🎯",
};

export type DayLoad = {
  day: string; // YYYY-MM-DD
  loads: Record<Joint, number>; // 0–3
  soreness: number | null; // 1–5 from check-in
};

export type JointSummary = {
  joint: Joint;
  score: number; // 0–100 load
  level: "green" | "yellow" | "red";
  label: string;
};

const skillById = new Map(allSkills().map((s) => [s.id, s]));

function stressForExercise(exerciseId: string): Joint[] {
  const skill = skillById.get(exerciseId) as CaliSkill | undefined;
  if (skill) return skill.stress;
  // Heuristics for base exercises
  if (exerciseId === "pushup" || exerciseId === "burpee")
    return ["wrist", "shoulder", "elbow", "core"];
  if (exerciseId === "plank") return ["wrist", "core", "shoulder"];
  if (exerciseId === "squat") return ["core"];
  if (exerciseId === "situp") return ["core"];
  return ["core"];
}

export type WorkoutRow = {
  exercise_id: string;
  count: number;
  created_at: string;
};

/** Build last 7 days of joint load from workouts + check-ins. */
export function buildRecoveryWeek(workouts: WorkoutRow[]): DayLoad[] {
  const days: DayLoad[] = [];
  const checkins = loadRecentCheckins(7);
  const checkinByDay = new Map(checkins.map((c) => [c.date, c.soreness]));

  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const loads: Record<Joint, number> = { wrist: 0, shoulder: 0, elbow: 0, core: 0 };
    const dayWorkouts = workouts.filter((w) => w.created_at.slice(0, 10) === d);
    for (const w of dayWorkouts) {
      const joints = stressForExercise(w.exercise_id);
      // Intensity proxy from count
      const intensity = w.count >= 20 ? 2 : w.count >= 8 ? 1 : 1;
      for (const j of joints) {
        loads[j] = Math.min(3, loads[j] + intensity);
      }
    }
    days.push({
      day: d,
      loads,
      soreness: checkinByDay.get(d) ?? null,
    });
  }
  return days;
}

export function summarizeJoints(week: DayLoad[]): JointSummary[] {
  const joints: Joint[] = ["wrist", "shoulder", "elbow", "core"];
  return joints.map((joint) => {
    // Weighted recent days more heavily
    let weighted = 0;
    let weightSum = 0;
    week.forEach((d, idx) => {
      const w = idx + 1; // later days heavier
      weighted += d.loads[joint] * w;
      weightSum += w * 3; // max load 3
    });
    const avgSoreness =
      week.reduce((s, d) => s + (d.soreness ?? 0), 0) /
      Math.max(1, week.filter((d) => d.soreness != null).length);
    let score = Math.round((weighted / Math.max(1, weightSum)) * 100);
    if (avgSoreness >= 4) score = Math.min(100, score + 20);
    else if (avgSoreness >= 3) score = Math.min(100, score + 10);

    const level = score >= 65 ? "red" : score >= 35 ? "yellow" : "green";
    const label =
      level === "red" ? "Stark belastet" : level === "yellow" ? "Leicht belastet" : "Erholt";
    return { joint, score, level, label };
  });
}
