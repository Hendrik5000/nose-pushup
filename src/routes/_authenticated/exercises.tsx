import { DesignView } from "@/components/DesignView";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ExerciseMeta } from "@/lib/exercises";
import { BottomNav } from "@/components/BottomNav";
import { CALI_PATHS, getSkillStatus } from "@/lib/calisthenics";
import { SportPageIntro, SportSectionLabel } from "@/components/SportPageIntro";
import { Activity, ArrowUpRight, Dumbbell, Footprints, Timer, Zap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/exercises")({
  head: () => ({
    meta: [
      { title: "Übungen — Alo" },
      {
        name: "description",
        content:
          "Alle Übungen im Überblick: Calisthenics, Push-Up, Sit-Up, Squat, Plank und Burpee.",
      },
      { property: "og:title", content: "Übungen — Alo" },
      { property: "og:description", content: "Wähle eine Übung und starte dein Workout." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExercisesPage,
});

type Profile = { personal_bests: Record<string, number> | null; best_count: number };

const DETECTION_LABEL: Record<ExerciseMeta["detection_type"], string> = {
  touch: "Touch",
  motion_vertical: "Sensor",
  timer: "Timer",
  combo: "Kombi",
};

function ExercisesPage() {
  const [exercises, setExercises] = useState<ExerciseMeta[]>([]);
  const [bests, setBests] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const [{ data: ex }, profileRes] = await Promise.all([
        supabase.from("exercises").select("*").order("sort_order"),
        u.user
          ? supabase
              .from("profiles")
              .select("personal_bests, best_count")
              .eq("id", u.user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (ex) setExercises(ex as ExerciseMeta[]);
      const p = (profileRes as { data: Profile | null }).data;
      if (p) {
        const pb = { ...(p.personal_bests ?? {}) };
        if (p.best_count && !pb.pushup) pb.pushup = p.best_count;
        setBests(pb);
      }
      setLoading(false);
    })();
  }, []);

  // ── Cali summary stats ──────────────────────────────────────────────────────
  const totalCaliSkills = CALI_PATHS.flatMap((p) => p.skills).length;
  const masteredCaliSkills = CALI_PATHS.flatMap((p) =>
    p.skills.filter((s) => getSkillStatus(bests, s) === "mastered"),
  ).length;
  const activeCaliSkill = CALI_PATHS.flatMap((p) =>
    p.skills.filter((s) => getSkillStatus(bests, s) === "active"),
  )[0];

  return (
    <>
      <DesignView variant="sport">
        <main className="sport-only alo-tablet-training mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col gap-7 px-5 py-6 sm:px-8">
          <SportPageIntro
            eyebrow="TRAININGSBEREICH · 01"
            title="Wähle deinen Fokus"
            description="Jede Wiederholung zählt. Entscheide dich für einen Skill oder starte eine klassische Session."
          >
            <Link to="/" className="sport-back-link">
              ← Startseite
            </Link>
          </SportPageIntro>
          <section className="sport-feature-card rounded-[2rem] border border-border bg-card/70 p-6 sm:p-8">
            <SportSectionLabel number="01">Skill-Progression</SportSectionLabel>
            <Link
              to="/calisthenics"
              className="group mt-5 block rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/20 via-card/70 to-card/50 p-6 transition hover:border-primary/70 sm:p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                    <Activity size={16} /> Progression System{" "}
                    <span className="rounded-full bg-primary/15 px-2 py-1 text-[9px]">NEU</span>
                  </div>
                  <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                    Calisthenics
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    Planche · Front Lever · Handstand — strukturiertes Skill-Training mit
                    Progression Gates, Belastungssteuerung und täglichem Check-in.
                  </p>
                </div>
                <ArrowUpRight className="mt-1 shrink-0 text-primary" size={24} />
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {CALI_PATHS.map((path, i) => {
                  const mastered = path.skills.filter(
                    (skill) => getSkillStatus(bests, skill) === "mastered",
                  ).length;
                  const Icon = [Dumbbell, Activity, Zap][i % 3];
                  return (
                    <div
                      key={path.id}
                      className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/40 p-3"
                    >
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Icon size={20} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{path.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {mastered}/{path.skills.length} Skills
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6">
                <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                  <span>Skills gemeistert</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {masteredCaliSkills} / {totalCaliSkills}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700"
                    style={{
                      width: `${totalCaliSkills > 0 ? (masteredCaliSkills / totalCaliSkills) * 100 : 0}%`,
                    }}
                  />
                </div>
                {activeCaliSkill && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Nächster Skill:{" "}
                    <span className="font-semibold text-foreground">{activeCaliSkill.name}</span>
                  </p>
                )}
              </div>
            </Link>
          </section>
          <section className="space-y-4">
            <SportSectionLabel number="02">Klassische Übungen</SportSectionLabel>
            {loading && (
              <div className="rounded-3xl border border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
                Übungen werden geladen …
              </div>
            )}
            {!loading && exercises.filter((ex) => !ex.id.startsWith("cali_")).length === 0 && (
              <div className="rounded-3xl border border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
                Keine Übungen verfügbar.
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {exercises
                .filter((ex) => !ex.id.startsWith("cali_"))
                .map((ex) => {
                  const best = bests[ex.id] ?? 0;
                  const Icon =
                    ex.detection_type === "timer"
                      ? Timer
                      : ex.detection_type === "motion_vertical"
                        ? Activity
                        : ex.detection_type === "combo"
                          ? Zap
                          : Dumbbell;
                  return (
                    <Link
                      key={ex.id}
                      to="/workout/$exerciseId"
                      params={{ exerciseId: ex.id }}
                      className="group flex min-h-36 items-center gap-4 rounded-3xl border border-border bg-card/55 p-5 transition hover:border-primary/50 hover:bg-card/80"
                    >
                      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                        <Icon size={26} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-bold">{ex.name}</span>
                          <span className="rounded-full border border-border bg-secondary/60 px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                            {DETECTION_LABEL[ex.detection_type]}
                          </span>
                        </span>
                        {ex.description && (
                          <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
                            {ex.description}
                          </span>
                        )}
                        <span className="mt-3 block text-xs uppercase tracking-[0.12em] text-muted-foreground">
                          {best > 0 ? (
                            <>
                              Best{" "}
                              <b className="ml-1 tabular-nums text-foreground">{`${best}${ex.unit === "seconds" ? "s" : ""}`}</b>
                            </>
                          ) : (
                            "Noch kein Bestwert"
                          )}
                        </span>
                      </span>
                      <ArrowUpRight
                        className="shrink-0 text-muted-foreground transition group-hover:text-primary"
                        size={20}
                      />
                    </Link>
                  );
                })}
            </div>
          </section>
          <BottomNav />
        </main>
      </DesignView>
      <DesignView variant="classic">
        <main className="classic-only alo-tablet-training mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6">
          <header className="flex items-center justify-between">
            <Link
              to="/"
              className="text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition"
            >
              ← Startseite
            </Link>
            <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
              Übungen
            </span>
            <span className="w-12" />
          </header>

          <section className="mt-6">
            <h1 className="text-2xl font-bold tracking-tight text-balance">Wähle deine Übung</h1>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              Jede Übung zählt automatisch — per Nase, Bewegungssensor oder Timer.
            </p>
          </section>

          {/* ── Calisthenics Hero Card ──────────────────────────────────────────── */}
          <section className="mt-5">
            <Link
              to="/calisthenics"
              className="group relative flex flex-col overflow-hidden rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/20 via-card/70 to-card/60 p-5 backdrop-blur transition active:scale-[0.99] hover:border-primary/60"
            >
              {/* Background glow */}
              <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />

              <div className="relative flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">
                      Skill Progression
                    </span>
                    <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-primary">
                      NEU
                    </span>
                  </div>
                  <h2 className="mt-1.5 text-3xl font-bold tracking-tight">Calisthenics 🤸</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground text-pretty leading-relaxed">
                    Planche · Front Lever · Handstand — strukturiertes Skill-Training mit
                    Progression Gates, Belastungssteuerung und täglichem Check-in.
                  </p>
                </div>
              </div>

              {/* Path pills */}
              <div className="relative mt-4 flex gap-2 flex-wrap">
                {CALI_PATHS.map((path) => {
                  const mastered = path.skills.filter(
                    (s) => getSkillStatus(bests, s) === "mastered",
                  ).length;
                  return (
                    <div
                      key={path.id}
                      className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-3 py-1.5"
                    >
                      <span className="text-base leading-none">{path.icon}</span>
                      <span className="text-xs font-medium text-foreground">{path.name}</span>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {mastered}/{path.skills.length}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Progress row */}
              <div className="relative mt-4 flex items-center gap-3">
                <div className="flex-1">
                  <div className="mb-1 flex justify-between text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    <span>Skills gemeistert</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {masteredCaliSkills} / {totalCaliSkills}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-700"
                      style={{
                        width: `${totalCaliSkills > 0 ? (masteredCaliSkills / totalCaliSkills) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  {activeCaliSkill && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Nächster Skill:{" "}
                      <span className="font-medium text-foreground">{activeCaliSkill.name}</span>
                    </p>
                  )}
                </div>
                <span className="text-2xl text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary">
                  →
                </span>
              </div>
            </Link>
          </section>

          {/* ── Standard Exercises ─────────────────────────────────────────────── */}
          <section className="mt-5 flex-1 space-y-3">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Klassische Übungen
            </h2>

            {loading && (
              <div className="rounded-2xl border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
                Lade…
              </div>
            )}

            {!loading && exercises.length === 0 && (
              <div className="rounded-2xl border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
                Keine Übungen verfügbar.
              </div>
            )}

            {exercises
              .filter((ex) => !ex.id.startsWith("cali_"))
              .map((ex) => {
                const best = bests[ex.id] ?? 0;
                return (
                  <Link
                    key={ex.id}
                    to="/workout/$exerciseId"
                    params={{ exerciseId: ex.id }}
                    className="group flex items-center gap-4 rounded-3xl border border-border bg-card/50 p-4 backdrop-blur transition active:scale-[0.98] hover:border-primary/40"
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-background/50 text-3xl">
                      {ex.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold text-foreground">{ex.name}</span>
                        <span className="rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                          {DETECTION_LABEL[ex.detection_type]}
                        </span>
                      </div>
                      {ex.description && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {ex.description}
                        </p>
                      )}
                      <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Best:{" "}
                        <span className="tabular-nums text-foreground">
                          {best > 0 ? `${best}${ex.unit === "seconds" ? "s" : ""}` : "—"}
                        </span>
                      </div>
                    </div>
                    <span className="text-lg text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary">
                      →
                    </span>
                  </Link>
                );
              })}
          </section>

          <BottomNav />
        </main>
      </DesignView>
    </>
  );
}
