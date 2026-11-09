import type { TrainingWeekDay } from "@/lib/training-dates";

export function TrainingWeekActivity({
  days,
  dailyGoal,
}: {
  days: readonly TrainingWeekDay[];
  dailyGoal: number;
}) {
  const safeDailyGoal = Number.isFinite(dailyGoal) && dailyGoal > 0 ? dailyGoal : 1;

  return (
    <section className="mt-4 rounded-2xl border border-border/70 bg-background/45 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-foreground">Aktivität je Tag</h4>
        <span className="rounded-full bg-secondary/70 px-2 py-1 text-[10px] font-medium text-muted-foreground">
          Mo–So
        </span>
      </div>
      <ol
        aria-label="Trainingsaktivität je Wochentag"
        className="grid grid-cols-7 gap-1 sm:gap-1.5"
      >
        {days.map((day) => {
          const [year, month, date] = day.dateKey.split("-").map(Number);
          const localDate = new Date(year, month - 1, date, 12);
          const shortWeekday = new Intl.DateTimeFormat("de-DE", { weekday: "short" })
            .format(localDate)
            .replace(/\.$/, "");
          const fullDate = new Intl.DateTimeFormat("de-DE", {
            weekday: "long",
            day: "numeric",
            month: "long",
          }).format(localDate);
          const isOpenFutureDay = day.isFuture && day.reps === 0;
          const accessibleSummary = `${fullDate}${day.isToday ? ", heute" : ""}: ${
            isOpenFutureDay ? "noch offen" : `${day.reps.toLocaleString("de-DE")} Wiederholungen`
          }`;
          const barHeight =
            day.reps > 0 ? Math.min(100, Math.max(6, (day.reps / safeDailyGoal) * 100)) : 0;

          return (
            <li
              key={day.dateKey}
              data-week-day={day.dateKey}
              data-week-state={day.isToday ? "today" : day.isFuture ? "future" : "past"}
              className={`min-w-0 rounded-xl border px-0.5 pb-1 pt-1.5 text-center transition-colors ${
                day.isToday ? "border-primary/25 bg-primary/5" : "border-transparent bg-transparent"
              }`}
            >
              <span className="sr-only">{accessibleSummary}</span>
              <span
                aria-hidden="true"
                className={`block truncate text-[10px] font-semibold uppercase tracking-wide ${
                  day.isToday ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {shortWeekday}
              </span>
              <div
                aria-hidden="true"
                className="mt-2 flex h-12 items-end overflow-hidden rounded-lg bg-secondary/55 p-1"
              >
                <span
                  className={`block w-full rounded-md transition-[height] duration-300 ${
                    day.isToday ? "bg-primary" : "bg-primary/55"
                  }`}
                  style={{
                    height: `${barHeight}%`,
                    minHeight: day.reps > 0 ? "3px" : 0,
                  }}
                />
              </div>
              <span
                aria-hidden="true"
                className={`mt-1.5 block truncate text-[9px] font-medium tabular-nums ${
                  day.isToday ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {isOpenFutureDay ? "—" : day.reps.toLocaleString("de-DE")}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        Balken bis zum Tagesziel · „—“ = noch offen
      </p>
    </section>
  );
}
