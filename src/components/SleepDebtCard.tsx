import { sleepDebtHours } from "@/lib/extra-features";

export function SleepDebtCard({ sleepMinutes }: { sleepMinutes: number[] }) {
  const debt = sleepDebtHours(sleepMinutes);
  const ok = debt < 2;

  return (
    <section className="mt-4 rounded-3xl border border-border bg-card/60 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Schlafschuld
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{debt.toFixed(1)} h</div>
          <p className="mt-1 text-xs text-muted-foreground">
            {ok
              ? "Im grünen Bereich (Ziel 8 h/Nacht)."
              : "Aufholen mit einer längeren Nacht oder Power-Nap."}
          </p>
        </div>
        <span className="text-3xl">{ok ? "😴" : "😮‍💨"}</span>
      </div>
    </section>
  );
}
