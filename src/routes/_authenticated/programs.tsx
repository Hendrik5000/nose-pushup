import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { ShareCard } from "@/components/ShareCard";

export const Route = createFileRoute("/_authenticated/programs")({
  head: () => ({
    meta: [
      { title: "Trainingsprogramme — Nosy Push-Ups" },
      {
        name: "description",
        content:
          "Mehrwöchige Push-Up- und Core-Programme mit Tagesplan, Sätzen, Pausen-Timer und Abschluss-Zertifikat.",
      },
      { property: "og:title", content: "Trainingsprogramme — Nosy Push-Ups" },
      {
        property: "og:description",
        content: "Folge einem Programm: Tagesplan, Sätze, Pausen-Timer, Zertifikat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProgramsPage,
});

type Program = {
  id: string;
  title: string;
  description: string;
  weeks: number;
  level: string;
  icon: string;
};

type ProgramDay = {
  id: string;
  program_id: string;
  day_index: number;
  focus: string;
  exercise_id: string | null;
  sets: number;
  reps: number;
  rest_s: number;
  note: string;
};

type UserProgram = {
  id: string;
  program_id: string;
  started_on: string;
  current_day: number;
  completed_at: string | null;
};

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Einsteiger",
  intermediate: "Fortgeschritten",
  advanced: "Profi",
};

function ProgramsPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [days, setDays] = useState<ProgramDay[]>([]);
  const [active, setActive] = useState<UserProgram | null>(null);
  const [doneDays, setDoneDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rest, setRest] = useState<number | null>(null);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setUserId(u.user.id);

    const [{ data: progs }, { data: ds }, { data: up }] = await Promise.all([
      supabase.from("programs").select("*").order("sort_order"),
      supabase.from("program_days").select("*").order("day_index"),
      supabase
        .from("user_programs")
        .select("id, program_id, started_on, current_day, completed_at")
        .eq("user_id", u.user.id)
        .is("completed_at", null)
        .maybeSingle(),
    ]);

    setPrograms((progs ?? []) as Program[]);
    setDays((ds ?? []) as ProgramDay[]);
    setActive((up ?? null) as UserProgram | null);

    if (up) {
      const { data: done } = await supabase
        .from("user_program_days")
        .select("day_index")
        .eq("user_program_id", up.id);
      setDoneDays((done ?? []).map((d) => d.day_index as number));
    } else {
      setDoneDays([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Pausen-Timer
  useEffect(() => {
    if (rest === null) return;
    if (rest <= 0) {
      setRest(null);
      return;
    }
    const t = setTimeout(() => setRest((r) => (r === null ? null : r - 1)), 1000);
    return () => clearTimeout(t);
  }, [rest]);

  const activeProgram = programs.find((p) => p.id === active?.program_id) ?? null;
  const programDays = useMemo(
    () => days.filter((d) => d.program_id === active?.program_id),
    [days, active],
  );
  const totalDays = programDays.length;
  const today = programDays.find((d) => d.day_index === active?.current_day) ?? null;
  const progressPct = totalDays > 0 ? Math.min(1, doneDays.length / totalDays) : 0;

  const startProgram = async (programId: string) => {
    if (!userId || busy) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("user_programs")
      .upsert(
        { user_id: userId, program_id: programId, current_day: 1, completed_at: null },
        { onConflict: "user_id,program_id" },
      )
      .select("id, program_id, started_on, current_day, completed_at")
      .maybeSingle();
    if (!error && data) {
      setActive(data as UserProgram);
      setDoneDays([]);
    }
    setBusy(false);
  };

  const completeDay = async (repsDone: number) => {
    if (!userId || !active || !today || busy) return;
    setBusy(true);
    await supabase.from("user_program_days").insert({
      user_id: userId,
      user_program_id: active.id,
      day_index: today.day_index,
      reps_done: repsDone,
    });
    const nextDay = today.day_index + 1;
    const finished = nextDay > totalDays;
    await supabase
      .from("user_programs")
      .update({
        current_day: finished ? totalDays : nextDay,
        completed_at: finished ? new Date().toISOString() : null,
      })
      .eq("id", active.id);
    setBusy(false);
    await load();
  };

  const skipDay = async () => {
    if (!active || !today || busy) return;
    setBusy(true);
    await supabase
      .from("user_programs")
      .update({ current_day: Math.min(totalDays, today.day_index + 1) })
      .eq("id", active.id);
    setBusy(false);
    await load();
  };

  const quitProgram = async () => {
    if (!active) return;
    setBusy(true);
    await supabase.from("user_programs").delete().eq("id", active.id);
    setActive(null);
    setDoneDays([]);
    setBusy(false);
  };

  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Programme
          </div>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight">Dein Trainingsplan</h1>
        </div>
        <Link
          to="/"
          className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground"
        >
          Zurück
        </Link>
      </header>

      {loading && (
        <div className="mt-6 rounded-2xl border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
          Lade…
        </div>
      )}

      {/* Aktives Programm */}
      {!loading && active && activeProgram && (
        <section className="mt-5 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-primary">
                Läuft gerade
              </div>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">{activeProgram.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Tag {active.current_day} von {totalDays} · {doneDays.length} erledigt
              </p>
            </div>
            <span className="text-4xl">{activeProgram.icon}</span>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPct * 100}%` }}
            />
          </div>

          {today ? (
            <div className="mt-4 rounded-2xl border border-border bg-background/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Heute · {today.focus}
                </span>
                {doneDays.includes(today.day_index) && (
                  <span className="text-[10px] font-semibold text-primary">erledigt</span>
                )}
              </div>
              <div className="mt-2 text-lg font-semibold">
                {today.sets > 0
                  ? `${today.sets} × ${today.reps || "max"} ${
                      today.exercise_id === "plank" ? "Sek." : "Wdh."
                    }`
                  : "Pause / Mobilität"}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{today.note}</p>

              {today.rest_s > 0 && (
                <button
                  onClick={() => setRest(today.rest_s)}
                  className="mt-3 w-full rounded-xl border border-border bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground"
                >
                  {rest !== null ? `Pause… ${rest}s` : `Pausen-Timer (${today.rest_s}s)`}
                </button>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                {today.exercise_id ? (
                  <button
                    onClick={() =>
                      navigate({
                        to: "/workout/$exerciseId",
                        params: { exerciseId: today.exercise_id as string },
                      })
                    }
                    className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98]"
                  >
                    Session starten
                  </button>
                ) : (
                  <button
                    onClick={() => completeDay(0)}
                    disabled={busy}
                    className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Ruhetag abhaken
                  </button>
                )}
                <button
                  onClick={() => completeDay(today.sets * today.reps)}
                  disabled={busy || doneDays.includes(today.day_index)}
                  className="rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground disabled:opacity-50"
                >
                  Tag erledigt
                </button>
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                <button onClick={skipDay} className="underline">
                  Tag nachholen/überspringen
                </button>
                <button onClick={quitProgram} className="underline">
                  Programm beenden
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-center">
              <div className="text-3xl">🏅</div>
              <div className="mt-1 text-sm font-semibold">Programm abgeschlossen!</div>
            </div>
          )}

          {/* Tagesübersicht */}
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {programDays.map((d) => {
              const done = doneDays.includes(d.day_index);
              const isToday = d.day_index === active.current_day;
              return (
                <div
                  key={d.id}
                  className={`flex h-8 items-center justify-center rounded-lg text-[11px] font-semibold ${
                    done
                      ? "bg-primary text-primary-foreground"
                      : isToday
                        ? "border border-primary text-primary"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {d.day_index}
                </div>
              );
            })}
          </div>

          {doneDays.length >= totalDays && totalDays > 0 && (
            <div className="mt-4">
              <ShareCard
                label="Zertifikat teilen"
                stats={{
                  title: "Programm abgeschlossen",
                  headline: activeProgram.title,
                  subline: `${totalDays} Tage durchgezogen`,
                  rows: [
                    { label: "Programm", value: activeProgram.title },
                    { label: "Dauer", value: `${activeProgram.weeks} Wochen` },
                    { label: "Tage erledigt", value: `${doneDays.length}` },
                  ],
                }}
              />
            </div>
          )}
        </section>
      )}

      {/* Programmauswahl */}
      {!loading && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {active ? "Andere Programme" : "Programm wählen"}
          </h2>
          <div className="space-y-3">
            {programs
              .filter((p) => p.id !== active?.program_id)
              .map((p) => {
                const count = days.filter((d) => d.program_id === p.id).length;
                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-border bg-card/50 p-4 backdrop-blur"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{p.icon}</span>
                          <span className="text-base font-semibold">{p.title}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                        <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          {p.weeks} Wochen · {count} Tage · {LEVEL_LABEL[p.level] ?? p.level}
                        </div>
                      </div>
                      <button
                        onClick={() => startProgram(p.id)}
                        disabled={busy || !!active}
                        className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
                      >
                        Starten
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
          {active && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Beende zuerst dein laufendes Programm, um ein neues zu starten.
            </p>
          )}
        </section>
      )}

      <BottomNav />
    </main>
  );
}
