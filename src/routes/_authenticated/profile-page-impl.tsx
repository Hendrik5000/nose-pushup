import { Link, useNavigate } from "@tanstack/react-router";
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
import { ErrorReportsPanel } from "@/components/ErrorReportsPanel";
import { BottomNav } from "@/components/BottomNav";
import { NotificationSettings } from "@/components/NotificationSettings";
import { PublicProfileSettings } from "@/components/PublicProfileSettings";
import { SettingsSection } from "@/components/SettingsSection";
import { restartWelcomeTour } from "@/components/WelcomeTour";

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

export function ProfilePage() {
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
    if (error) setMsg("Speichern fehlgeschlagen");
    else {
      applyProfile(data as Profile);
      setMsg("Profil aktualisiert");
    }
  };

  const saveSetting = async (patch: Partial<Profile>) => {
    if (!profile) return;
    const { error } = await supabase.from("profiles").update(patch as never).eq("id", profile.id);
    if (!error) setProfile({ ...profile, ...patch } as Profile);
  };

  const toggleShare = async () => {
    const next = !shareActivity;
    setShareActivity(next);
    await saveSetting({ share_activity: next });
  };
  const toggleSound = async () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) feedbackSuccess();
    await saveSetting({ sound_enabled: next });
  };
  const toggleHaptics = async () => {
    const next = !hapticsOn;
    setHapticsOn(next);
    setHapticsEnabled(next);
    if (next && typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(20);
    await saveSetting({ haptics_enabled: next });
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
    if (error) setUpgradeMsg(error.message);
    else {
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
        <Link to="/" className="text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition">
          ← Zurück
        </Link>
        <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Einstellungen</span>
        <button onClick={signOut} className="text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-destructive transition">
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
              <span className="ml-2 rounded-full border border-border bg-secondary px-2 py-0.5 align-middle text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Gast</span>
            )}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {isAnonymous ? "Kein Konto verknüpft" : email}
          </div>
        </div>
      </section>

      {isAnonymous && (
        <section className="mt-4 rounded-3xl border border-primary/40 bg-primary/5 p-5 backdrop-blur">
          <h2 className="text-sm font-semibold text-primary">🔒 Fortschritt sichern</h2>
          <p className="mt-1 text-xs text-muted-foreground">Erstelle ein Konto, um XP, Streaks und Bestwerte zu behalten.</p>
          <form onSubmit={upgradeAccount} className="mt-3 space-y-2">
            <input type="email" value={upgradeEmail} onChange={(e) => setUpgradeEmail(e.target.value)} placeholder="E-Mail" className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary" />
            <input type="password" value={upgradePassword} onChange={(e) => setUpgradePassword(e.target.value)} placeholder="Passwort (min. 6 Zeichen)" className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary" />
            {upgradeMsg && <p className="text-xs text-muted-foreground">{upgradeMsg}</p>}
            <button type="submit" disabled={upgrading} className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {upgrading ? "Erstelle…" : "Konto erstellen"}
            </button>
          </form>
        </section>
      )}

      <section className="mt-4 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Level {lp.level} · {lp.title}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{lp.xp.toLocaleString("de-DE")} XP</div>
          </div>
          <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${
            streakActive && streak > 0 ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground"
          }`}>
            <span className="text-lg leading-none">{streak > 0 && streakActive ? "🔥" : "❄️"}</span>
            <span className="tabular-nums">{streak}</span>
          </div>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${lp.progress * 100}%` }} />
        </div>
      </section>

      <div className="mt-4 space-y-3">
        {profile && (
          <SettingsSection icon="🧠" title="Smart Coach" subtitle="Trainingsplan & Streak-Tipps">
            <CoachPanel profile={profile} workouts={workouts} />
          </SettingsSection>
        )}
        {profile && (
          <SettingsSection icon="🤝" title="Freunde" subtitle="Einladen & zusammen trainieren">
            <FriendsPanel userId={profile.id} />
          </SettingsSection>
        )}
        <SettingsSection icon="🎨" title="Design" subtitle="Farbwelten">
          <ThemePicker profileId={profile?.id} initialTheme={profile?.theme ?? null} />
        </SettingsSection>
        <SettingsSection icon="🐞" title="Fehlerberichte" subtitle="Automatisch erfasst — für Auto-Fix an Grok senden">
          <ErrorReportsPanel />
        </SettingsSection>
        <SettingsSection icon="🏅" title="Badges" subtitle="Erfolge">
          <BadgeGallery />
        </SettingsSection>
        <SettingsSection icon="✏️" title="Profil bearbeiten" subtitle={profile?.display_name || "Ohne Namen"}>
          <div className="space-y-3">
            <Field label="Anzeigename" value={displayName} onChange={setDisplayName} maxLength={60} />
            <Field label="Avatar-URL" value={avatarUrl} onChange={setAvatarUrl} placeholder="https://…" maxLength={500} />
            {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
            <button onClick={save} disabled={saving || !profile} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {saving ? "Speichere…" : "Speichern"}
            </button>
          </div>
        </SettingsSection>
        <SettingsSection icon="⚙️" title="Bedienung" subtitle="Sound, Vibration, Teilen">
          <div className="space-y-3">
            <ToggleRow label="Sound" on={soundOn} onToggle={toggleSound} />
            <ToggleRow label="Vibration" on={hapticsOn} onToggle={toggleHaptics} />
            <ToggleRow label="Aktivität teilen" on={shareActivity} onToggle={toggleShare} />
          </div>
        </SettingsSection>
        {profile && (
          <SettingsSection icon="🌐" title="Öffentliches Profil" subtitle="Teilen & Einladen">
            <PublicProfileSettings userId={profile.id} />
          </SettingsSection>
        )}
        <SettingsSection icon="🔔" title="Benachrichtigungen" subtitle="Erinnerungen">
          <NotificationSettings />
        </SettingsSection>
        <SettingsSection icon="❓" title="Hilfe" subtitle="Tour neu starten">
          <button type="button" onClick={() => restartWelcomeTour()} className="w-full rounded-xl border border-border px-4 py-3 text-sm font-medium">
            Willkommenstour starten
          </button>
        </SettingsSection>
        <SettingsSection icon="📋" title="Letzte Trainings" subtitle={`${workouts.length} Einträge`}>
          <ul className="space-y-2">
            {workouts.slice(0, 8).map((w) => (
              <li key={w.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-xs">
                <span>{w.count} · {new Date(w.created_at).toLocaleDateString("de-DE")}</span>
                <button type="button" onClick={() => deleteWorkout(w.id)} className="text-muted-foreground">Löschen</button>
              </li>
            ))}
          </ul>
        </SettingsSection>
      </div>
      <BottomNav />
    </main>
  );
}

function Field({
  label, value, onChange, placeholder, maxLength, numeric,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; numeric?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={numeric ? "decimal" : undefined}
        className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

function ToggleRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-3 text-sm">
      <span>{label}</span>
      <span className={`flex h-6 w-11 items-center rounded-full p-0.5 transition ${on ? "bg-primary" : "bg-secondary"}`}>
        <span className={`h-5 w-5 rounded-full bg-background transition ${on ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}
