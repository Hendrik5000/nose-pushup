import { useReadiness } from "@/hooks/useReadiness";
import type { Readiness } from "@/lib/readiness";

export function ReadinessCard(props: {
  streak: number;
  onReadinessChange?: (readiness: Readiness) => void;
}) {
  return <ReadinessSummary {...useReadiness(props)} />;
}

export function ReadinessSummary({ readiness, history, asOf }: ReturnType<typeof useReadiness>) {
  if (!readiness) return null;
  const barColor = readiness.available ? "bg-primary" : "bg-secondary";

  return (
    <section
      className="rounded-3xl border border-border bg-card/60 p-4 backdrop-blur"
      aria-labelledby="readiness-title"
    >
      <div className="flex items-center justify-between gap-3">
        <div
          className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
          id="readiness-title"
        >
          Tagesform (Readiness)
        </div>
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="text-lg">
            {readiness.emoji}
          </span>
          <span className="text-sm font-semibold">
            {readiness.available ? `${readiness.score} / 100` : "Basisplan bis mehr Daten"}
          </span>
        </div>
      </div>
      {readiness.available && (
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary"
          role="meter"
          aria-label="Readiness-Wert"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={readiness.score}
        >
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${readiness.score}%` }}
          />
        </div>
      )}
      <div className="mt-3">
        <div className="text-sm font-semibold text-foreground">{readiness.label}</div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{readiness.detail}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Trainingsschätzung, keine Messung deiner körperlichen Erholung und keine medizinische
          Empfehlung.
        </p>
      </div>
      <details className="mt-3 border-t border-border pt-3">
        <summary className="cursor-pointer text-xs font-medium text-primary">
          Berechnung & Datenstand
        </summary>
        <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          <p>
            {readiness.available
              ? `Datenquellen (${readiness.dataCoverage}/2): ${readiness.sources.join(", ")}.`
              : `Erfasst (${readiness.dataCoverage}/2): ${readiness.sources.length ? readiness.sources.join(", ") : "keine der zwei Readiness-Quellen"}. Beide accountgebundenen Quellen sind nötig.`}
          </p>
          {readiness.available && readiness.missingSources.length > 0 && (
            <p>Nicht vorhanden: {readiness.missingSources.join(", ")}.</p>
          )}
          <p>
            Berechnung: Schlaf (bis 30), Trainingshäufigkeit der letzten 7 Tage (bis 25),
            Streak-Bonus (bis 15); die verfügbaren gewichteten Punkte werden auf 100 normiert. Ein
            Score entsteht erst, wenn Schlaf und Workout-Abfrage vorliegen.
          </p>
          <p>
            Schritte und geräte-lokale Check-ins werden nicht in den Wert einbezogen: Check-ins sind
            nicht an dieses Konto gebunden. Fehlende Schlaf-/Workout-Daten werden nicht durch Streak
            oder Bestwert ersetzt.
          </p>
          <p>
            Zuletzt berechnet: {asOf ?? "—"}. Verlauf lokal auf diesem Gerät, aber nach Konto
            getrennt. Gespeicherte Workouts werden nach ihrem Zeitstempel gezählt.
          </p>
        </div>
      </details>
      {history.length > 1 && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            Letzte {history.length} berechnete Tage (Wert / 100)
          </div>
          <ol className="mt-2 flex h-10 items-end gap-1" aria-label="Readiness-Verlauf">
            {history.map((h) => (
              <li
                key={h.day}
                title={`${h.day}: ${h.score} / 100`}
                aria-label={`${h.day}: ${h.score} von 100`}
                className="flex flex-1 flex-col justify-end"
              >
                <span className="mb-1 text-center text-[8px] text-muted-foreground">{h.score}</span>
                <div
                  className="rounded-sm bg-primary/60"
                  style={{ height: `${Math.max(15, h.score)}%` }}
                />
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
