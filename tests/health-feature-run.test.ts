import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildHealthCsv } from "@/lib/health-export";
import { bmiCategory, calculateBmi } from "@/lib/body-metrics";
import { evaluateHealthMilestones } from "@/lib/health-milestones";
import { formatWeight, kgToLb, lbToKg } from "@/lib/weight-units";
import { summarizeSleep } from "@/lib/sleep-insights";

const entry = (over: Partial<{
  day: string;
  steps: number;
  active_kcal: number;
  weight_kg: number | null;
  sleep_min: number;
  source: string;
}>) => ({
  day: "2026-11-15",
  steps: 0,
  active_kcal: 0,
  weight_kg: null,
  sleep_min: 0,
  source: "manual",
  ...over,
});

describe("Feature-Lauf 15.11.: Health-Werkzeuge", () => {
  it("CSV-Export: Kopfzeile, Sortierung nach Tag, leeres Gewicht bleibt leer", () => {
    const csv = buildHealthCsv([
      entry({ day: "2026-11-15", steps: 8000, active_kcal: 400, weight_kg: 78.5, sleep_min: 450 }),
      entry({ day: "2026-11-14", steps: 3000, source: "health_connect" }),
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("datum,schritte,aktive_kcal,gewicht_kg,schlaf_min,quelle");
    expect(lines[1]).toContain("2026-11-14,3000,0,,0,health_connect");
    expect(lines[2]).toBe("2026-11-15,8000,400,78.5,450,manual");
  });

  it("BMI: plausibler Bereich, Kategorien", () => {
    expect(calculateBmi(78.5, 180)).toBeCloseTo(24.2, 1);
    expect(calculateBmi(78.5, 300)).toBeNull();
    expect(calculateBmi(10, 180)).toBeNull();
    expect(bmiCategory(17).label).toBe("Untergewicht");
    expect(bmiCategory(23).label).toBe("Normalgewicht");
    expect(bmiCategory(27).label).toBe("Übergewicht");
    expect(bmiCategory(35).label).toBe("Adipositas");
  });

  it("Meilensteine: 10k-Schritte und Schlafnächte werden erkannt", () => {
    const ms = evaluateHealthMilestones([
      entry({ day: "2026-11-10", steps: 10500 }),
      entry({ day: "2026-11-11", sleep_min: 420 }),
      entry({ day: "2026-11-12", sleep_min: 430 }),
      entry({ day: "2026-11-13", sleep_min: 440 }),
      entry({ day: "2026-11-14", sleep_min: 450 }),
      entry({ day: "2026-11-15", sleep_min: 460 }),
    ]);
    const steps = ms.find((m) => m.id === "steps-10k");
    expect(steps?.achieved).toBe(true);
    expect(steps?.achievedOn).toBe("2026-11-10");
    const sleep = ms.find((m) => m.id === "sleep-7");
    expect(sleep?.achieved).toBe(false);
  });

  it("kg/lb: Umrechnung und Formatierung", () => {
    expect(kgToLb(100)).toBeCloseTo(220.46, 2);
    expect(lbToKg(220.462)).toBeCloseTo(100, 1);
    expect(formatWeight(78.5, "kg")).toBe("78.5 kg");
    expect(formatWeight(78.5, "lb")).toBe("173.1 lb");
    expect(formatWeight(0, "kg")).toBe("—");
  });

  it("Schlaf-Insights: leer, regelmäßig, variabel", () => {
    expect(summarizeSleep([]).nights).toBe(0);
    const regular = summarizeSleep([
      entry({ day: "2026-11-13", sleep_min: 420 }),
      entry({ day: "2026-11-14", sleep_min: 430 }),
      entry({ day: "2026-11-15", sleep_min: 440 }),
    ]);
    expect(regular.consistency).toBe("regelmäßig");
    expect(regular.averageHours).toBeCloseTo(7.2, 1);
    const varied = summarizeSleep([
      entry({ day: "2026-11-13", sleep_min: 300 }),
      entry({ day: "2026-11-14", sleep_min: 540 }),
      entry({ day: "2026-11-15", sleep_min: 420 }),
    ]);
    expect(varied.consistency).toBe("variabel");
  });

  it("Integration: HealthToolbox existiert und ist in beiden Varianten eingebunden", () => {
    const component = readFileSync(
      resolve(__dirname, "../src/components/HealthToolbox.tsx"),
      "utf8",
    );
    expect(component).toContain("export function HealthToolbox");
    expect(component).toContain("downloadHealthCsv");
    expect(component).not.toContain("supabase");
    const health = readFileSync(
      resolve(__dirname, "../src/routes/_authenticated/health.tsx"),
      "utf8",
    );
    expect(health).toContain('from "@/components/HealthToolbox"');
    expect(health.match(/<HealthToolbox entries={entries} \/>/g)?.length).toBe(2);
  });
});
