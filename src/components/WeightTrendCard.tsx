export function WeightTrendCard({ points }: { points: Array<{ day: string; weight_kg: number }> }) {
  const data = points
    .filter((p) => p.weight_kg > 0)
    .slice(0, 14)
    .reverse();
  if (data.length < 2) {
    return (
      <section className="mt-4 rounded-3xl border border-border bg-card/60 p-4 text-sm text-muted-foreground">
        Gewichtstrend: mindestens 2 Einträge nötig (Health / manuell).
      </section>
    );
  }
  const weights = data.map((d) => d.weight_kg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const last = weights[weights.length - 1];
  const first = weights[0];
  const delta = last - first;

  return (
    <section className="mt-4 rounded-3xl border border-border bg-card/60 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Gewichtstrend
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{last.toFixed(1)} kg</div>
          <p className="text-xs text-muted-foreground">
            {delta === 0 ? "±0" : delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)} kg im
            Zeitraum
          </p>
        </div>
        <span className="text-3xl">⚖️</span>
      </div>
      <div className="mt-3 flex h-16 items-end gap-1">
        {data.map((d) => {
          const h = max === min ? 50 : ((d.weight_kg - min) / (max - min)) * 100;
          return (
            <div
              key={d.day}
              className="flex-1 rounded-t bg-primary/70"
              style={{ height: `${Math.max(8, h)}%` }}
              title={`${d.day}: ${d.weight_kg} kg`}
            />
          );
        })}
      </div>
    </section>
  );
}
