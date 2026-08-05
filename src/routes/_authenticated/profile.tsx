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
import { levelProgress } from "@/lib/level";
import { setSoundEnabled, setHapticsEnabled, feedbackSuccess } from "@/lib/feedback";

import { CoachPanel } from "@/components/CoachPanel";
import { FriendsPanel } from "@/components/FriendsPanel";
import { BadgeGallery } from "@/components/BadgeGallery";
import { ThemePicker } from "@/components/ThemePicker";
import { BottomNav } from "@/components/BottomNav";
import { NotificationSettings } from "@/components/NotificationSettings";

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
  xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  last_workout_date: string | null;
  streak_freezes: number;
  birth_year: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  sex: string | null;
  daily_goal: number;
  share_activity: boolean;
  theme: string | null;
  sound_enabled: boolean;
  haptics_enabled: boolean;
};

type Workout = { id: string; count: number; duration_ms: number; created_at: string; exercise_id: string | null };

const PROFILE_COLS =
  "id, display_name, avatar_url, best_count, xp, level, current_streak, longest_streak, last_workout_date, streak_freezes, birth_year, height_cm, weight_kg, sex, daily_goal, share_activity, theme, sound_enabled, haptics_enabled";


function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string>("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [sex, setSex] = useState("");
  const [dailyGoal, setDailyGoal] = useState("50");
  const [shareActivity, setShareActivity] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [hapticsOn, setHapticsOn] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [upgradeEmail, setUpgradeEmail] = useState("");
  const [upgradePassword, setUpgradePassword] = useState("");
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null);

  const applyProfile = (prof: Profile) => {
    setProfile(prof);
    setDisplayName(prof.display_name ?? "");
    setAvatarUrl(prof.avatar_url ?? "");
    setBirthYear(prof.birth_year ? String(prof.birth_year) : "");
    setHeightCm(prof.height_cm ? String(prof.height_cm) : "");
    setWeightKg(prof.weight_kg ? String(prof.weight_kg) : "");
    setSex(prof.sex ?? "");
    setDailyGoal(String(prof.daily_goal ?? 50));
    setShareActivity(prof.share_activity ?? true);
    const sound = prof.sound_enabled ?? true;
    const haptics = prof.haptics_enabled ?? true;
    setSoundOn(sound);
    setHapticsOn(haptics);
    setSoundEnabled(sound);
    setHapticsEnabled(haptics);
  };


  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setEmail(u.user.email ?? "");
      setIsAnonymous(!!u.user.is_anonymous);
      const [{ data: p }, { data: w }] = await Promise.all([
        supabase.from("profiles").select(PROFILE_COLS).eq("id", u.user.id).maybeSingle(),
        supabase
          .from("workouts")
          .select("id, count, duration_ms, created_at, exercise_id")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      let prof = p;
      if (!prof) {
        const { data: created } = await supabase
          .from("profiles")
          .insert({
            id: u.user.id,
            display_name: u.user.is_anonymous ? "Gast" : (u.user.email?.split("@")[0] ?? null),
          })
          .select(PROFILE_COLS)
          .maybeSingle();
        prof = created;
      }
      if (prof) applyProfile(prof as Profile);
      if (w) setWorkouts(w as Workout[]);
    })();
  }, []);

  const numOrNull = (v: string, min: number, max: number) => {
    const cleaned = v.replace(",", ".").replace(/[^0-9.]/g, "");
    const n = Number(cleaned);
    if (!cleaned || Number.isNaN(n)) return null;
    return Math.max(min, Math.min(max, n));
  };

  // Accept "1,80" / "1.8" (meters) as well as "180" (cm).
  const heightOrNull = (v: string) => {
    const cleaned = v.replace(",", ".").replace(/[^0-9.]/g, "");
    let n = Number(cleaned);
    if (!cleaned || Number.isNaN(n) || n <= 0) return null;
    if (n < 3) n = n * 100;
    return Math.round(Math.max(80, Math.min(250, n)));
  };

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    setMsg(null);
    const { data, error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        birth_year: numOrNull(birthYear, 1920, new Date().getFullYear()),
        height_cm: heightOrNull(heightCm),
        weight_kg: numOrNull(weightKg, 25, 400),
        sex: sex || null,
        daily_goal: numOrNull(dailyGoal, 5, 2000) ?? 50,
        share_activity: shareActivity,
        sound_enabled: soundOn,
        haptics_enabled: hapticsOn,

      })
      .eq("id", profile.id)
      .select(PROFILE_COLS)
      .single();
    setSaving(false);
    if (error) {
      setMsg("Speichern fehlgeschlagen");
    } else {
      applyProfile(data as Profile);
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

  const upgradeAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpgradeMsg(null);
    if (!upgradeEmail.includes("@") || upgradePassword.length < 6) {
      setUpgradeMsg("E-Mail und Passwort (min. 6 Zeichen) erforderlich");
      return;
    }
    setUpgrading(true);
    const { error } = await supabase.auth.updateUser({
      email: upgradeEmail.trim(),
      password: upgradePassword,
    });
    setUpgrading(false);
    if (error) {
      setUpgradeMsg(error.message);
    } else {
      setUpgradeMsg("Konto erstellt! Bitte E-Mail zur Bestätigung prüfen.");
      setIsAnonymous(false);
      setEmail(upgradeEmail.trim());
    }
  };

  
  const lp = levelProgress(profile?.xp ?? 0);
  const streak = profile?.current_streak ?? 0;
  const streakActive = (() => {
    if (!profile?.last_workout_date) return false;
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    return profile.last_workout_date === today || profile.last_workout_date === yesterday;
  })();

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
            {isAnonymous && (
              <span className="ml-2 rounded-full border border-border bg-secondary px-2 py-0.5 align-middle text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                Gast
              </span>
            )}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {isAnonymous ? "Kein Konto verknüpft" : email}
          </div>
        </div>
      </section>

      {isAnonymous && (
        <section className="mt-4 rounded-3xl border border-primary/40 bg-primary/5 p-5 backdrop-blur">
          <h2 className="text-sm font-semibold text-primary">
            🔒 Fortschritt sichern
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Erstelle ein Konto, um deine XP, Streaks und Bestwerte auf allen Geräten zu behalten.
          </p>
          <form onSubmit={upgradeAccount} className="mt-3 space-y-2">
            <input
              type="email"
              value={upgradeEmail}
              onChange={(e) => setUpgradeEmail(e.target.value)}
              placeholder="E-Mail"
              autoComplete="email"
              className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            <input
              type="password"
              value={upgradePassword}
              onChange={(e) => setUpgradePassword(e.target.value)}
              placeholder="Passwort (min. 6 Zeichen)"
              autoComplete="new-password"
              className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            {upgradeMsg && <p className="text-xs text-muted-foreground">{upgradeMsg}</p>}
            <button
              type="submit"
              disabled={upgrading}
              className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"
            >
              {upgrading ? "Erstelle…" : "Konto erstellen"}
            </button>
          </form>
        </section>
      )}

      {/* Level + XP */}
      <section className="mt-4 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Level {lp.level} · {lp.title}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {lp.xp.toLocaleString("de-DE")} XP
            </div>
          </div>
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${
              streakActive && streak > 0
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-secondary text-muted-foreground"
            }`}
            title="Aktuelle Streak"
          >
            <span className="text-lg leading-none">{streak > 0 && streakActive ? "🔥" : "❄️"}</span>
            <span className="tabular-nums">{streak}</span>
          </div>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${lp.progress * 100}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>{lp.xpIntoLevel} / {lp.xpForLevel} XP</span>
          <span>{lp.isMax ? "Max-Level" : `Noch ${lp.xpToNext} XP bis Lv ${lp.level + 1}`}</span>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Bestwert" value={(profile?.best_count ?? 0).toString()} />
        <Stat label="Workouts" value={workouts.length.toString()} />
        <Stat label="Längste" value={(profile?.longest_streak ?? 0).toString()} />
      </section>

      {profile && <CoachPanel profile={profile} workouts={workouts} />}

      {profile && <FriendsPanel userId={profile.id} />}

      <ThemePicker profileId={profile?.id} initialTheme={profile?.theme ?? null} />
      <BadgeGallery />

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

        <div className="!mt-5 border-t border-border pt-4">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Körperdaten (für den Smart Coach)
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Geburtsjahr" value={birthYear} onChange={setBirthYear} placeholder="1998" maxLength={4} numeric />
            <Field label="Größe (cm)" value={heightCm} onChange={setHeightCm} placeholder="180" maxLength={5} numeric />
            <Field label="Gewicht (kg)" value={weightKg} onChange={setWeightKg} placeholder="78" maxLength={5} numeric />
            <Field label="Tagesziel (Reps)" value={dailyGoal} onChange={setDailyGoal} placeholder="50" maxLength={4} numeric />

          </div>
          <div className="mt-3">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Geschlecht
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: "male", l: "Männlich" },
                { v: "female", l: "Weiblich" },
                { v: "other", l: "Divers" },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setSex(sex === o.v ? "" : o.v)}
                  className={`rounded-xl border px-2 py-2 text-xs font-medium transition ${
                    sex === o.v
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border bg-secondary/60 text-muted-foreground"
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShareActivity((s) => !s)}
            className="mt-3 flex w-full items-center justify-between rounded-xl border border-border bg-background/40 px-3 py-3 text-left"
          >
            <span className="text-xs">
              Tages-Aktivität mit Freunden teilen
              <span className="mt-0.5 block text-[10px] text-muted-foreground">
                Freunde sehen deine Push-Ups des Tages live.
              </span>
            </span>
            <span
              className={`ml-3 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${
                shareActivity ? "bg-primary" : "bg-secondary"
              }`}
            >
              <span
                className={`h-5 w-5 rounded-full bg-background transition ${shareActivity ? "translate-x-5" : ""}`}
              />
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              setSoundEnabled(next);
              if (next) feedbackSuccess();
            }}
            className="mt-3 flex w-full items-center justify-between rounded-xl border border-border bg-background/40 px-3 py-3 text-left"
          >
            <span className="text-xs">
              Sound-Feedback
              <span className="mt-0.5 block text-[10px] text-muted-foreground">
                Klick bei jeder Wiederholung, Fanfare bei Erfolgen.
              </span>
            </span>
            <span
              className={`ml-3 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${
                soundOn ? "bg-primary" : "bg-secondary"
              }`}
            >
              <span
                className={`h-5 w-5 rounded-full bg-background transition ${soundOn ? "translate-x-5" : ""}`}
              />
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              const next = !hapticsOn;
              setHapticsOn(next);
              setHapticsEnabled(next);
              if (next && typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(20);
            }}
            className="mt-3 flex w-full items-center justify-between rounded-xl border border-border bg-background/40 px-3 py-3 text-left"
          >
            <span className="text-xs">
              Vibration
              <span className="mt-0.5 block text-[10px] text-muted-foreground">
                Haptisches Feedback auf dem Handy.
              </span>
            </span>
            <span
              className={`ml-3 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${
                hapticsOn ? "bg-primary" : "bg-secondary"
              }`}
            >
              <span
                className={`h-5 w-5 rounded-full bg-background transition ${hapticsOn ? "translate-x-5" : ""}`}
              />
            </span>
          </button>
        </div>


        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
        <button
          onClick={save}
          disabled={saving || !profile}
          className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? "Speichere…" : "Speichern"}
        </button>
      </section>

      <NotificationSettings />



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
      <BottomNav />
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
  numeric,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  numeric?: boolean;
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
        inputMode={numeric ? "decimal" : undefined}
        className="w-full rounded-xl border border-border bg-background/60 px-3 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}

type WorkoutPoint = { id: string; count: number; duration_ms: number; created_at: string };

function WorkoutCharts({ workouts }: { workouts: WorkoutPoint[] }) {
  const [metric, setMetric] = useState<"count" | "duration">("count");

  const data = useMemo(() => {
    // workouts arrive newest-first → reverse for chronological X axis
    return [...workouts]
      .slice()
      .reverse()
      .map((w, i) => {
        const d = new Date(w.created_at);
        return {
          idx: i + 1,
          label: d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
          fullLabel: d.toLocaleString("de-DE"),
          count: w.count,
          duration: Math.round(w.duration_ms / 1000),
        };
      });
  }, [workouts]);

  const cumulative = useMemo(() => {
    let total = 0;
    return data.map((d) => {
      total += d.count;
      return { ...d, total };
    });
  }, [data]);

  if (workouts.length === 0) return null;

  const accent = "oklch(0.82 0.19 95)";
  const muted = "oklch(0.7 0.03 250)";

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Verlauf
        </h2>
        <div className="flex rounded-full border border-border bg-background/60 p-0.5 text-[10px] uppercase tracking-[0.18em]">
          <MetricTab active={metric === "count"} onClick={() => setMetric("count")}>
            Reps
          </MetricTab>
          <MetricTab active={metric === "duration"} onClick={() => setMetric("duration")}>
            Zeit
          </MetricTab>
        </div>
      </div>

      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.03 250)" vertical={false} />
            <XAxis dataKey="label" stroke={muted} fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke={muted} fontSize={10} tickLine={false} axisLine={false} width={32} />
            <Tooltip
              cursor={{ fill: "oklch(0.82 0.19 95 / 0.08)" }}
              contentStyle={{
                background: "oklch(0.22 0.03 250)",
                border: "1px solid oklch(0.3 0.03 250)",
                borderRadius: 12,
                fontSize: 12,
                color: "oklch(0.98 0.01 90)",
              }}
              labelFormatter={(_, p) => p?.[0]?.payload?.fullLabel ?? ""}
              formatter={(v: number) => [
                metric === "count" ? `${v} Push-Ups` : `${v}s`,
                metric === "count" ? "Reps" : "Dauer",
              ]}
            />
            <Bar
              dataKey={metric}
              fill={accent}
              radius={[6, 6, 2, 2]}
              maxBarSize={28}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Gesamt über Zeit
      </div>
      <div className="mt-1 h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={cumulative} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="totalFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.45} />
                <stop offset="100%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.03 250)" vertical={false} />
            <XAxis dataKey="label" stroke={muted} fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke={muted} fontSize={10} tickLine={false} axisLine={false} width={32} />
            <Tooltip
              contentStyle={{
                background: "oklch(0.22 0.03 250)",
                border: "1px solid oklch(0.3 0.03 250)",
                borderRadius: 12,
                fontSize: 12,
                color: "oklch(0.98 0.01 90)",
              }}
              labelFormatter={(_, p) => p?.[0]?.payload?.fullLabel ?? ""}
              formatter={(v: number) => [`${v} Push-Ups`, "Gesamt"]}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke={accent}
              strokeWidth={2}
              fill="url(#totalFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function MetricTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 transition ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
