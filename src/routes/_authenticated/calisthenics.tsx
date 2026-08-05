import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { CaliSkillTree } from "@/components/CaliSkillTree";
import { CaliCheckin } from "@/components/CaliCheckin";
import { CaliLoadManager } from "@/components/CaliLoadManager";
import {
  CALI_PATHS,
  getTodayKey,
  loadCheckin,
  loadRecentCheckins,
  type CheckinData,
} from "@/lib/calisthenics";

export const Route = createFileRoute("/_authenticated/calisthenics")({
  head: () => ({
    meta: [
      { title: "Calisthenics — Nose Push" },
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

      const [{ data: profile }, { data: workouts }] = await Promise.all([
        supabase
          .from("profiles")
          .select("personal_bests")
          .eq("id", u.user.id)
          .maybeSingle(),
        supabase
          .from("workouts")
          .select("exercise_id, count, created_at")
          .eq("user_id", u.user.id)
          .gte("created_at", sevenDaysAgo)
          .order("created_at", { ascending: false }),
      ]);

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
      : 1;

  // ─── Stagnation detection ─────────────────────────────────────────────────
  // Find skills where there's no improvement signal (no workouts in 14 days)
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();
  const recentIds = new Set(
    recentWorkouts
      .filter((w) => w.created_at >= fourteenDaysAgo && allCaliIds.has(w.exercise_id))
      .map((w) => w.exercise_id),
  );
  // Skills that are active but haven't been trained in 14 days
  const stagnating = CALI_PATHS.flatMap((p) =>
    p.skills.filter((s) => {
      const best = bests[s.id] ?? 0;
      return best > 0 && best < s.mastery_threshold && !recentIds.has(s.id);
    }),
  );

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Cali System
          </div>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight">Calisthenics 🤸</h1>
        </div>
        <div className="rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
          {Object.values(CALI_PATHS)
            .flatMap((p) =>
              p.skills.filter((s) => (bests[s.id] ?? 0) >= s.mastery_threshold),
            )
            .length}{" "}
          / {CALI_PATHS.flatMap((p) => p.skills).length} Skills
        </div>
      </header>

      <p className="mt-1 text-sm text-muted-foreground text-pretty">
        Strukturiertes Skill-Progression-Training nach dem „Zero to Planche" System — mit täglichem
        Check-in und smarter Belastungssteuerung.
      </p>

      {loading ? (
        <div className="mt-8 text-center text-sm text-muted-foreground">Lade…</div>
      ) : (
        <div className="mt-5 flex-1 space-y-4">
          {/* Daily Check-in */}
          <CaliCheckin
            existing={checkin}
            onSave={(d) => setCheckin(d)}
          />

          {/* Load Manager */}
          <CaliLoadManager
            workoutsLast7Days={caliWorkoutsLast7}
            avgSoreness={avgSoreness}
          />

          {/* Stagnation Alert */}
          {stagnating.length > 0 && (
            <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/8 p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl">📊</span>
                <div>
                  <p className="text-sm font-semibold text-yellow-400">
                    Stagnation erkannt
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {stagnating.map((s) => s.name).join(", ")} — seit über 2 Wochen kein
                    Training. Tipp: Reduziere Volumen und erhöhe Haltezeiten mit dem
                    leichteren Progressionsschritt.
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
  );
}
