import { sleepDebtHours } from "@/lib/extra-features";

export function SleepDebtCard({ sleepMinutes }: { sleepMinutes: number[] }) {
  const measured = sleepMinutes.filter((minutes) => Number.isFinite(minutes) && minutes > 0);
  const hasData = measured.length > 0;
  const debt = sleepDebtHours(measured);
  const ok = debt < 2;

  return (
    <section className="mt-4 rounded-3xl border border-border bg-card/60 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Schlafschuld
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums">
            {hasData ? `${debt.toFixed(1)} h` : "Noch keine Schlafdaten"}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {!hasData
              ? "Erfasse oder synchronisiere deinen Schlaf für eine Einschätzung."
              : ok
                ? "Im grünen Bereich (Ziel 8 h/Nacht)."
                : "Aufholen mit einer längeren Nacht oder Power-Nap."}
          </p>
          {hasData && (
            <p className="mt-1 text-xs text-muted-foreground">
              Basis: {measured.length} erfasste Nächte · fehlende Nächte nicht bewertet.
            </p>
          )}
        </div>
        <span className="text-3xl">{!hasData ? "—" : ok ? "😴" : "😮‍💨"}</span>
      </div>
    </section>
  );
}
