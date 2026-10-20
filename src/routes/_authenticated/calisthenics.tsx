import { DesignView } from "@/components/DesignView";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { CaliSkillTree } from "@/components/CaliSkillTree";
import { CaliCheckin } from "@/components/CaliCheckin";
import { CaliLoadManager } from "@/components/CaliLoadManager";
import {
  CALI_PATHS,
  analyzeSkillTrends,
  getDailyFocus,
  getTodayKey,
  loadCheckin,
  loadRecentCheckins,
  type CheckinData,
  type SkillTrend,
} from "@/lib/calisthenics";
import { getPlateauAdvice } from "@/lib/cali-coach.functions";
import { SportPageIntro, SportSectionLabel } from "@/components/SportPageIntro";
import {
  Activity,
  ArrowUpRight,
  Battery,
  CheckCircle2,
  Dumbbell,
  Leaf,
  Target,
  TrendingDown,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/calisthenics")({
  head: () => ({
    meta: [
      { title: "Calisthenics — Alo" },
      {
        name: "description",
        content:
          "Cali System: Planche, Front Lever und Handstand — strukturiertes Progression-Training mit smarter Belastungssteuerung.",
      },
    ],
  }),
  component: CalisthenicsPage,
});

type WorkoutRow = {
  exercise_id: string;
  count: number;
  created_at: string;
};

function CalisthenicsPage() {
  const [bests, setBests] = useState<Record<string, number>>({});
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutRow[]>([]);
  const [trends, setTrends] = useState<SkillTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [checkin, setCheckin] = useState<CheckinData | null>(null);

  useEffect(() => {
    // Load today's check-in from localStorage
    setCheckin(loadCheckin(getTodayKey()));

    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;

      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const twentyEightDaysAgo = new Date(Date.now() - 28 * 86400000).toISOString();

      const [{ data: profile }, { data: workouts }, { data: trendWorkouts }] = await Promise.all([
        supabase.from("profiles").select("personal_bests").eq("id", u.user.id).maybeSingle(),
        supabase
          .from("workouts")
          .select("exercise_id, count, created_at")
          .eq("user_id", u.user.id)
          .gte("created_at", sevenDaysAgo)
          .order("created_at", { ascending: false }),
        supabase
          .from("workouts")
          .select("exercise_id, count, created_at")
          .eq("user_id", u.user.id)
          .gte("created_at", twentyEightDaysAgo)
          .order("created_at", { ascending: true }),
      ]);

      if (trendWorkouts) setTrends(analyzeSkillTrends(trendWorkouts as WorkoutRow[]));

      const raw = (profile?.personal_bests ?? {}) as Record<string, number>;
      setBests(raw);

      if (workouts) setRecentWorkouts(workouts as WorkoutRow[]);
      setLoading(false);
    })();
  }, []);

  // ─── Fatigue calculation ──────────────────────────────────────────────────
  // Count cali workouts in last 7 days
  const allCaliIds = new Set(CALI_PATHS.flatMap((p) => p.skills.map((s) => s.id)));
  const caliWorkoutsLast7 = recentWorkouts.filter((w) => allCaliIds.has(w.exercise_id)).length;

  const recentCheckins = loadRecentCheckins(7);
  const avgSoreness =
    recentCheckins.length > 0
      ? recentCheckins.reduce((s, c) => s + c.soreness, 0) / recentCheckins.length
      : null;

  // ─── Stagnation (kein Training seit 14 Tagen) + Plateau (keine Verbesserung) ─
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();
  const recentIds = new Set(
    recentWorkouts
      .filter((w) => w.created_at >= fourteenDaysAgo && allCaliIds.has(w.exercise_id))
      .map((w) => w.exercise_id),
  );
  const stagnating = CALI_PATHS.flatMap((p) =>
    p.skills.filter((s) => {
      const best = bests[s.id] ?? 0;
      return best > 0 && best < s.mastery_threshold && !recentIds.has(s.id);
    }),
  );
  const plateaus = trends.filter((t) => t.plateau);
  const dailyFocus = getDailyFocus(bests, checkin);

  return (
    <>
      <DesignView variant="sport">
        <main className="sport-only mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col gap-6 px-5 py-6 sm:px-8">
          <SportPageIntro
            eyebrow="SKILL SYSTEM · CALISTHENICS"
            title="Baue echte Kontrolle auf"
            description="Planche, Front Lever und Handstand — trainiere mit täglichem Check-in und intelligenter Belastungssteuerung."
          >
            <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">
              <CheckCircle2 size={17} />
              {
                CALI_PATHS.flatMap((p) =>
                  p.skills.filter((skill) => (bests[skill.id] ?? 0) >= skill.mastery_threshold),
                ).length
              }{" "}
              / {CALI_PATHS.flatMap((p) => p.skills).length} Skills
            </div>
          </SportPageIntro>
          {loading ? (
            <div className="rounded-3xl border border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
              Training wird geladen …
            </div>
          ) : (
            <div className="flex-1 space-y-6">
              <section className="sport-focus-card rounded-3xl border border-border bg-card/55 p-4 sm:p-6">
                <SportSectionLabel number="01">Check-in & Belastung</SportSectionLabel>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <CaliCheckin existing={checkin} onSave={(d) => setCheckin(d)} />
                  <CaliLoadManager
                    workoutsLast7Days={caliWorkoutsLast7}
                    avgSoreness={avgSoreness}
                  />
                </div>
              </section>
              <section className="rounded-3xl border border-primary/25 bg-primary/5 p-5 sm:p-6">
                <SportSectionLabel number="02">Dein Fokus heute</SportSectionLabel>
                <div className="mt-4 flex items-start gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
                    {dailyFocus.kind === "peak" ? (
                      <Target />
                    ) : dailyFocus.kind === "recovery" ? (
                      <Leaf />
                    ) : (
                      <Activity />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold">{dailyFocus.title}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {dailyFocus.message}
                    </p>
                    {dailyFocus.skill && (
                      <Link
                        to="/cali-workout/$skillId"
                        params={{ skillId: dailyFocus.skill.id }}
                        className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
                      >
                        <Dumbbell size={16} /> {dailyFocus.skill.name} trainieren{" "}
                        <ArrowUpRight size={16} />
                      </Link>
                    )}
                  </div>
                </div>
              </section>
              {plateaus.length > 0 && (
                <section className="space-y-3">
                  <SportSectionLabel number="03">Coach-Impulse</SportSectionLabel>
                  {plateaus.map((t) => (
                    <PlateauCard key={t.skill.id} trend={t} />
                  ))}
                </section>
              )}
              {stagnating.length > 0 && (
                <section className="rounded-3xl border border-yellow-500/30 bg-yellow-500/8 p-5">
                  <div className="flex items-start gap-3">
                    <TrendingDown className="mt-0.5 shrink-0 text-yellow-400" size={21} />
                    <div>
                      <p className="font-bold text-yellow-400">Stagnation erkannt</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {stagnating.map((s) => s.name).join(", ")} — seit über 2 Wochen kein
                        Training. Reduziere Volumen und erhöhe Haltezeiten mit dem leichteren
                        Progressionsschritt.
                      </p>
                    </div>
                  </div>
                </section>
              )}
              <section className="sport-feature-card rounded-3xl border border-border bg-card/55 p-4 sm:p-6">
                <SportSectionLabel number="04">Progressionspfade</SportSectionLabel>
                <div className="cali-path-tabs mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-background/40 p-1.5 sm:grid-cols-3">
                  {CALI_PATHS.map((path, i) => (
                    <button
                      key={path.id}
                      onClick={() => setActiveTab(i)}
                      className={`min-w-0 whitespace-normal break-words rounded-xl px-2 py-3 text-xs font-semibold transition ${activeTab === i ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {path.name}
                    </button>
                  ))}
                </div>
                <div className="mt-5">
                  <CaliSkillTree
                    key={CALI_PATHS[activeTab].id}
                    path={CALI_PATHS[activeTab]}
                    bests={bests}
                  />
                </div>
              </section>
              {checkin && checkin.energy <= 2 && (
                <section className="rounded-3xl border border-border bg-card/50 p-5">
                  <div className="flex items-start gap-3">
                    <Battery className="shrink-0 text-primary" />
                    <div>
                      <p className="font-bold">Regenerationstag</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Auch heute ist aktiv! Wähle eine Mikro-Aktivität:
                      </p>
                      <ul className="mt-3 space-y-2">
                        {[
                          "10 Min. Schulter-Mobilität (Circles, Wall Slides)",
                          "5 Min. Handgelenk-Aufwärmroutine",
                          "Mentale Technik-Visualisierung (5 Min.)",
                          "Leichtes Stretching: Hüftflexoren & Brustmuskeln",
                        ].map((activity) => (
                          <li
                            key={activity}
                            className="flex items-start gap-2 text-sm text-muted-foreground"
                          >
                            <span className="text-primary">—</span>
                            {activity}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}
          <BottomNav />
        </main>
      </DesignView>
      <DesignView variant="classic">
        <main className="classic-only mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6">
          {/* Header */}
          <header className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Cali System
              </div>
              <h1 className="mt-0.5 text-2xl font-bold tracking-tight">Calisthenics 🤸</h1>
            </div>
            <div className="rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
              {
                Object.values(CALI_PATHS).flatMap((p) =>
                  p.skills.filter((s) => (bests[s.id] ?? 0) >= s.mastery_threshold),
                ).length
              }{" "}
              / {CALI_PATHS.flatMap((p) => p.skills).length} Skills
            </div>
          </header>

          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Strukturiertes Skill-Progression-Training nach dem „Zero to Planche" System — mit
            täglichem Check-in und smarter Belastungssteuerung.
          </p>

          {loading ? (
            <div className="mt-8 text-center text-sm text-muted-foreground">Lade…</div>
          ) : (
            <div className="mt-5 flex-1 space-y-4">
              {/* Daily Check-in */}
              <CaliCheckin existing={checkin} onSave={(d) => setCheckin(d)} />

              {/* Load Manager */}
              <CaliLoadManager workoutsLast7Days={caliWorkoutsLast7} avgSoreness={avgSoreness} />

              {/* Dynamischer Tagesfokus aus dem Check-in */}
              <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl">
                    {dailyFocus.kind === "peak"
                      ? "🚀"
                      : dailyFocus.kind === "recovery"
                        ? "🌱"
                        : "🎯"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{dailyFocus.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{dailyFocus.message}</p>
                    {dailyFocus.skill && (
                      <Link
                        to="/workout/$exerciseId"
                        params={{ exerciseId: dailyFocus.skill.id }}
                        className="mt-2 inline-block rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition active:scale-[0.98]"
                      >
                        {dailyFocus.skill.icon} {dailyFocus.skill.name} trainieren →
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* Plateau-Karten mit Coach-Tipp */}
              {plateaus.map((t) => (
                <PlateauCard key={t.skill.id} trend={t} />
              ))}

              {/* Stagnation Alert */}
              {stagnating.length > 0 && (
                <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/8 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">📊</span>
                    <div>
                      <p className="text-sm font-semibold text-yellow-400">Stagnation erkannt</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {stagnating.map((s) => s.name).join(", ")} — seit über 2 Wochen kein
                        Training. Tipp: Reduziere Volumen und erhöhe Haltezeiten mit dem leichteren
                        Progressionsschritt.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Path Tabs */}
              <div>
                <div className="flex gap-1 rounded-2xl border border-border bg-secondary/30 p-1">
                  {CALI_PATHS.map((path, i) => (
                    <button
                      key={path.id}
                      onClick={() => setActiveTab(i)}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-medium transition ${
                        activeTab === i
                          ? "bg-card border border-border text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span>{path.icon}</span>
                      <span className="hidden sm:inline">{path.name}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-4">
                  <CaliSkillTree
                    key={CALI_PATHS[activeTab].id}
                    path={CALI_PATHS[activeTab]}
                    bests={bests}
                  />
                </div>
              </div>

              {/* Zero-Day Prevention — Rest Day Suggestion */}
              {checkin && checkin.energy <= 2 && (
                <div className="rounded-2xl border border-border bg-card/50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🌱</span>
                    <div>
                      <p className="text-sm font-semibold">Regenerationstag-Plan</p>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        Zero-Day-Prävention: Auch heute ist aktiv! Wähle eine dieser
                        Mikro-Aktivitäten:
                      </p>
                      <ul className="mt-2 space-y-1">
                        {[
                          "10 Min. Schulter-Mobilität (Circles, Wall Slides)",
                          "5 Min. Handgelenk-Aufwärmroutine",
                          "Mentale Technik-Visualisierung (5 Min.)",
                          "Leichtes Stretching: Hüftflexoren & Brustmuskeln",
                        ].map((activity) => (
                          <li
                            key={activity}
                            className="flex items-start gap-2 text-xs text-muted-foreground"
                          >
                            <span className="mt-0.5 text-primary">•</span>
                            {activity}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <BottomNav />
        </main>
      </DesignView>
    </>
  );
}

/** Plateau-Karte: Verlauf der letzten 4 Wochen + KI-Handlungsempfehlung. */
function PlateauCard({ trend }: { trend: SkillTrend }) {
  const loadAdvice = useServerFn(getPlateauAdvice);
  const [advice, setAdvice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const max = Math.max(1, ...trend.series.map((p) => p.value));
  const unitLabel = trend.skill.unit === "seconds" ? "s" : "";

  const fetchAdvice = async () => {
    setBusy(true);
    try {
      const res = await loadAdvice({
        data: {
          skillId: trend.skill.id,
          skillName: trend.skill.name,
          recentBest: trend.recentBest,
          previousBest: trend.previousBest,
          unit: trend.skill.unit,
        },
      });
      setAdvice(res.advice);
    } catch {
      setAdvice("Der Coach ist gerade nicht erreichbar — versuche es später erneut.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-orange-500/30 bg-orange-500/8 p-4">
      <div className="flex items-start gap-3">
        <span className="text-xl">📉</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-orange-400">Plateau: {trend.skill.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Seit 2 Wochen keine Verbesserung ({trend.previousBest}
            {unitLabel} → {trend.recentBest}
            {unitLabel}).
          </p>

          {/* Mini-Verlauf */}
          <div className="mt-3 flex h-10 items-end gap-0.5">
            {trend.series.map((p) => (
              <div
                key={p.day}
                title={`${p.day}: ${p.value}${unitLabel}`}
                className="flex-1 rounded-sm bg-orange-400/60"
                style={{ height: `${Math.max(12, (p.value / max) * 100)}%` }}
              />
            ))}
          </div>

          {advice ? (
            <p className="mt-3 rounded-xl bg-background/50 p-3 text-xs leading-relaxed text-foreground">
              🤖 {advice}
            </p>
          ) : (
            <button
              type="button"
              onClick={fetchAdvice}
              disabled={busy}
              className="mt-3 rounded-xl border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-300 transition active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? "Coach denkt nach…" : "🤖 Coach-Tipp holen"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
