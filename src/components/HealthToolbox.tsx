/**
 * Health-Werkzeugkasten (Feature-Lauf 15.11.2026): bündelt fünf neue, rein clientseitige
 * Funktionen ohne Datenbankänderung:
 * 1. CSV-Export der Gesundheitsdaten
 * 2. BMI-Rechner mit gerätelokal gespeicherter Körpergröße
 * 3. Gesundheits-Meilensteine
 * 4. kg/lb-Einheiten-Umschalter
 * 5. Schlaf-Insights
 */
import { useMemo, useState } from "react";
import { Download, Ruler, Trophy, Scale, Moon } from "lucide-react";
import { buildHealthCsv, downloadHealthCsv, type HealthExportEntry } from "@/lib/health-export";
import {
  bmiCategory,
  calculateBmi,
  getStoredHeightCm,
  setStoredHeightCm,
} from "@/lib/body-metrics";
import { evaluateHealthMilestones } from "@/lib/health-milestones";
import {
  formatWeight,
  getPreferredWeightUnit,
  kgToLb,
  lbToKg,
  setPreferredWeightUnit,
  type WeightUnit,
} from "@/lib/weight-units";
import { summarizeSleep } from "@/lib/sleep-insights";

const cardClass = "rounded-3xl border border-border bg-card/60 p-4 backdrop-blur";
const labelClass = "text-[10px] uppercase tracking-[0.2em] text-muted-foreground";

export function HealthToolbox({ entries }: { entries: HealthExportEntry[] }) {
  const [heightCm, setHeightCm] = useState<number | null>(() => getStoredHeightCm());
  const [heightInput, setHeightInput] = useState<string>(() =>
    getStoredHeightCm() != null ? String(getStoredHeightCm()) : "",
  );
  const [heightMsg, setHeightMsg] = useState<string | null>(null);
  const [unit, setUnit] = useState<WeightUnit>(() => getPreferredWeightUnit());
  const [convertInput, setConvertInput] = useState<string>("");
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const latestWeight = useMemo(() => {
    const withWeight = entries
      .filter((e) => e.weight_kg != null)
      .sort((a, b) => a.day.localeCompare(b.day));
    return withWeight.length ? (withWeight[withWeight.length - 1].weight_kg as number) : null;
  }, [entries]);

  const bmi = useMemo(
    () => (latestWeight != null && heightCm != null ? calculateBmi(latestWeight, heightCm) : null),
    [latestWeight, heightCm],
  );
  const bmiCat = bmi != null ? bmiCategory(bmi) : null;
  const milestones = useMemo(() => evaluateHealthMilestones(entries), [entries]);
  const sleep = useMemo(() => summarizeSleep(entries), [entries]);

  const saveHeight = () => {
    const value = Number(heightInput.replace(",", "."));
    if (heightInput.trim() === "") {
      setStoredHeightCm(null);
      setHeightCm(null);
      setHeightMsg("Körpergröße entfernt.");
      return;
    }
    if (!setStoredHeightCm(value)) {
      setHeightMsg("Bitte eine Größe zwischen 80 und 250 cm eingeben.");
      return;
    }
    setHeightCm(value);
    setHeightMsg("Körpergröße lokal gespeichert (nicht in der Datenbank).");
  };

  const runExport = () => {
    if (entries.length === 0) {
      setExportMsg("Noch keine Einträge zum Exportieren.");
      return;
    }
    downloadHealthCsv(entries);
    setExportMsg(`${entries.length} Einträge als CSV exportiert.`);
  };

  const changeUnit = (next: WeightUnit) => {
    setPreferredWeightUnit(next);
    setUnit(next);
  };

  const convertValue = Number(convertInput.replace(",", "."));
  const converted =
    Number.isFinite(convertValue) && convertValue > 0
      ? unit === "kg"
        ? `${kgToLb(convertValue).toFixed(1)} lb`
        : `${lbToKg(convertValue).toFixed(1)} kg`
      : null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <section className={cardClass} aria-labelledby="alo-health-export-title">
        <div className="flex items-center gap-2">
          <Download aria-hidden="true" className="h-4 w-4 text-primary" />
          <h3 id="alo-health-export-title" className={labelClass}>
            Datenexport (CSV)
          </h3>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Exportiere deine erfassten Gesundheitswerte als CSV – direkt aus diesem Browser.
        </p>
        <button
          type="button"
          onClick={runExport}
          className="mt-3 min-h-11 w-full rounded-xl border border-border bg-secondary/50 px-3 text-xs font-semibold"
        >
          CSV exportieren
        </button>
        {exportMsg && (
          <p role="status" className="mt-2 text-xs text-muted-foreground">
            {exportMsg}
          </p>
        )}
      </section>

      <section className={cardClass} aria-labelledby="alo-health-bmi-title">
        <div className="flex items-center gap-2">
          <Ruler aria-hidden="true" className="h-4 w-4 text-primary" />
          <h3 id="alo-health-bmi-title" className={labelClass}>
            BMI (lokal)
          </h3>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Körpergröße bleibt auf diesem Gerät gespeichert und wird nicht hochgeladen.
        </p>
        <div className="mt-3 flex gap-2">
          <label className="sr-only" htmlFor="alo-health-height-input">
            Körpergröße in Zentimetern
          </label>
          <input
            id="alo-health-height-input"
            type="number"
            min={80}
            max={250}
            inputMode="numeric"
            value={heightInput}
            onChange={(e) => setHeightInput(e.target.value)}
            placeholder="Größe in cm"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background/60 px-3 text-sm"
          />
          <button
            type="button"
            onClick={saveHeight}
            className="min-h-11 rounded-xl border border-border bg-secondary/50 px-3 text-xs font-semibold"
          >
            Speichern
          </button>
        </div>
        {bmi != null && bmiCat ? (
          <p className="mt-3 text-sm">
            <strong className="tabular-nums">{bmi.toFixed(1)}</strong>{" "}
            <span className="text-xs text-muted-foreground">
              · {bmiCat.label} · letztes Gewicht {formatWeight(latestWeight ?? 0, unit)}
            </span>
          </p>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            {latestWeight == null
              ? "BMI erscheint, sobald ein Gewicht erfasst ist."
              : "Ergänze deine Körpergröße für den BMI."}
          </p>
        )}
        {heightMsg && (
          <p role="status" className="mt-2 text-xs text-muted-foreground">
            {heightMsg}
          </p>
        )}
        <p className="mt-2 text-[10px] text-muted-foreground">
          BMI ist eine grobe Einordnung und keine medizinische Einschätzung.
        </p>
      </section>

      <section className={cardClass} aria-labelledby="alo-health-milestones-title">
        <div className="flex items-center gap-2">
          <Trophy aria-hidden="true" className="h-4 w-4 text-primary" />
          <h3 id="alo-health-milestones-title" className={labelClass}>
            Meilensteine
          </h3>
        </div>
        <ul className="mt-3 space-y-1.5">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
              <span
                className={m.achieved ? "font-medium text-foreground" : "text-muted-foreground"}
              >
                {m.achieved ? "✅" : "⬜"} {m.label}
              </span>
              {m.achievedOn && (
                <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
                  {new Date(m.achievedOn).toLocaleDateString("de-DE")}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className={cardClass} aria-labelledby="alo-health-units-title">
        <div className="flex items-center gap-2">
          <Scale aria-hidden="true" className="h-4 w-4 text-primary" />
          <h3 id="alo-health-units-title" className={labelClass}>
            kg / lb
          </h3>
        </div>
        <div className="mt-3 flex gap-2" role="group" aria-label="Gewichtseinheit">
          {(["kg", "lb"] as const).map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={unit === u}
              onClick={() => changeUnit(u)}
              className={`min-h-11 flex-1 rounded-xl border px-3 text-xs font-semibold ${
                unit === u ? "border-primary bg-primary/15" : "border-border bg-secondary/40"
              }`}
            >
              {u === "kg" ? "Kilogramm" : "Pfund (lb)"}
            </button>
          ))}
        </div>
        {latestWeight != null && (
          <p className="mt-2 text-xs text-muted-foreground">
            Letztes Gewicht: {formatWeight(latestWeight, unit)}
          </p>
        )}
        <div className="mt-2 flex gap-2">
          <label className="sr-only" htmlFor="alo-health-convert-input">
            Wert umrechnen
          </label>
          <input
            id="alo-health-convert-input"
            type="number"
            min={0}
            step="0.1"
            inputMode="decimal"
            value={convertInput}
            onChange={(e) => setConvertInput(e.target.value)}
            placeholder={`Wert in ${unit} umrechnen`}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background/60 px-3 text-sm"
          />
        </div>
        {converted && (
          <p role="status" className="mt-2 text-xs text-muted-foreground">
            = {converted}
          </p>
        )}
      </section>

      <section className={`${cardClass} sm:col-span-2`} aria-labelledby="alo-health-sleep-title">
        <div className="flex items-center gap-2">
          <Moon aria-hidden="true" className="h-4 w-4 text-primary" />
          <h3 id="alo-health-sleep-title" className={labelClass}>
            Schlaf-Insights
          </h3>
        </div>
        <p className="mt-2 text-sm">{sleep.message}</p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Nächte erfasst</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums">{sleep.nights}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Ø Dauer</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums">
              {sleep.averageHours != null ? `${sleep.averageHours.toFixed(1)} h` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Längste Nacht</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums">
              {sleep.bestNight ? `${sleep.bestNight.hours.toFixed(1)} h` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Regelmäßigkeit</dt>
            <dd className="mt-0.5 text-base font-semibold">{sleep.consistency}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
