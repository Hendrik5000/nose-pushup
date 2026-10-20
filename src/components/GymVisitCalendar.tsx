import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getGymVisits, setGymVisit } from "@/lib/gym-partner";
import {
  countUniqueGymDays,
  localDateFromKey,
  localDayKey,
  mondayFirstMonthGrid,
  mondayWeekRange,
  monthDayRange,
  type GymDayKey,
} from "@/lib/gym-calendar";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MIN_MONTH = new Date(2000, 0, 1, 12);

type CalendarData = {
  queryKey: string;
  status: "loading" | "ready" | "error";
  monthDays: GymDayKey[];
  weekDays: GymDayKey[];
  error?: string;
};

const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45";

export function GymVisitCalendar({
  userId,
  enabled = true,
  refreshKey,
}: {
  userId: string;
  enabled?: boolean;
  refreshKey?: string | number;
}) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1, 12);
  });
  const [data, setData] = useState<CalendarData | null>(null);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const busyRef = useRef(false);

  const monthRange = useMemo(() => monthDayRange(month), [month]);
  const weekRange = mondayWeekRange(new Date());
  const today = localDayKey(new Date());
  const queryKey = `${userId}|${monthRange.startDay}|${weekRange.startDay}|${today}`;
  const monthGrid = useMemo(() => mondayFirstMonthGrid(month), [month]);
  const atMinimumMonth = month.getFullYear() === 2000 && month.getMonth() === 0;
  const currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12);
  const atCurrentMonth =
    month.getFullYear() === currentMonth.getFullYear() &&
    month.getMonth() === currentMonth.getMonth();

  useEffect(() => {
    const request = ++generation.current;
    let cancelled = false;
    if (!enabled || !userId) {
      setData(null);
      return () => {
        cancelled = true;
      };
    }

    setData({ queryKey, status: "loading", monthDays: [], weekDays: [] });
    void Promise.all([
      getGymVisits(monthRange.startDay, monthRange.endDay),
      getGymVisits(weekRange.startDay, weekRange.endDay),
    ])
      .then(([monthDays, weekDays]) => {
        if (cancelled || generation.current !== request) return;
        setData({ queryKey, status: "ready", monthDays, weekDays });
      })
      .catch((error: unknown) => {
        if (cancelled || generation.current !== request) return;
        // Clear all displayed visit data on error; backend schema errors are shown verbatim.
        setData({
          queryKey,
          status: "error",
          monthDays: [],
          weekDays: [],
          error:
            error instanceof Error
              ? error.message
              : "Gym-Besuche konnten nicht geladen werden. Bitte versuche es erneut.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    userId,
    queryKey,
    monthRange.startDay,
    monthRange.endDay,
    weekRange.startDay,
    weekRange.endDay,
    refreshKey,
    retry,
  ]);

  const ownedData = data?.queryKey === queryKey ? data : null;
  const isLoading = !ownedData || ownedData.status === "loading";
  const isError = ownedData?.status === "error";
  const monthDays = ownedData?.status === "ready" ? ownedData.monthDays : [];
  const weekDays = ownedData?.status === "ready" ? ownedData.weekDays : [];
  const monthVisitSet = new Set(
    monthDays.filter((day) => day >= monthRange.startDay && day <= monthRange.endDay),
  );
  const hasVisit = (day: GymDayKey) =>
    day >= monthRange.startDay && day <= monthRange.endDay
      ? monthVisitSet.has(day)
      : weekDays.includes(day);
  const monthCount = countUniqueGymDays(monthDays, monthRange.startDay, monthRange.endDay);
  const weekCount = countUniqueGymDays(weekDays, weekRange.startDay, weekRange.endDay);

  const changeMonth = (offset: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1, 12);
    const latest = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12);
    if (next < MIN_MONTH || next > latest) return;
    setMonth(next);
  };

  const toggleVisit = async (day: GymDayKey) => {
    if (busyRef.current || day > today || isLoading || isError || !enabled || !userId) return;
    busyRef.current = true;
    setBusy(true);
    // Remove the currently displayed owner's data while the write is in flight.
    setData({ queryKey, status: "loading", monthDays: [], weekDays: [] });
    try {
      await setGymVisit(day, !hasVisit(day));
      setRetry((value) => value + 1);
    } catch (error) {
      setData({
        queryKey,
        status: "error",
        monthDays: [],
        weekDays: [],
        error:
          error instanceof Error
            ? error.message
            : "Der Gym-Besuch konnte nicht gespeichert werden. Bitte versuche es erneut.",
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (!enabled || !userId) return null;

  const monthTitle = month.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  const todayVisited = hasVisit(today);

  return (
    <section
      className="rounded-2xl border border-border bg-card p-4 sm:p-5"
      aria-labelledby="gym-visit-calendar-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Dein privater Verlauf
          </p>
          <h3 id="gym-visit-calendar-title" className="mt-1 text-lg font-bold">
            Gym-Besuche
          </h3>
        </div>
        <button
          type="button"
          className={`${buttonClass} shrink-0 bg-primary/10 text-primary`}
          disabled={busy || isLoading || isError}
          onClick={() => void toggleVisit(today)}
        >
          {todayVisited ? "Heutigen Besuch entfernen" : "Heute markieren"}
        </button>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        Ein Gym-Tag zählt einmal. Gespeicherte Gym-Sätze markieren den Tag automatisch; du kannst
        Besuche auch ohne Partner nachtragen. Das Entfernen ändert nur den Besuchsmarker, nicht
        gespeicherte Sätze oder deinen Verlauf.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Diese Woche</p>
          <p className="mt-1 text-xl font-bold tabular-nums" aria-live="polite">
            {isLoading ? "–" : isError ? "–" : weekCount}
            <span className="ml-1 text-sm font-medium text-muted-foreground">Tage</span>
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Im angezeigten Monat</p>
          <p className="mt-1 text-xl font-bold tabular-nums" aria-live="polite">
            {isLoading ? "–" : isError ? "–" : monthCount}
            <span className="ml-1 text-sm font-medium text-muted-foreground">Tage</span>
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          className={buttonClass}
          aria-label="Vorheriger Monat"
          disabled={atMinimumMonth || busy}
          onClick={() => changeMonth(-1)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span className="ml-1 hidden sm:inline">Zurück</span>
        </button>
        <h4 className="min-w-0 text-center text-base font-semibold capitalize" aria-live="polite">
          {monthTitle}
        </h4>
        <button
          type="button"
          className={buttonClass}
          aria-label="Nächster Monat"
          disabled={atCurrentMonth || busy}
          onClick={() => changeMonth(1)}
        >
          <span className="mr-1 hidden sm:inline">Weiter</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div
        className="mt-3 grid grid-cols-7 gap-1"
        role="group"
        aria-label={`Gym-Besuche im ${monthTitle}`}
      >
        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            aria-hidden="true"
            className="py-1 text-center text-xs font-medium text-muted-foreground"
          >
            {weekday}
          </div>
        ))}
        {monthGrid.map((day, index) => {
          if (!day)
            return <div key={`empty-${index}`} aria-hidden="true" className="aspect-square" />;
          const visited = monthVisitSet.has(day);
          const future = day > today;
          const date = localDateFromKey(day)!;
          const spokenDate = date.toLocaleDateString("de-DE", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          return (
            <div key={day} className="min-w-0">
              <button
                type="button"
                aria-label={`${spokenDate} · ${visited ? "besucht" : "nicht besucht"}`}
                aria-pressed={visited}
                aria-current={day === today ? "date" : undefined}
                disabled={busy || isLoading || isError || future}
                onClick={() => void toggleVisit(day)}
                className={`flex aspect-square w-full items-center justify-center rounded-xl border text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  visited
                    ? "border-primary bg-primary font-bold text-primary-foreground"
                    : future
                      ? "cursor-not-allowed border-transparent bg-muted/30 text-muted-foreground/45"
                      : "border-border bg-background text-foreground hover:border-primary/60 hover:bg-primary/5"
                } ${day === today ? "ring-1 ring-primary ring-offset-1 ring-offset-background" : ""}`}
              >
                {date.getDate()}
              </button>
            </div>
          );
        })}
      </div>

      {isError ? (
        <div role="alert" className="mt-3 rounded-xl border border-destructive/40 p-3 text-sm">
          <p>{ownedData?.error ?? "Gym-Besuche konnten nicht geladen werden."}</p>
          <button
            type="button"
            className="mt-2 min-h-11 font-semibold text-primary"
            onClick={() => setRetry((value) => value + 1)}
          >
            Erneut versuchen
          </button>
        </div>
      ) : isLoading ? (
        <p className="mt-3 text-center text-sm text-muted-foreground" role="status">
          Lade Gym-Kalender …
        </p>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Tippe einen vergangenen Tag oder heute an, um den Besuch ein- oder auszutragen. Ein Besuch
          pro Tag.
        </p>
      )}
    </section>
  );
}
