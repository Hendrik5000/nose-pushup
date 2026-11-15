import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Alo-Health als gebündelte Gesundheits-/Fitness-Ansicht (Übergabe 15.11.2026, Aufgabe 4):
 * - Die Health-Route bündelt verstreute Fitness-Funktionen (Readiness, Erholung, Wasser,
 *   Stimmung, Gym-Besuche, Pausen-Timer) in einer eigenen "Fitness & Erholung"-Sektion.
 * - Beide Designvarianten (classic + sport) erhalten die Sektion und den Nav-Eintrag.
 * - Rein lesende Profilnutzung; keine DB-/Schema-/RLS-Änderung.
 */

const healthPath = resolve(__dirname, "../src/routes/_authenticated/health.tsx");
const health = readFileSync(healthPath, "utf8");

describe("Alo-Health: Fitness-Funktionen gebündelt", () => {
  it("bündelt die verstreuten Gesundheits-/Fitness-Komponenten", () => {
    expect(health).toContain('from "@/components/ReadinessCard"');
    expect(health).toContain('from "@/components/RecoveryCalendar"');
    expect(health).toContain('from "@/components/WaterTracker"');
    expect(health).toContain('from "@/components/MoodCheckin"');
    expect(health).toContain('from "@/components/GymVisitCalendar"');
    expect(health).toContain('from "@/components/SmartRestTimer"');
  });

  it("hat eine eigene Fitness-Sektion in beiden Designvarianten", () => {
    // einmal classic (health-classic-fitness), einmal sport (grid-Sektion)
    expect(health.match(/id="health-fitness"/g)?.length).toBe(2);
    expect(health).toContain("health-classic-fitness");
    expect(health).toContain("Fitness &amp; Erholung");
  });

  it("ergänzt den Fitness-Nav-Eintrag in beiden Varianten", () => {
    expect(health.match(/href="#health-fitness"/g)?.length).toBe(2);
    expect(health).toContain("<Dumbbell");
  });

  it("lädt Konto/Readiness-Grundlage nur lesend", () => {
    expect(health).toContain('.from("profiles")\n        .select("current_streak")');
    expect(health).not.toContain('.from("profiles")\n        .insert');
    expect(health).toContain('.upsert(payload, { onConflict: "user_id,day" })');
  });

  it("behält die bestehenden Health-Bereiche unverändert bei", () => {
    expect(health).toContain('createFileRoute("/_authenticated/health")');
    expect(health).toContain("<HealthConnectPanel />");
    expect(health).toContain("<SmartwatchPanel />");
    expect(health).toContain("<WeightTrendCard");
    expect(health).toContain("<SleepDebtCard");
    expect(health).toContain("<WeeklyStepsGoal");
  });

  it("startet den Smart Pausen-Timer nur auf ausdrückliche Aktion", () => {
    expect(health).toContain("Smart Pausen-Timer starten");
    expect(health).toContain("setShowRestTimer(true)");
  });
});
