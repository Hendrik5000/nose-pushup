import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [{ title: "Profil — Nose Push" }],
  }),
  component: ProfilePage,
});

type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  best_count: number;
};

type Workout = { id: string; count: number; duration_ms: number; created_at: string };

function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string>("");
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setEmail(u.user.email ?? "");
      const [{ data: p }, { data: w }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, avatar_url, best_count")
          .eq("id", u.user.id)
          .maybeSingle(),
        supabase
          .from("workouts")
          .select("id, count, duration_ms, created_at")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (p) {
        const prof = p as Profile;
        setProfile(prof);
        setDisplayName(prof.display_name ?? "");
        setAvatarUrl(prof.avatar_url ?? "");
      }
      if (w) setWorkouts(w as Workout[]);
    })();
  }, []);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    setMsg(null);
    const { data, error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      })
      .eq("id", profile.id)
      .select("id, display_name, avatar_url, best_count")
      .single();
    setSaving(false);
    if (error) {
      setMsg("Speichern fehlgeschlagen");
    } else {
      setProfile(data as Profile);
      setMsg("Profil aktualisiert");
    }
  };

  const deleteWorkout = async (id: string) => {
    await supabase.from("workouts").delete().eq("id", id);
    setWorkouts((w) => w.filter((x) => x.id !== id));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const total = workouts.reduce((s, w) => s + w.count, 0);

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6 pb-10">
      <header className="flex items-center justify-between">
        <Link
          to="/"
          className="text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition"
        >
          ← Zurück
        </Link>
        <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Profil</span>
        <button
          onClick={signOut}
          className="text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-destructive transition"
        >
          Abmelden
        </button>
      </header>

      <section className="mt-6 flex items-center gap-4 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-xl font-semibold">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            (profile?.display_name || "?").slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">
            {profile?.display_name || "Ohne Namen"}
          </div>
          <div className="truncate text-xs text-muted-foreground">{email}</div>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Bestwert" value={(profile?.best_count ?? 0).toString()} />
        <Stat label="Workouts" value={workouts.length.toString()} />
        <Stat label="Total" value={total.toString()} />
      </section>

      <section className="mt-6 space-y-3 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
        <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Profil bearbeiten
        </h2>
        <Field label="Anzeigename" value={displayName} onChange={setDisplayName} maxLength={60} />
        <Field
          label="Avatar-URL"
          value={avatarUrl}
          onChange={setAvatarUrl}
          placeholder="https://…"
          maxLength={500}
        />
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
        <button
          onClick={save}
          disabled={saving || !profile}
          className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? "Speichere…" : "Speichern"}
        </button>
      </section>

      <WorkoutCharts workouts={workouts} />

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Letzte Trainings
        </h2>
        {workouts.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card/40 p-4 text-sm text-muted-foreground">
            Noch keine Workouts gespeichert.
          </p>
        ) : (
          <ul className="space-y-2">
            {workouts.map((w) => (
              <li
                key={w.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-card/40 px-4 py-3 backdrop-blur"
              >
                <div>
                  <div className="text-base font-semibold tabular-nums">{w.count} Push-Ups</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(w.created_at).toLocaleString("de-DE")} ·{" "}
                    {Math.round(w.duration_ms / 1000)}s
                  </div>
                </div>
                <button
                  onClick={() => deleteWorkout(w.id)}
                  className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-destructive transition"
                >
                  Löschen
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 px-3 py-3 backdrop-blur">
      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full rounded-xl border border-border bg-background/60 px-3 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}
