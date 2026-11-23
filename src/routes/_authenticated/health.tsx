import {
  Activity,
  ArrowRight,
  Dumbbell,
  Flame,
  Footprints,
  HeartPulse,
  Moon,
  Plus,
  Watch,
} from "lucide-react";
import { DesignView } from "@/components/DesignView";
import { createFileRoute, Link } from "@tanstack/react-router";
import { localDateKey } from "@/lib/training-dates";
import { HealthEntryInputError, mergeHealthEntryMetrics } from "@/lib/health-entry";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { AloHomeLink } from "@/components/AloHomeLink";
import { AppSettingsGear } from "@/components/settings/AppSettingsGear";
import { AloPageSidebar, AloPageSidebarTrigger } from "@/components/alo/AloPageSidebar";
import { HomeAppMenuSidebar } from "@/components/HomeAppMenuLayout";
import { SmartwatchPanel } from "@/components/SmartwatchPanel";
import { HealthConnectPanel } from "@/components/HealthConnectPanel";
import { WeightTrendCard } from "@/components/WeightTrendCard";
import { SleepDebtCard } from "@/components/SleepDebtCard";
import { WeeklyStepsGoal } from "@/components/WeeklyStepsGoal";
import { SportPageIntro, SportSectionLabel } from "@/components/SportPageIntro";
import { averageMeasuredHealthValue, measuredHealthValue } from "@/lib/health-glance";
import { ReadinessCard } from "@/components/ReadinessCard";
import { RecoveryCalendar } from "@/components/RecoveryCalendar";
import { WaterTracker } from "@/components/WaterTracker";
import { MoodCheckin } from "@/components/MoodCheckin";
import { GymVisitCalendar } from "@/components/GymVisitCalendar";
import { SmartRestTimer } from "@/components/SmartRestTimer";
import { HealthToolbox } from "@/components/HealthToolbox";

function HealthActionsSidebar() {
  const links = [
    { href: "#health-today", label: "Heute" },
    { href: "#health-activity", label: "Aktivität" },
    { href: "#health-sleep", label: "Schlaf" },
    { href: "#health-fitness", label: "Fitness" },
    { href: "#health-sources", label: "Quellen" },
  ];
  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Bereiche
      </p>
      {links.map((entry) => (
        <a
          key={entry.href}
          href={entry.href}
          className="rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-card"
        >
          {entry.label}
        </a>
      ))}
      <p className="px-1 pt-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Sport verbinden
      </p>
      <Link
        to="/sports"
        className="rounded-lg px-3 py-2 text-left text-sm font-semibold text-primary hover:underline"
      >
        Alo Sports öffnen
      </Link>
      <Link
        to="/football"
        className="rounded-lg px-3 py-2 text-left text-sm font-semibold text-primary hover:underline"
      >
        Alo Fußball öffnen
      </Link>
      <Link
        to="/training"
        className="rounded-lg px-3 py-2 text-left text-sm font-semibold text-primary hover:underline"
      >
        Alo Training öffnen
      </Link>
      <Link
        to="/calisthenics"
        className="rounded-lg px-3 py-2 text-left text-sm font-semibold text-primary hover:underline"
      >
        Calisthenics öffnen
      </Link>
      <Link
        to="/exercises"
        className="rounded-lg px-3 py-2 text-left text-sm font-semibold text-primary hover:underline"
      >
        Übungen öffnen
      </Link>
      <Link
        to="/coach"
        className="rounded-lg px-3 py-2 text-left text-sm font-semibold text-primary hover:underline"
      >
        Coach öffnen
      </Link>
      <Link
        to="/marketplace"
        className="rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-card"
      >
        Marketplace öffnen
      </Link>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/health")({
  head: () => ({
    meta: [
      { title: "Health Connect — Alo" },
      {
        name: "description",
        content:
          "Google Health Connect, Smartwatch und Gesundheitsdaten mit dem Training verbinden.",
      },
      { property: "og:title", content: "Health Connect — Alo" },
      { property: "og:description", content: "Schritte, Schlaf und Aktivität synchronisieren." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HealthPage,
});

type Entry = {
  day: string;
  steps: number;
  active_kcal: number;
  weight_kg: number | null;
  sleep_min: number;
  source: string;
};

const today = () => localDateKey(new Date());

function HealthPage() {
  const { user } = Route.useRouteContext();
  const userId = user.id;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [day, setDay] = useState(today());
  const [steps, setSteps] = useState("");
  const [kcal, setKcal] = useState("");
  const [weight, setWeight] = useState("");
  const [sleepH, setSleepH] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const { data, error } = await supabase
        .from("health_entries")
        .select("day, steps, active_kcal, weight_kg, sleep_min, source")
        .order("day", { ascending: false })
        .limit(14);
      if (error) throw error;
      setEntries((data ?? []) as Entry[]);
    } catch {
      setHistoryError("Der Verlauf konnte nicht geladen werden.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Konto + Streak nur lesend laden (keine DB-Änderung)
  const [streak, setStreak] = useState(0);
  const [showRestTimer, setShowRestTimer] = useState(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data: p, error } = await supabase
          .from("profiles")
          .select("current_streak")
          .eq("id", userId)
          .maybeSingle();
        if (error) throw error;
        if (active && p) {
          setStreak((p as { current_streak: number | null }).current_streak ?? 0);
        }
      } catch {
        // Streak is optional; the health page remains usable without it.
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { data: existing, error: readError } = await supabase
        .from("health_entries")
        .select("steps, active_kcal, weight_kg, sleep_min")
        .eq("user_id", userId)
        .eq("day", day)
        .maybeSingle();
      if (readError) throw readError;

      const metrics = mergeHealthEntryMetrics(existing, {
        steps,
        kcal,
        weight,
        sleepHours: sleepH,
      });
      const payload = {
        user_id: userId,
        day,
        ...metrics,
        source: "manual",
      };
      const { error } = await supabase
        .from("health_entries")
        .upsert(payload, { onConflict: "user_id,day" });
      if (error) throw error;

      let profileWeightSaved = true;
      if (weight.trim() && payload.weight_kg !== null) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ weight_kg: payload.weight_kg })
          .eq("id", userId);
        profileWeightSaved = !profileError;
      }
      setMsg(
        profileWeightSaved
          ? "Gesundheitsdaten gespeichert ✓"
          : "Gesundheitsdaten gespeichert; Profilgewicht konnte nicht aktualisiert werden.",
      );
      setSteps("");
      setKcal("");
      setSleepH("");
      void load();
    } catch (error) {
      setMsg(
        error instanceof HealthEntryInputError
          ? error.message
          : "Speichern fehlgeschlagen. Verbindung prüfen und erneut versuchen.",
      );
    } finally {
      setBusy(false);
    }
  };

  const weekStart = new Date(`${today()}T12:00:00Z`);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const week = entries.filter(
    (entry) => entry.day >= weekStart.toISOString().slice(0, 10) && entry.day <= today(),
  );
  const avgSteps = averageMeasuredHealthValue(week.map((entry) => entry.steps));
  const avgSleep = averageMeasuredHealthValue(week.map((entry) => entry.sleep_min));
  const todayEntry = entries.find((e) => e.day === today());
  const glanceSteps = measuredHealthValue(todayEntry?.steps);
  const glanceKcal = measuredHealthValue(todayEntry?.active_kcal);
  const hasTodayGlanceData =
    glanceSteps !== null ||
    glanceKcal !== null ||
    measuredHealthValue(todayEntry?.sleep_min) !== null;
  const weeklySteps = averageMeasuredHealthValue(week.map((entry) => entry.steps));
  const sleepEntries = week.filter((entry) => entry.sleep_min > 0);
  const measuredSleep = sleepEntries.length
    ? sleepEntries.reduce((sum, entry) => sum + entry.sleep_min, 0) / sleepEntries.length / 60
    : null;

  return (
    <AloPageSidebar active="health">
      <DesignView variant="classic">
        <main className="classic-only health-classic-dashboard alo-health-page alo-tablet-health mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col gap-5 px-4 pt-5 pb-28 sm:px-8">
          <header className="health-classic-header">
            <div className="health-classic-top-row">
              <div className="flex items-center gap-2">
                <AloPageSidebarTrigger />
                <AloHomeLink className="px-2 text-[10px]" />
              </div>
              <div className="flex items-center gap-2">
                <span className="health-classic-brand-pill">
                  <HeartPulse aria-hidden="true" /> Alo Health
                </span>
                <AppSettingsGear appId="health" />
              </div>
            </div>
            <p className="health-classic-kicker">DEIN WOHLBEFINDEN</p>
            <h1>Gesundheit im Blick</h1>
            <p>Schritte, Schlaf und Aktivität – mit deinen echten Messwerten an einem Ort.</p>
          </header>
          <div className="grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)] lg:items-start">
            <HomeAppMenuSidebar
              className="rounded-2xl border border-border/60 bg-card/60 p-4 lg:sticky lg:top-6"
            >
              <HealthActionsSidebar />
            </HomeAppMenuSidebar>
            <div className="flex min-w-0 flex-col gap-5">
              <nav
                className="health-category-nav health-classic-category-nav"
                aria-label="Gesundheitsbereiche"
              >
                <a href="#health-today">
                  <HeartPulse aria-hidden="true" />
                  <span>Heute</span>
                </a>
                <a href="#health-activity">
                  <Footprints aria-hidden="true" />
                  <span>Aktivität</span>
                </a>
                <a href="#health-sleep">
                  <Moon aria-hidden="true" />
                  <span>Schlaf</span>
                </a>
                <a href="#health-fitness">
                  <Dumbbell aria-hidden="true" />
                  <span>Fitness</span>
                </a>
                <a href="#health-sources">
                  <Watch aria-hidden="true" />
                  <span>Quellen</span>
                </a>
              </nav>
              <section
                id="health-today"
                tabIndex={-1}
                className="health-classic-hero"
                aria-labelledby="health-classic-today-title"
              >
                <div className="health-classic-hero-copy">
                  <p className="health-classic-kicker">DEIN TAG IM BLICK</p>
                  <h2 id="health-classic-today-title">
                    {hasTodayGlanceData ? "Deine Werte im Blick." : "Wie geht es dir heute?"}
                  </h2>
                  <p>
                    {hasTodayGlanceData
                      ? glanceSteps !== null
                        ? `Heute sind ${glanceSteps.toLocaleString("de-DE")} Schritte erfasst. Entdecke deine Aktivität und gib deiner Erholung Raum.`
                        : "Für heute sind Gesundheitswerte erfasst. Ergänze weitere Angaben, wenn du möchtest."
                      : todayEntry
                        ? "Für heute gibt es einen Eintrag, aber noch keine erfassten Werte für Schritte, Schlaf oder aktive Energie."
                        : "Noch keine Werte für heute. Verbinde deine Uhr oder erfasse Schritte, Schlaf und aktive Energie."}
                  </p>
                  <div className="health-classic-hero-actions">
                    <a href="#health-sources" className="health-classic-action-secondary">
                      <Watch aria-hidden="true" /> Verbinden
                    </a>
                    <a href="#health-entry" className="health-classic-action-primary">
                      <Plus aria-hidden="true" /> Werte erfassen <ArrowRight aria-hidden="true" />
                    </a>
                  </div>
                </div>
                <dl className="health-classic-today-measurements" aria-label="Erfasste Tageswerte">
                  {[
                    { label: "Schritte", value: glanceSteps?.toLocaleString("de-DE") },
                    { label: "Aktive kcal", value: glanceKcal?.toLocaleString("de-DE") },
                    {
                      label: "Schlaf",
                      value:
                        measuredHealthValue(todayEntry?.sleep_min) !== null
                          ? `${(todayEntry!.sleep_min / 60).toFixed(1)} h`
                          : undefined,
                    },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value ?? "—"}</dd>
                      {!value && <small>Nicht erfasst</small>}
                    </div>
                  ))}
                </dl>
              </section>
              <section
                id="health-activity"
                tabIndex={-1}
                className="health-classic-activity"
                aria-label="Aktivität und Wochenübersicht"
              >
                <div className="health-classic-metrics-grid">
                  <Card
                    label="Ø Schritte (7T)"
                    value={
                      avgSteps.average === null
                        ? "—"
                        : Math.round(avgSteps.average).toLocaleString("de-DE")
                    }
                  />
                  <Card
                    label="Ø Schlaf (7T)"
                    value={
                      avgSleep.average === null ? "—" : `${(avgSleep.average / 60).toFixed(1)} h`
                    }
                  />
                  <Card
                    label="Aktive kcal heute"
                    value={glanceKcal === null ? "—" : glanceKcal.toLocaleString("de-DE")}
                  />
                </div>
                <div className="health-classic-widgets-grid">
                  <div className="health-classic-widget-card">
                    <WeeklyStepsGoal todaySteps={glanceSteps} />
                  </div>
                  <div
                    id="health-sleep"
                    tabIndex={-1}
                    className="health-classic-widget-card health-classic-sleep-widget"
                  >
                    <SleepDebtCard sleepMinutes={week.map((e) => e.sleep_min)} />
                  </div>
                  <div className="health-classic-widget-card">
                    <WeightTrendCard
                      points={entries
                        .filter((e) => e.weight_kg != null)
                        .map((e) => ({ day: e.day, weight_kg: e.weight_kg as number }))}
                    />
                  </div>
                </div>
              </section>

              <section
                id="health-fitness"
                tabIndex={-1}
                className="health-classic-fitness"
                aria-labelledby="health-fitness-title"
              >
                <h2 className="health-classic-section-heading" id="health-fitness-title">
                  Fitness &amp; Erholung
                </h2>
                <p className="health-classic-section-sub">
                  Readiness, Gelenk-Belastung, Wasser, Stimmung, Gym-Besuche und Pausen-Timer –
                  gebündelt an einem Ort.
                </p>
                <div className="health-classic-widgets-grid">
                  {userId && (
                    <div className="health-classic-widget-card">
                      <ReadinessCard userId={userId} streak={streak} />
                    </div>
                  )}
                  {userId && (
                    <div className="health-classic-widget-card">
                      <RecoveryCalendar userId={userId} />
                    </div>
                  )}
                  <div className="health-classic-widget-card">
                    <WaterTracker />
                  </div>
                  <div className="health-classic-widget-card">
                    <MoodCheckin />
                  </div>
                  {userId && (
                    <div className="health-classic-widget-card">
                      <GymVisitCalendar userId={userId} />
                    </div>
                  )}
                  <div className="health-classic-widget-card">
                    {showRestTimer ? (
                      <SmartRestTimer />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowRestTimer(true)}
                        className="min-h-11 w-full rounded-xl border border-border bg-secondary/50 px-3 text-xs font-semibold"
                      >
                        <Activity aria-hidden="true" className="mr-1 inline h-4 w-4" />{" "}
                        {"Smart Pausen-Timer starten"}
                      </button>
                    )}
                  </div>
                </div>
              </section>

              <section className="health-classic-toolbox" aria-labelledby="health-toolbox-title">
                <h2 className="health-classic-section-heading" id="health-toolbox-title">
                  Werkzeuge &amp; Einblicke
                </h2>
                <HealthToolbox entries={entries} />
              </section>

              <section id="health-sources" tabIndex={-1} className="health-classic-sources">
                <h2 className="health-classic-section-heading">Verbundene Datenquellen</h2>
                <div className="health-classic-sources-grid">
                  <section className="health-classic-source-card rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
                    <h3 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Google Health Connect
                    </h3>
                    <HealthConnectPanel />
                  </section>
                  <section className="health-classic-source-card rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
                    <h3 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Smartwatch
                    </h3>
                    <SmartwatchPanel userId={userId} />
                  </section>
                </div>
              </section>

              <section className="mt-4 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
                <h2
                  id="health-entry"
                  tabIndex={-1}
                  className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground"
                >
                  Tag manuell erfassen
                </h2>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Input label="Datum" type="date" value={day} onChange={setDay} />
                  <Input
                    label="Schritte"
                    type="number"
                    value={steps}
                    onChange={setSteps}
                    placeholder="8000"
                  />
                  <Input
                    label="Aktive kcal"
                    type="number"
                    value={kcal}
                    onChange={setKcal}
                    placeholder="450"
                  />
                  <Input
                    label="Schlaf (h)"
                    type="number"
                    value={sleepH}
                    onChange={setSleepH}
                    placeholder="7.5"
                  />
                  <Input
                    label="Gewicht (kg)"
                    type="number"
                    value={weight}
                    onChange={setWeight}
                    placeholder="78"
                  />
                </div>
                {msg && <p className="mt-3 text-xs text-muted-foreground">{msg}</p>}
                <button
                  onClick={save}
                  disabled={busy}
                  className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"
                >
                  {busy ? "Speichere…" : "Speichern"}
                </button>
              </section>

              <section className="health-classic-history">
                <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Verlauf
                </h2>
                {historyLoading || historyError || entries.length === 0 ? (
                  <HistoryNotice
                    loading={historyLoading}
                    error={historyError}
                    onRetry={() => void load()}
                    className="rounded-2xl border border-border bg-card/40 p-4 text-sm text-muted-foreground"
                  />
                ) : (
                  <ul className="health-classic-history-list">
                    {entries.map((e) => (
                      <li
                        key={e.day}
                        className="health-classic-history-row flex items-center justify-between rounded-2xl border border-border bg-card/40 px-4 py-3 text-xs"
                      >
                        <span className="font-semibold">
                          {new Date(e.day).toLocaleDateString("de-DE")}
                          {(e.source === "health_connect" ||
                            e.source === "watch" ||
                            e.source?.startsWith("watch")) && (
                            <span className="ml-2 text-[10px] text-primary">
                              {e.source === "health_connect" ? "HC" : "⌚"}
                            </span>
                          )}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {e.steps > 0 ? e.steps.toLocaleString("de-DE") : "—"} ·{" "}
                          {e.active_kcal > 0 ? `${e.active_kcal} kcal` : "—"} ·{" "}
                          {e.sleep_min > 0 ? `${(e.sleep_min / 60).toFixed(1)} h` : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <BottomNav />
            </div>
          </div>
        </main>
      </DesignView>
      <DesignView variant="sport">
        <main className="sport-only sport-health-page alo-health-page alo-tablet-health mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col gap-6 px-5 py-6 pb-28 sm:px-8">
          <div className="health-page-intro">
            <SportPageIntro
              eyebrow="DEIN WOHLBEFINDEN"
              title="Gesundheit"
              description="Schritte, Schlaf und Aktivität – als Trainingskontext an einem Ort."
            >
              <AloPageSidebarTrigger />
              <AloHomeLink />
              <AppSettingsGear appId="health" className="ml-auto" />
            </SportPageIntro>
          </div>
          <div className="grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)] lg:items-start">
            <HomeAppMenuSidebar
              className="rounded-2xl border border-border/60 bg-card/60 p-4 lg:sticky lg:top-6"
            >
              <HealthActionsSidebar />
            </HomeAppMenuSidebar>
            <div className="flex min-w-0 flex-col gap-5">
              <nav className="health-category-nav" aria-label="Gesundheitsbereiche">
                <a href="#health-today">
                  <HeartPulse aria-hidden="true" />
                  <span>Heute</span>
                </a>
                <a href="#health-activity">
                  <Footprints aria-hidden="true" />
                  <span>Aktivität</span>
                </a>
                <a href="#health-sleep">
                  <Moon aria-hidden="true" />
                  <span>Schlaf</span>
                </a>
                <a href="#health-fitness">
                  <Dumbbell aria-hidden="true" />
                  <span>Fitness</span>
                </a>
                <a href="#health-sources">
                  <Watch aria-hidden="true" />
                  <span>Quellen</span>
                </a>
              </nav>
              <section
                id="health-today"
                tabIndex={-1}
                className="health-daily-hero"
                aria-labelledby="health-daily-title"
              >
                <span className="health-hero-icon" aria-hidden="true">
                  <HeartPulse aria-hidden="true" />
                </span>
                <p className="sport-kicker">Dein Tag im Blick</p>
                <h2 id="health-daily-title">
                  {hasTodayGlanceData ? "Deine Werte im Blick." : "Wie geht es dir heute?"}
                </h2>
                <p>
                  {hasTodayGlanceData
                    ? glanceSteps !== null
                      ? `Heute sind ${glanceSteps.toLocaleString("de-DE")} Schritte erfasst. Entdecke deine Aktivität und gib deiner Erholung Raum.`
                      : "Für heute sind Gesundheitswerte erfasst. Ergänze weitere Angaben, wenn du möchtest."
                    : todayEntry
                      ? "Für heute gibt es einen Eintrag, aber noch keine erfassten Werte für Schritte, Schlaf oder aktive Energie."
                      : "Noch keine Werte für heute. Verbinde deine Uhr oder erfasse Schritte, Schlaf und aktive Energie."}
                </p>
                {hasTodayGlanceData && (
                  <dl className="health-today-measurements" aria-label="Erfasste Tageswerte">
                    {[
                      { label: "Schritte", value: glanceSteps?.toLocaleString("de-DE") },
                      { label: "Aktive kcal", value: glanceKcal?.toLocaleString("de-DE") },
                      {
                        label: "Schlaf",
                        value:
                          measuredHealthValue(todayEntry?.sleep_min) !== null
                            ? `${(todayEntry!.sleep_min / 60).toFixed(1)} h`
                            : undefined,
                      },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value ?? "—"}</dd>
                        {!value && <small>Nicht erfasst</small>}
                      </div>
                    ))}
                  </dl>
                )}
                <div className="health-hero-actions">
                  <a href="#health-sources" className="health-source-action">
                    <Watch aria-hidden="true" /> Verbinden
                  </a>
                  <a href="#health-entry" className="health-hero-action">
                    <Plus aria-hidden="true" /> <span>Werte erfassen</span>{" "}
                    <ArrowRight aria-hidden="true" />
                  </a>
                </div>
              </section>
              <section
                id="health-activity"
                tabIndex={-1}
                className="health-bento-grid grid grid-cols-2 gap-3"
              >
                <div className="health-energy-card">
                  <div className="health-card-heading">
                    <Flame aria-hidden="true" />
                    <span>Energie &amp; Schritte</span>
                  </div>
                  <div className="health-energy-values">
                    <div>
                      <strong>
                        {glanceKcal !== null ? glanceKcal.toLocaleString("de-DE") : "—"}
                      </strong>
                      <span>
                        {glanceKcal !== null ? "Aktive kcal" : "Aktive kcal · nicht erfasst"}
                      </span>
                    </div>
                    <div>
                      <strong>
                        {glanceSteps !== null ? glanceSteps.toLocaleString("de-DE") : "—"}
                      </strong>
                      <span>{glanceSteps !== null ? "Schritte" : "Schritte · nicht erfasst"}</span>
                    </div>
                  </div>
                  <p>
                    {hasTodayGlanceData
                      ? "Mindestens ein Wert heute erfasst"
                      : "Noch keine Messwerte"}
                  </p>
                </div>
                <div className="health-activity-card">
                  <div className="health-card-heading">
                    <Footprints aria-hidden="true" />
                    <span>Schritte · letzte 7 Tage</span>
                  </div>
                  {weeklySteps.average === null ? (
                    <div className="health-week-empty">
                      <p>Noch keine Schrittwerte erfasst.</p>
                      <a href="#health-entry">
                        Wert erfassen <ArrowRight aria-hidden="true" />
                      </a>
                    </div>
                  ) : (
                    <div className="health-week-value">
                      <strong>{Math.round(weeklySteps.average).toLocaleString("de-DE")}</strong>
                      <span>Schritte pro erfasstem Tag</span>
                      <p>
                        {weeklySteps.count} {weeklySteps.count === 1 ? "Tag" : "Tage"} mit Messwert
                      </p>
                    </div>
                  )}
                </div>
              </section>
              <section className="health-sleep-card" aria-labelledby="health-sleep-title">
                <div className="health-sleep-icon">
                  <Moon aria-hidden="true" />
                </div>
                <div>
                  <p className="health-sleep-label">Erholung</p>
                  <h2 id="health-sleep-title">Schlaf</h2>
                  <p className="health-sleep-detail">
                    {measuredSleep == null
                      ? "Noch keine Schlafdaten erfasst"
                      : `Ø ${measuredSleep.toFixed(1)} h · ${sleepEntries.length} ${sleepEntries.length === 1 ? "Nacht" : "Nächte"} erfasst`}
                  </p>
                  {measuredSleep == null && (
                    <a className="health-sleep-action" href="#health-entry">
                      Schlaf erfassen
                    </a>
                  )}
                </div>
                {measuredSleep != null && (
                  <strong>
                    {measuredSleep.toFixed(1)}
                    <span> h</span>
                  </strong>
                )}
              </section>
              <div id="health-sleep" tabIndex={-1} className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-5">
                  <WeeklyStepsGoal todaySteps={glanceSteps} />
                  <SleepDebtCard sleepMinutes={week.map((e) => e.sleep_min)} />
                </div>
                <WeightTrendCard
                  points={entries
                    .filter((e) => e.weight_kg != null)
                    .map((e) => ({ day: e.day, weight_kg: e.weight_kg as number }))}
                />
              </div>
              <SportSectionLabel number="01">Fitness &amp; Erholung</SportSectionLabel>
              <section
                id="health-fitness"
                tabIndex={-1}
                className="grid gap-4 md:grid-cols-2"
                aria-label="Fitness und Erholung gebündelt"
              >
                {userId && <ReadinessCard userId={userId} streak={streak} />}
                {userId && <RecoveryCalendar userId={userId} />}
                <WaterTracker />
                <MoodCheckin />
                {userId && <GymVisitCalendar userId={userId} />}
                {showRestTimer ? (
                  <SmartRestTimer />
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowRestTimer(true)}
                    className="min-h-11 rounded-2xl border border-border/70 bg-card/75 px-4 text-sm font-semibold"
                  >
                    <Activity aria-hidden="true" className="mr-1 inline h-4 w-4" />{" "}
                    {"Smart Pausen-Timer starten"}
                  </button>
                )}
              </section>
              <SportSectionLabel number="02">Werkzeuge &amp; Einblicke</SportSectionLabel>
              <section aria-label="Werkzeuge und Einblicke">
                <HealthToolbox entries={entries} />
              </section>
              <SportSectionLabel number="03">Verbundene Datenquellen</SportSectionLabel>
              <div id="health-sources" tabIndex={-1} className="grid gap-4 md:grid-cols-2">
                <section className="rounded-[1.75rem] border border-border/70 bg-card/75 p-6">
                  <h2 className="mb-4 text-lg font-bold">Google Health Connect</h2>
                  <HealthConnectPanel />
                </section>
                <section className="rounded-[1.75rem] border border-border/70 bg-card/75 p-6">
                  <h2 className="mb-4 text-lg font-bold">Smartwatch</h2>
                  <SmartwatchPanel userId={userId} />
                </section>
              </div>
              <SportSectionLabel number="04">Eintrag erfassen</SportSectionLabel>
              <section
                id="health-entry"
                tabIndex={-1}
                className="rounded-[1.75rem] border border-border/70 bg-card/75 p-6"
              >
                <p className="mb-5 max-w-xl text-sm text-muted-foreground">
                  Trage Werte manuell nach. Ein gespeicherter Gewichtswert aktualisiert auch dein
                  Profil.
                </p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {[
                    <Input key="day" label="Datum" type="date" value={day} onChange={setDay} />,
                    <Input
                      key="steps"
                      label="Schritte"
                      type="number"
                      value={steps}
                      onChange={setSteps}
                      placeholder="8000"
                    />,
                    <Input
                      key="kcal"
                      label="Aktive kcal"
                      type="number"
                      value={kcal}
                      onChange={setKcal}
                      placeholder="450"
                    />,
                    <Input
                      key="sleep"
                      label="Schlaf (h)"
                      type="number"
                      value={sleepH}
                      onChange={setSleepH}
                      placeholder="7.5"
                    />,
                    <Input
                      key="weight"
                      label="Gewicht (kg)"
                      type="number"
                      value={weight}
                      onChange={setWeight}
                      placeholder="78"
                    />,
                  ]}
                </div>
                {msg && <p className="mt-4 text-sm text-muted-foreground">{msg}</p>}
                <button
                  onClick={save}
                  disabled={busy}
                  className="mt-5 w-full rounded-2xl bg-primary px-5 py-4 text-sm font-bold text-primary-foreground transition active:scale-[0.99] disabled:opacity-60 sm:w-auto sm:min-w-48"
                >
                  {busy ? "Speichere…" : "Werte speichern"}
                </button>
              </section>
              <SportSectionLabel number="05">Verlauf · letzte 14 Tage</SportSectionLabel>
              {historyLoading || historyError || entries.length === 0 ? (
                <HistoryNotice
                  loading={historyLoading}
                  error={historyError}
                  onRetry={() => void load()}
                  className="rounded-2xl border border-border/70 bg-card/60 p-5 text-sm text-muted-foreground"
                />
              ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                  {entries.map((e) => (
                    <li
                      key={e.day}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/60 p-4"
                    >
                      <div>
                        <div className="font-semibold">
                          {new Date(e.day).toLocaleDateString("de-DE")}
                          {(e.source === "health_connect" ||
                            e.source === "watch" ||
                            e.source?.startsWith("watch")) && (
                            <span className="ml-2 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">
                              {e.source === "health_connect" ? "HC" : "⌚"}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {e.steps > 0
                            ? `${e.steps.toLocaleString("de-DE")} Schritte`
                            : "Schritte nicht erfasst"}
                        </div>
                      </div>
                      <div className="text-right text-xs tabular-nums text-muted-foreground">
                        {e.active_kcal > 0 ? `${e.active_kcal} kcal` : "kcal nicht erfasst"}
                        <br />
                        {e.sleep_min > 0
                          ? `${(e.sleep_min / 60).toFixed(1)} h Schlaf`
                          : "Schlaf nicht erfasst"}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <BottomNav />
            </div>
          </div>
        </main>
      </DesignView>
    </AloPageSidebar>
  );
}

function HistoryNotice({
  loading,
  error,
  onRetry,
  className,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  className: string;
}) {
  if (loading)
    return (
      <p role="status" className={className}>
        Lade Gesundheitsdaten…
      </p>
    );
  if (!error) return <p className={className}>Noch keine Gesundheitsdaten.</p>;

  return (
    <div role="alert" className={className}>
      <p>{error}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 min-h-11 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/50"
      >
        Erneut versuchen
      </button>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 px-4 py-4 backdrop-blur">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className={`block min-w-0 ${type === "date" ? "col-span-full" : ""}`}>
      <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="box-border w-full min-w-0 max-w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}
