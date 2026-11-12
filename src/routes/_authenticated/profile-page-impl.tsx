import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { readWorkoutMetadata } from "@/lib/workout-session";
import { historyExercise } from "@/lib/workout-history";
import { levelProgress } from "@/lib/level";
import { setSoundEnabled, setHapticsEnabled, feedbackSuccess } from "@/lib/feedback";
import { DesignView } from "@/components/DesignView";
import { CoachPanel } from "@/components/CoachPanel";
import { FriendsPanel } from "@/components/FriendsPanel";
import { BadgeGallery } from "@/components/BadgeGallery";
import { ThemePicker } from "@/components/ThemePicker";
import { DesignStylePicker } from "@/components/DesignStylePicker";
import { NavigationLayoutPicker } from "@/components/NavigationLayoutPicker";
import { ErrorReportsPanel } from "@/components/ErrorReportsPanel";
import { AloWebAppGuide } from "@/components/AloWebAppGuide";
import { BottomNav } from "@/components/BottomNav";
import { NotificationSettings } from "@/components/NotificationSettings";
import { PublicProfileSettings } from "@/components/PublicProfileSettings";
import { AppsSettingsList } from "@/components/settings/AppsSettingsList";
import { MenuAccentPicker } from "@/components/settings/MenuAccentPicker";
import { SettingsCategoryRow } from "@/components/settings/SettingsCategoryRow";
import { restartWelcomeTour } from "@/components/WelcomeTour";
import {
  getProfileSettingsCategory,
  PROFILE_SETTINGS_GROUPS,
  type ProfileSettingsCategoryId,
} from "@/lib/profile-settings";
import { AloPageSidebarTrigger, useAloPageSidebarCommands } from "@/components/alo/AloPageSidebar";

type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  xp: number;
  current_streak: number;
  longest_streak?: number;
  best_count?: number;
  last_workout_date: string | null;
  streak_freezes?: number;
  share_activity: boolean;
  theme: string | null;
  sound_enabled: boolean;
  haptics_enabled: boolean;
};

type Workout = {
  id: string;
  count: number;
  duration_ms: number;
  created_at: string;
  exercise_id: string | null;
};

const PROFILE_SETTINGS_COLS =
  "id, display_name, avatar_url, xp, current_streak, last_workout_date, share_activity, theme, sound_enabled, haptics_enabled";
const PROFILE_TRAINING_COLS =
  "id, display_name, avatar_url, xp, current_streak, last_workout_date, share_activity, theme, sound_enabled, haptics_enabled, best_count, longest_streak, streak_freezes";

export function ProfilePage({ sectionId }: { sectionId?: ProfileSettingsCategoryId } = {}) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [workoutsLoading, setWorkoutsLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [workoutsError, setWorkoutsError] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [shareActivity, setShareActivity] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [hapticsOn, setHapticsOn] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [upgradeEmail, setUpgradeEmail] = useState("");
  const [upgradePassword, setUpgradePassword] = useState("");
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null);
  const sidebarCommands = useMemo(() => ({}), []);
  useAloPageSidebarCommands(sidebarCommands, sectionId ? undefined : "settings-home");
  const needsWorkouts = sectionId === "training" || sectionId === "history";

  const applyProfile = useCallback((prof: Profile) => {
    setProfile(prof);
    setDisplayName(prof.display_name ?? "");
    setAvatarUrl(prof.avatar_url ?? "");
    const sound = prof.sound_enabled ?? true;
    const haptics = prof.haptics_enabled ?? true;
    setShareActivity(prof.share_activity ?? true);
    setSoundOn(sound);
    setHapticsOn(haptics);
    setSoundEnabled(sound);
    setHapticsEnabled(haptics);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setProfileLoading(true);
    setProfileError(false);
    setWorkoutsError(false);
    if (needsWorkouts) setWorkoutsLoading(true);
    else {
      setWorkouts([]);
      setWorkoutsLoading(false);
    }
    (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (cancelled) return;
        if (authError || !auth.user) {
          setProfileError(true);
          setWorkoutsError(true);
          return;
        }
        setEmail(auth.user.email ?? "");
        setIsAnonymous(!!auth.user.is_anonymous);
        const profileRequest = needsWorkouts
          ? supabase
              .from("profiles")
              .select(PROFILE_TRAINING_COLS)
              .eq("id", auth.user.id)
              .maybeSingle()
          : supabase
              .from("profiles")
              .select(PROFILE_SETTINGS_COLS)
              .eq("id", auth.user.id)
              .maybeSingle();
        const workoutRequest = needsWorkouts
          ? supabase
              .from("workouts")
              .select("id, count, duration_ms, created_at, exercise_id")
              .order("created_at", { ascending: false })
              .limit(20)
          : Promise.resolve(null);
        const [profileResult, workoutResult] = await Promise.all([profileRequest, workoutRequest]);
        if (cancelled) return;

        if (workoutResult?.error) setWorkoutsError(true);
        else if (workoutResult) setWorkouts((workoutResult.data ?? []) as Workout[]);
        setWorkoutsLoading(false);

        if (profileResult.error) {
          setProfileError(true);
          return;
        }
        let prof = profileResult.data;
        if (!prof) {
          const { data: created, error: createError } = await supabase
            .from("profiles")
            .insert({
              id: auth.user.id,
              display_name: auth.user.is_anonymous
                ? "Gast"
                : (auth.user.email?.split("@")[0] ?? null),
            })
            .select(PROFILE_SETTINGS_COLS)
            .maybeSingle();
          if (cancelled) return;
          if (createError) {
            setProfileError(true);
            return;
          }
          prof = created;
        }
        if (prof) applyProfile(prof as Profile);
        else setProfileError(true);
      } catch {
        if (!cancelled) {
          setProfileError(true);
          setWorkoutsError(true);
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
          setWorkoutsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyProfile, needsWorkouts]);

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
      .select(PROFILE_SETTINGS_COLS)
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
    const { error } = await supabase
      .from("profiles")
      .update(patch as never)
      .eq("id", profile.id);
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
    setWorkouts((current) => current.filter((workout) => workout.id !== id));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const upgradeAccount = async (event: FormEvent) => {
    event.preventDefault();
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
  const category = sectionId ? getProfileSettingsCategory(sectionId) : null;

  const categoryContent = sectionId ? (
    <SettingsCategoryContent
      categoryId={sectionId}
      profile={profile}
      profileLoading={profileLoading}
      profileError={profileError}
      workouts={workouts}
      workoutsLoading={workoutsLoading}
      workoutsError={workoutsError}
      displayName={displayName}
      setDisplayName={setDisplayName}
      avatarUrl={avatarUrl}
      setAvatarUrl={setAvatarUrl}
      saving={saving}
      message={msg}
      onSave={save}
      isAnonymous={isAnonymous}
      upgradeEmail={upgradeEmail}
      setUpgradeEmail={setUpgradeEmail}
      upgradePassword={upgradePassword}
      setUpgradePassword={setUpgradePassword}
      upgrading={upgrading}
      upgradeMessage={upgradeMsg}
      onUpgrade={upgradeAccount}
      onSignOut={() => void signOut()}
      shareActivity={shareActivity}
      onToggleShare={() => void toggleShare()}
      soundOn={soundOn}
      onToggleSound={() => void toggleSound()}
      hapticsOn={hapticsOn}
      onToggleHaptics={() => void toggleHaptics()}
      onDeleteWorkout={(id) => void deleteWorkout(id)}
      onRestartTour={() => {
        if (profile) restartWelcomeTour(profile.id);
      }}
    />
  ) : null;

  return (
    <>
      <DesignView variant="classic">
        <main className="classic-only mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col gap-4 px-4 pt-5 pb-28 sm:px-8">
          <SettingsPageHeader
            sectionId={sectionId}
            title={category?.title ?? "Einstellungen"}
            profile={profile}
          />
          {sectionId && category ? (
            <SettingsCategoryScreen subtitle={category.subtitle}>
              {categoryContent}
            </SettingsCategoryScreen>
          ) : (
            <>
              <ProfileSummaryCard
                variant="classic"
                profile={profile}
                email={email}
                isAnonymous={isAnonymous}
                loading={profileLoading}
                profileError={profileError}
                workoutsLoading={workoutsLoading}
                workoutsError={workoutsError}
                lp={lp}
                streak={streak}
                streakActive={streakActive}
              />
              <SettingsCategoryGroups />
            </>
          )}
          <BottomNav />
        </main>
      </DesignView>
      <DesignView variant="sport">
        <main className="sport-only mx-auto flex min-h-[100dvh] w-full max-w-4xl flex-col gap-5 px-5 py-6 pb-28 sm:px-8">
          <SettingsPageHeader
            sectionId={sectionId}
            title={category?.title ?? "Einstellungen"}
            profile={profile}
            sport
          />
          {sectionId && category ? (
            <SettingsCategoryScreen subtitle={category.subtitle}>
              {categoryContent}
            </SettingsCategoryScreen>
          ) : (
            <>
              <ProfileSummaryCard
                variant="sport"
                profile={profile}
                email={email}
                isAnonymous={isAnonymous}
                loading={profileLoading}
                profileError={profileError}
                workoutsLoading={workoutsLoading}
                workoutsError={workoutsError}
                lp={lp}
                streak={streak}
                streakActive={streakActive}
              />
              <SettingsCategoryGroups />
            </>
          )}
          <BottomNav />
        </main>
      </DesignView>
    </>
  );
}

function SettingsPageHeader({
  sectionId,
  title,
  profile,
  sport = false,
}: {
  sectionId?: ProfileSettingsCategoryId;
  title: string;
  profile: Profile | null;
  sport?: boolean;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (sectionId) titleRef.current?.focus();
  }, [sectionId, title]);

  return (
    <header
      className={`settings-page-header flex min-h-12 items-center justify-between gap-3 ${sport ? "settings-page-header-sport" : ""}`}
      data-settings-page-header="true"
    >
      <div className="flex min-w-0 items-center gap-3">
        {sectionId ? (
          <Link
            to="/profile"
            aria-label="Zurück zu Einstellungen"
            className="settings-header-back inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card/70 text-foreground transition hover:border-[var(--menu-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--menu-accent)]"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        ) : (
          <AloPageSidebarTrigger />
        )}
        <h1
          ref={titleRef}
          tabIndex={sectionId ? -1 : undefined}
          className="truncate text-xl font-bold tracking-tight focus:outline-none sm:text-2xl"
        >
          {title}
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          to="/"
          aria-label="Zur Alo-Startseite"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border/70 bg-card/70 px-2 text-xs font-semibold text-foreground transition hover:border-[var(--menu-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--menu-accent)] sm:px-3 sm:text-sm"
        >
          ← Startseite
        </Link>
        <Link
          to="/settings/$category"
          params={{ category: "profile" }}
          aria-label="Profil & Konto öffnen"
          title="Profil & Konto"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--menu-accent-border)] bg-[var(--menu-accent-soft)] text-sm font-bold text-[var(--menu-accent)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--menu-accent)]"
        >
          <ProfileAvatar profile={profile} />
        </Link>
      </div>
    </header>
  );
}

function ProfileAvatar({ profile }: { profile: Profile | null }) {
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />;
  }
  return <span aria-hidden="true">{(profile?.display_name || "?").slice(0, 1).toUpperCase()}</span>;
}

function ProfileSummaryCard({
  variant,
  profile,
  email,
  isAnonymous,
  loading,
  profileError,
  workoutsLoading,
  workoutsError,
  lp,
  streak,
  streakActive,
}: {
  variant: "classic" | "sport";
  profile: Profile | null;
  email: string;
  isAnonymous: boolean;
  loading: boolean;
  profileError: boolean;
  workoutsLoading: boolean;
  workoutsError: boolean;
  lp: ReturnType<typeof levelProgress>;
  streak: number;
  streakActive: boolean;
}) {
  const sport = variant === "sport";
  return (
    <section
      className={
        sport
          ? "sport-identity-card relative overflow-hidden rounded-[2rem] border border-primary/25 bg-gradient-to-br from-primary/15 via-card/85 to-background p-5 shadow-sm sm:p-8"
          : "settings-profile-card relative overflow-hidden rounded-3xl border border-border bg-card/70 p-5 backdrop-blur sm:p-6"
      }
      aria-label="Athletenprofil"
      data-profile-summary-card="true"
    >
      {sport && (
        <>
          <div className="absolute right-0 top-0 h-48 w-48 translate-x-1/4 -translate-y-1/4 rounded-full border border-primary/15" />
          <div className="absolute right-8 top-8 h-28 w-28 rounded-full border border-primary/15" />
        </>
      )}
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          className={`flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[1.5rem] border border-primary/30 bg-background/70 text-3xl font-bold ${sport ? "shadow-inner" : ""}`}
        >
          <ProfileAvatar profile={profile} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Athlet{isAnonymous ? " · Gastzugang" : "enprofil"}
          </p>
          <h2 className="mt-2 truncate text-2xl font-bold tracking-tight sm:text-3xl">
            {profile?.display_name || (loading ? "Profil wird geladen…" : "Ohne Namen")}
          </h2>
          <p className="mt-1 break-words text-sm text-muted-foreground">
            {isAnonymous ? "Kein Konto verknüpft" : email}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-xs font-semibold">
              {loading
                ? "Profil wird geladen…"
                : profileError
                  ? "Profil nicht verfügbar"
                  : `Level ${lp.level} · ${lp.title}`}
            </span>
            <span className="rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-xs font-semibold">
              {loading ? "Lädt…" : profileError ? "—" : `${lp.xp.toLocaleString("de-DE")} XP`}
            </span>
            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${streakActive && streak > 0 ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background/60 text-muted-foreground"}`}
            >
              {workoutsLoading
                ? "Trainings werden geladen…"
                : workoutsError
                  ? "Serie nicht verfügbar"
                  : streak > 0 && streakActive
                    ? `${streak} Tage Serie`
                    : "Noch keine Trainingsserie"}
            </span>
          </div>
        </div>
      </div>
      <div className="relative mt-6">
        <div className="mb-2 flex justify-between gap-3 text-xs text-muted-foreground">
          <span>Fortschritt zum nächsten Level</span>
          <span>{profileError ? "—" : `${Math.round(lp.progress * 100)}%`}</span>
        </div>
        <div
          className="h-3 w-full overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-label="Fortschritt zum nächsten Level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={profileError ? 0 : Math.round(lp.progress * 100)}
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: profileError ? "0%" : `${lp.progress * 100}%` }}
          />
        </div>
      </div>
    </section>
  );
}

function SettingsCategoryGroups() {
  return (
    <nav aria-label="Einstellungsbereiche" className="space-y-5" data-settings-category-list="true">
      {PROFILE_SETTINGS_GROUPS.map((group, index) => {
        const headingId = `settings-group-${index}`;
        return (
          <section key={group.title} aria-labelledby={headingId}>
            <h2
              id={headingId}
              className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground"
            >
              {group.title}
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.categories.map((categoryId) => (
                <SettingsCategoryRow key={categoryId} categoryId={categoryId} />
              ))}
            </div>
          </section>
        );
      })}
    </nav>
  );
}

function SettingsCategoryScreen({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <div className="settings-category-screen space-y-4" data-settings-category-screen="true">
      <section className="rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--menu-accent)]">
          Alo · Einstellungen
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      </section>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function SettingsBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5">
      <h2 className="text-sm font-bold">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

type SettingsCategoryContentProps = {
  categoryId: ProfileSettingsCategoryId;
  profile: Profile | null;
  profileLoading: boolean;
  profileError: boolean;
  workouts: Workout[];
  workoutsLoading: boolean;
  workoutsError: boolean;
  displayName: string;
  setDisplayName: (value: string) => void;
  avatarUrl: string;
  setAvatarUrl: (value: string) => void;
  saving: boolean;
  message: string | null;
  onSave: () => void;
  isAnonymous: boolean;
  upgradeEmail: string;
  setUpgradeEmail: (value: string) => void;
  upgradePassword: string;
  setUpgradePassword: (value: string) => void;
  upgrading: boolean;
  upgradeMessage: string | null;
  onUpgrade: (event: FormEvent) => void;
  onSignOut: () => void;
  shareActivity: boolean;
  onToggleShare: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
  hapticsOn: boolean;
  onToggleHaptics: () => void;
  onDeleteWorkout: (id: string) => void;
  onRestartTour: () => void;
};

function SettingsCategoryContent(props: SettingsCategoryContentProps) {
  const {
    categoryId,
    profile,
    profileLoading,
    profileError,
    workouts,
    workoutsLoading,
    workoutsError,
  } = props;

  switch (categoryId) {
    case "profile":
      return (
        <>
          <SettingsBlock title="Profil bearbeiten">
            <Field
              label="Anzeigename"
              value={props.displayName}
              onChange={props.setDisplayName}
              maxLength={60}
            />
            <Field
              label="Avatar-URL"
              value={props.avatarUrl}
              onChange={props.setAvatarUrl}
              placeholder="https://…"
              maxLength={500}
            />
            {props.message && (
              <p role="status" className="text-sm text-muted-foreground">
                {props.message}
              </p>
            )}
            <button
              type="button"
              onClick={props.onSave}
              disabled={props.saving || !profile}
              className="min-h-11 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {props.saving ? "Speichere…" : "Profil speichern"}
            </button>
          </SettingsBlock>
          {props.isAnonymous && (
            <SettingsBlock title="Fortschritt sichern">
              <p className="text-sm text-muted-foreground">
                Erstelle ein Konto, um XP, Trainingsserien und Bestwerte zu behalten.
              </p>
              <form onSubmit={props.onUpgrade} className="space-y-3">
                <Field
                  label="E-Mail"
                  value={props.upgradeEmail}
                  onChange={props.setUpgradeEmail}
                  placeholder="name@example.com"
                />
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    Passwort
                  </span>
                  <input
                    type="password"
                    value={props.upgradePassword}
                    onChange={(event) => props.setUpgradePassword(event.target.value)}
                    placeholder="Mindestens 6 Zeichen"
                    className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-base outline-none focus:border-primary"
                  />
                </label>
                {props.upgradeMessage && (
                  <p role="status" className="text-sm text-muted-foreground">
                    {props.upgradeMessage}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={props.upgrading}
                  className="min-h-11 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {props.upgrading ? "Erstelle…" : "Konto erstellen"}
                </button>
              </form>
            </SettingsBlock>
          )}
          <SettingsBlock title="Konto">
            <p className="text-sm text-muted-foreground">
              {props.isAnonymous ? "Gastzugang" : "Angemeldet"} ·{" "}
              {props.isAnonymous
                ? "Kein Konto verknüpft"
                : "Dein Fortschritt bleibt deinem Konto zugeordnet."}
            </p>
            <button
              type="button"
              onClick={props.onSignOut}
              className="min-h-11 w-full rounded-xl border border-border px-4 py-3 text-left text-sm font-semibold text-muted-foreground transition hover:text-destructive"
            >
              Abmelden
            </button>
          </SettingsBlock>
        </>
      );
    case "apps":
      return (
        <SettingsBlock title="Apps mit eigenen Einstellungen">
          <AppsSettingsList />
        </SettingsBlock>
      );
    case "appearance":
      return (
        <>
          <SettingsBlock title="Menüfarbe">
            <MenuAccentPicker />
          </SettingsBlock>
          <SettingsBlock title="Farbwelt">
            <ThemePicker profileId={profile?.id} initialTheme={profile?.theme ?? null} />
          </SettingsBlock>
          <SettingsBlock title="Designstil">
            <DesignStylePicker />
          </SettingsBlock>
          <SettingsBlock title="Homebar & Navigation">
            <NavigationLayoutPicker />
          </SettingsBlock>
        </>
      );
    case "training":
      return (
        <SettingsBlock title="Smart Coach">
          {profile ? (
            <CoachPanel
              profile={{
                ...profile,
                best_count: profile.best_count ?? 0,
                longest_streak: profile.longest_streak ?? 0,
                streak_freezes: profile.streak_freezes ?? 0,
              }}
              workouts={workouts}
            />
          ) : (
            <p role={profileError ? "alert" : "status"} className="text-sm text-muted-foreground">
              {profileLoading ? "Profil wird geladen…" : "Coach ist nicht verfügbar."}
            </p>
          )}
        </SettingsBlock>
      );
    case "community":
      return (
        <>
          {profile && (
            <SettingsBlock title="Freunde">
              <FriendsPanel userId={profile.id} />
            </SettingsBlock>
          )}
          <SettingsBlock title="Badges">
            <BadgeGallery />
          </SettingsBlock>
          {profile && (
            <SettingsBlock title="Öffentliches Profil">
              <PublicProfileSettings />
            </SettingsBlock>
          )}
        </>
      );
    case "notifications":
      return (
        <SettingsBlock title="Erinnerungen">
          <NotificationSettings />
        </SettingsBlock>
      );
    case "controls":
      return (
        <SettingsBlock title="Bedienung">
          <ToggleRow label="Sound" on={props.soundOn} onToggle={props.onToggleSound} />
          <ToggleRow label="Vibration" on={props.hapticsOn} onToggle={props.onToggleHaptics} />
        </SettingsBlock>
      );
    case "privacy":
      return (
        <>
          <SettingsBlock title="Aktivität teilen">
            <ToggleRow
              label="Aktivität mit anderen teilen"
              on={props.shareActivity}
              onToggle={props.onToggleShare}
            />
          </SettingsBlock>
          <SettingsBlock title="Daten & Datenschutz">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Öffne die geräteübergreifenden Datenschutzoptionen oder verwalte Mira-Datenfreigaben
              getrennt in den Einstellungen der Mira-App.
            </p>
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(new CustomEvent("alo-open", { detail: "privacy" }))
              }
              className="min-h-11 w-full rounded-xl border border-border px-4 py-3 text-left text-sm font-semibold transition hover:border-[var(--menu-accent)]"
            >
              Daten & Datenschutz · Auf allen Geräten
            </button>
            <Link
              to="/settings/apps/$appId"
              params={{ appId: "mira" }}
              search={{ from: "/ai" }}
              className="inline-flex min-h-11 w-full items-center rounded-xl border border-border px-4 py-3 text-sm font-semibold transition hover:border-[var(--menu-accent)]"
            >
              Mira-Datenfreigaben öffnen
            </Link>
          </SettingsBlock>
        </>
      );
    case "history":
      return (
        <SettingsBlock title="Letzte Trainings">
          {workoutsLoading ? (
            <p role="status" className="text-sm text-muted-foreground">
              Trainings werden geladen…
            </p>
          ) : workoutsError ? (
            <p role="alert" className="text-sm text-muted-foreground">
              Trainingsverlauf konnte nicht geladen werden.
            </p>
          ) : workouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Trainings erfasst.</p>
          ) : (
            <ul className="space-y-2">
              {workouts.slice(0, 8).map((workout) => (
                <li
                  key={workout.id}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <span className="min-w-0 break-words">
                    {workout.count}{" "}
                    {historyExercise(workout.exercise_id)?.unit === "seconds"
                      ? "Sekunden"
                      : historyExercise(workout.exercise_id)?.unit === "reps"
                        ? "Wiederholungen"
                        : ""}{" "}
                    · {new Date(workout.created_at).toLocaleDateString("de-DE")}
                    {profile && readWorkoutMetadata(localStorage, profile.id, workout.id)?.partial
                      ? " · Teiltraining"
                      : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => props.onDeleteWorkout(workout.id)}
                    className="min-h-11 shrink-0 px-2 text-xs font-semibold text-muted-foreground hover:text-destructive"
                    aria-label={`Training vom ${new Date(workout.created_at).toLocaleDateString("de-DE")} löschen`}
                  >
                    Löschen
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SettingsBlock>
      );
    case "support":
      return (
        <>
          <SettingsBlock title="Willkommenstour">
            <p className="text-sm text-muted-foreground">
              Die kurze Tour kannst du jederzeit erneut starten.
            </p>
            <button
              type="button"
              onClick={props.onRestartTour}
              className="min-h-11 w-full rounded-xl border border-border px-4 py-3 text-left text-sm font-semibold hover:border-[var(--menu-accent)]"
            >
              Willkommenstour starten
            </button>
          </SettingsBlock>
          <SettingsBlock title="Kurzanleitung">
            <AloWebAppGuide />
          </SettingsBlock>
          <SettingsBlock title="Fehlerberichte">
            <ErrorReportsPanel />
          </SettingsBlock>
        </>
      );
  }
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
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-base outline-none focus:border-primary"
      />
    </label>
  );
}

function ToggleRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex min-h-11 w-full items-center justify-between gap-4 rounded-xl border border-border px-3 py-3 text-left text-sm"
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${on ? "bg-primary" : "bg-secondary"}`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-background transition ${on ? "translate-x-5" : ""}`}
        />
      </span>
    </button>
  );
}
