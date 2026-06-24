import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ExerciseMeta } from "@/lib/exercises";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Nose Push — Übung wählen" },
      { name: "description", content: "Wähle deine Übung und starte das Workout. Bestwerte werden geräteübergreifend gespeichert." },
    ],
  }),
  component: ExercisePicker,
});

type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  best_count: number;
  personal_bests: Record<string, number>;
};

function ExercisePicker() {
  const [exercises, setExercises] = useState<ExerciseMeta[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: ex }, { data: p }] = await Promise.all([
        supabase.from("exercises").select("*").order("sort_order"),
        supabase
          .from("profiles")
          .select("id, display_name, avatar_url, best_count, personal_bests")
          .eq("id", u.user.id)
          .maybeSingle(),
      ]);
      if (ex) setExercises(ex as ExerciseMeta[]);
      if (p) {
        const raw = p as unknown as Omit<Profile, "personal_bests"> & {
          personal_bests: Record<string, number> | null;
        };
        setProfile({ ...raw, personal_bests: raw.personal_bests ?? {} });
      }
      setLoading(false);
    })();
  }, []);

  const initials = (profile?.display_name || "?").slice(0, 1).toUpperCase();

  return (
    <main className="relative flex min-h-[100dvh] flex-col px-5 pt-6 pb-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_12px_var(--color-primary)]" />
          <span className="text-sm font-medium tracking-widest uppercase text-muted-foreground">
            Nose&nbsp;Push
          </span>
        </div>
        <Link
          to="/profile"
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-sm font-semibold text-secondary-foreground"
          aria-label="Profil"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </Link>
      </header>

      <div className="mt-8 mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Wähle deine Übung</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Jede Übung hat ihre eigene Erkennung – Touch, Bewegung oder Timer.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {loading && (
          <div className="col-span-full rounded-3xl border border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">
            Lade Übungen…
          </div>
        )}
        {exercises.map((ex) => {
          const best = profile?.personal_bests?.[ex.id] ?? 0;
          return (
            <Link
              key={ex.id}
              to="/workout/$exerciseId"
              params={{ exerciseId: ex.id }}
              className="group relative flex flex-col gap-2 overflow-hidden rounded-3xl border border-border bg-card/60 p-5 backdrop-blur transition active:scale-[0.98] hover:border-primary/40"
            >
              <div className="flex items-start justify-between">
                <span className="text-4xl">{ex.icon}</span>
                <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  {ex.detection_type === "touch" && "Touch"}
                  {ex.detection_type === "motion_vertical" && "Sensor"}
                  {ex.detection_type === "timer" && "Timer"}
                  {ex.detection_type === "combo" && "Kombi"}
                </span>
              </div>
              <div className="mt-1">
                <h2 className="text-lg font-semibold text-foreground">{ex.name}</h2>
                <p className="text-xs text-muted-foreground line-clamp-2">{ex.description}</p>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Bestwert
                </span>
                <span className="text-base font-semibold tabular-nums text-foreground">
                  {best > 0 ? `${best} ${ex.unit === "seconds" ? "Sek." : ""}` : "—"}
                </span>
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
