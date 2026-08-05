---
name: Cali System Architecture
description: How the Calisthenics feature is structured — data model, progression logic, and integration points.
---

## Overview
Calisthenics is a full skill-progression system based on the "Zero to Planche in 229 Days" concept.

## Key files
- `src/lib/calisthenics.ts` — All skill tree data (CALI_PATHS), progression gate logic, fatigue calculation, check-in localStorage helpers.
- `src/lib/exercises.ts` — Cali skill IDs are also registered here as ExerciseConfig entries so the existing /workout/:id flow works.
- `src/components/CaliSkillTree.tsx` — Visual progression tree (locked/active/mastered states).
- `src/components/CaliCheckin.tsx` — Daily energy/soreness check-in (localStorage).
- `src/components/CaliLoadManager.tsx` — Fatigue traffic light based on 7-day workout count + avg soreness.
- `src/routes/_authenticated/calisthenics.tsx` — Hub page.

## Data model decisions
- **Personal bests**: stored in `profiles.personal_bests` JSONB as `{ "cali_tuck_planche": 12, ... }` (seconds for holds, reps for rep-based).
- **Check-ins**: localStorage key `cali_checkin_YYYY-MM-DD` — no extra DB table needed.
- **Fatigue**: computed client-side from Supabase workout count + localStorage check-in soreness scores.

## Progression gates
- A skill is LOCKED until `profiles.personal_bests[prerequisite_id] >= skill.unlock_threshold`.
- A skill is MASTERED when `profiles.personal_bests[skill.id] >= skill.mastery_threshold`.
- The workout flow saves reps/seconds to the `workouts` table (existing); the profile personal_bests must be updated separately after a workout (existing profile update logic handles this).

## Paths
Three paths: Planche (6 skills), Front Lever (5 skills), Handstand (4 skills).

**Why:**
The existing workout infrastructure already handles timer and touch detection types, so cali skills plug straight into `/workout/:exerciseId` without new routes.
