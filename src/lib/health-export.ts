/**
 * CSV-Export der eigenen Gesundheitsdaten (Feature-Lauf 15.11.2026).
 * Rein clientseitig aus den bereits geladenen Einträgen; keine DB-Änderung.
 */

export type HealthExportEntry = {
  day: string;
  steps: number;
  active_kcal: number;
  weight_kg: number | null;
  sleep_min: number;
  source: string;
};

const CSV_HEADER = "datum,schritte,aktive_kcal,gewicht_kg,schlaf_min,quelle";

function csvEscape(value: string): string {
  return value.includes(",") || value.includes('"') || value.includes("\n")
    ? `"${value.replace(/"/g, '""')}"`
    : value;
}

/** Baut ein stabiles, deutsch lesbare CSV (Daten aufsteigend nach Tag). */
export function buildHealthCsv(entries: HealthExportEntry[]): string {
  const sorted = [...entries].sort((a, b) => a.day.localeCompare(b.day));
  const rows = sorted.map((e) =>
    [
      e.day,
      String(Math.max(0, e.steps)),
      String(Math.max(0, e.active_kcal)),
      e.weight_kg == null ? "" : e.weight_kg.toFixed(1),
      String(Math.max(0, e.sleep_min)),
      csvEscape(e.source || "manual"),
    ].join(","),
  );
  return [CSV_HEADER, ...rows].join("\n");
}

/** Löst den Browser-Download der CSV aus (nur im Browser aufrufen). */
export function downloadHealthCsv(
  entries: HealthExportEntry[],
  filename = "alo-gesundheitsdaten.csv",
): void {
  const csv = buildHealthCsv(entries);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
