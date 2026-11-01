import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Dumbbell, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { GymVisitCalendar } from "@/components/GymVisitCalendar";
import {
  addGymSet,
  closeGymSession,
  createGymSession,
  deleteGymSet,
  getGymHistory,
  getGymSnapshot,
  joinGymSession,
  setGymSharing,
  setGymVisitSharing,
  type GymSnapshot,
} from "@/lib/gym-partner";

const control = "min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";
const button =
  "min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50";
const secondary =
  "min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-medium disabled:opacity-50";
const formatNumber = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 });

/** A new mount on account changes deliberately drops all in-memory partner and history data. */
export function GymPartnerPanel() {
  const [account, setAccount] = useState<{ id: string; guest: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    let authEventReceived = false;
    const apply = (user: { id: string; is_anonymous?: boolean } | null) => {
      if (alive) setAccount(user ? { id: user.id, guest: !!user.is_anonymous } : null);
    };
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventReceived = true;
      apply(session?.user ?? null);
    });
    void supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!authEventReceived) apply(data.user);
      })
      .catch(() => {
        if (!authEventReceived) apply(null);
      });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <section
      className="my-5 rounded-3xl border border-border bg-card p-5"
      aria-labelledby="gym-partner-title"
    >
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Gym · Zu zweit
          </p>
          <h2 id="gym-partner-title" className="text-xl font-bold">
            Gemeinsam trainieren. Eigene Fortschritte.
          </h2>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Zwei Konten, eine Einheit: Sätze, Gewicht und Wiederholungen getrennt erfassen. Nur bewusst
        freigegebene Stats und Besuchstage sind für den Partner sichtbar.
      </p>
      {!account ? (
        <p className="mt-4 text-sm">Konto wird geprüft …</p>
      ) : account.guest ? (
        <div className="mt-4 space-y-2 text-sm">
          <p>
            Für den gemeinsamen Gym-Modus braucht ihr beide ein eigenes, registriertes Konto. Ein
            Gastkonto reicht nicht.
          </p>
          <Link to="/auth" className="inline-flex min-h-11 items-center font-semibold text-primary">
            Anmelden oder Konto erstellen
          </Link>
        </div>
      ) : (
        <GymAccountPanel key={account.id} userId={account.id} />
      )}
    </section>
  );
}

function GymAccountPanel({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<GymSnapshot | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getGymHistory>> | null>(null);
  const [alias, setAlias] = useState("");
  const [code, setCode] = useState("");
  const [exercise, setExercise] = useState("Bankdrücken");
  const [reps, setReps] = useState("10");
  const [weight, setWeight] = useState("0");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [closing, setClosing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [visitRevision, setVisitRevision] = useState(0);
  const alive = useRef(true);
  const generation = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current++;
    };
  }, []);

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    try {
      const next = await getGymSnapshot();
      if (!alive.current || request !== generation.current) return;
      // Never render a response belonging to a different account after an auth transition.
      if (next && next.own.userId !== userId) {
        setSnapshot(null);
        setHistory(null);
        setLoaded(false);
        setError("Das Konto hat gewechselt. Bitte den Gym-Modus erneut öffnen.");
        return;
      }
      setSnapshot(next);
      setLoaded(true);
      setLastSync(new Date());
      setError("");
    } catch (e) {
      if (!alive.current || request !== generation.current) return;
      // Remove partner data when refreshing fails: a revoked consent must not look current.
      setSnapshot(null);
      setLoaded(false);
      setError(e instanceof Error ? e.message : "Gym-Daten konnten nicht geladen werden.");
    }
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden && !pending.current) void refresh();
    }, 5000);
    const onVisible = () => {
      if (document.hidden) {
        generation.current++;
        setSnapshot(null);
        setLoaded(false);
      } else if (!pending.current) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      generation.current++;
    };
  }, [open, refresh]);

  const run = async (action: () => Promise<unknown>, success: string, invalidateHistory = true) => {
    if (pending.current) return;
    pending.current = true;
    generation.current++;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      if (!alive.current) return;
      setNotice(success);
      if (invalidateHistory) setHistory(null);
      if (invalidateHistory) setVisitRevision((revision) => revision + 1);
      setClosing(false);
      await refresh();
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "Aktion fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const showHistory = async () => {
    await run(
      async () => {
        const rows = await getGymHistory();
        if (alive.current) setHistory(rows);
      },
      "",
      false,
    );
  };

  const submitSet = (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot || snapshot.status !== "active") return;
    void run(
      () => addGymSet(snapshot.id, exercise.trim(), Number(reps), Number(weight.replace(",", "."))),
      "Satz in deinem privaten Gym-Verlauf gespeichert.",
    );
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        className={open ? secondary : button}
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          setSnapshot(null);
          setHistory(null);
          setNotice("");
          setError("");
          setLoaded(false);
        }}
      >
        {open ? "Gym-Modus einklappen" : "Gemeinsamen Gym-Modus öffnen"}
      </button>
      {open && (
        <div className="mt-4 space-y-4">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            Keine Gesundheitsdaten, keine automatischen Profil-Stats, kein Zugriff auf den
            vollständigen Verlauf. Freigabe ist pro Konto und Einheit standardmäßig aus und
            jederzeit widerrufbar.
          </p>
          {error && (
            <p role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm text-primary">
              {notice}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {lastSync
                ? `Abgleich ${lastSync.toLocaleTimeString("de-DE")} · alle 5 Sekunden`
                : "Verbinde mit deinem Konto …"}
            </p>
            <button
              type="button"
              className={secondary}
              disabled={busy}
              onClick={() => void refresh()}
            >
              <RefreshCw className="mr-2 inline h-4 w-4" aria-hidden="true" />
              Aktualisieren
            </button>
          </div>
          {loaded && !snapshot && (
            <div className="space-y-4">
              <label className="block text-sm font-medium">
                Dein Name für diese Einheit
                <input
                  className={`${control} mt-1`}
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  maxLength={40}
                  autoComplete="nickname"
                  placeholder="Zum Beispiel Hendrik"
                />
              </label>
              <button
                type="button"
                className={button}
                disabled={busy || !alias.trim()}
                onClick={() =>
                  void run(
                    () => createGymSession(alias.trim()),
                    "Einheit erstellt. Teile den Einladungscode nur mit deinem Trainingspartner.",
                  )
                }
              >
                Einheit erstellen
              </button>
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(
                    () => joinGymSession(code.trim().toUpperCase(), alias.trim()),
                    "Ihr trainiert jetzt zusammen. Deine Freigabe ist noch aus.",
                  );
                }}
              >
                <label className="min-w-0 flex-1 text-sm font-medium">
                  Einladungscode des Partners
                  <input
                    className={`${control} mt-1 uppercase`}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    maxLength={64}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    required
                  />
                </label>
                <button
                  type="submit"
                  className={secondary}
                  disabled={busy || !alias.trim() || !code.trim()}
                >
                  Beitreten
                </button>
              </form>
              <p className="text-xs text-muted-foreground">
                Beide öffnen den Gym-Modus auf ihrem eigenen Konto. Einer erstellt die Einheit, der
                andere tritt mit dem Code bei.
              </p>
            </div>
          )}
          {snapshot && (
            <>
              <div className="rounded-2xl bg-secondary/50 p-4">
                <h3 className="font-semibold">Eure gemeinsame Einheit</h3>
                <p className="mt-1 text-sm">
                  {snapshot.partner
                    ? `Du & ${snapshot.partner.alias}`
                    : "Warte auf deinen Trainingspartner"}
                </p>
                {snapshot.inviteCode && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground">
                      Privater Einladungscode · maximal zwei Konten
                    </p>
                    <p className="my-2 break-all font-mono text-xl font-bold tracking-wider select-all">
                      {snapshot.inviteCode}
                    </p>
                    {snapshot.inviteExpiresAt && (
                      <p className="text-xs text-muted-foreground">
                        Gültig bis {new Date(snapshot.inviteExpiresAt).toLocaleString("de-DE")}.
                        Nach Ablauf eine neue Einheit erstellen.
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 rounded-2xl border border-border p-4">
                  <h3 className="break-words font-semibold">Du · {snapshot.own.alias}</h3>
                  <Stats
                    sets={snapshot.own.sets.length}
                    reps={snapshot.own.sets.reduce((n, set) => n + set.reps, 0)}
                    volumeKg={snapshot.own.sets.reduce((n, set) => n + set.reps * set.weightKg, 0)}
                  />
                </div>
                <div className="min-w-0 rounded-2xl border border-border p-4">
                  <h3 className="break-words font-semibold">
                    {snapshot.partner?.alias ?? "Partner"}
                  </h3>
                  {snapshot.partner?.sharing && snapshot.partner.stats ? (
                    <Stats {...snapshot.partner.stats} />
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {snapshot.partner
                        ? "Noch keine Stats freigegeben. Dein Partner entscheidet selbst."
                        : "Stats erscheinen erst nach Beitritt und bewusster Freigabe."}
                    </p>
                  )}
                  {snapshot.partner?.visitSharing?.counts && snapshot.partner.visitStats && (
                    <p className="mt-3 text-sm">
                      Gym-Tage: {snapshot.partner.visitStats.weekDays} diese Woche ·{" "}
                      {snapshot.partner.visitStats.monthDays} diesen Monat
                    </p>
                  )}
                  {snapshot.partner?.visitSharing?.days && snapshot.partner.visitDays && (
                    <div className="mt-3 text-sm">
                      <p className="font-medium">Freigegebene Besuchstage · aktueller Monat</p>
                      {snapshot.partner.visitDays.length ? (
                        <ul className="mt-1 flex flex-wrap gap-2">
                          {snapshot.partner.visitDays.map((day) => (
                            <li key={day} className="rounded-lg bg-secondary px-2 py-1">
                              {new Date(`${day}T12:00:00`).toLocaleDateString("de-DE", {
                                day: "numeric",
                                month: "short",
                              })}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground">
                          Noch keine Besuchstage in diesem Monat.
                        </p>
                      )}
                    </div>
                  )}
                  {snapshot.partner &&
                    !snapshot.partner.visitSharing?.counts &&
                    !snapshot.partner.visitSharing?.days && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Besuchszahlen und Kalender bleiben privat.
                      </p>
                    )}
                </div>
              </div>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0"
                  checked={snapshot.own.sharing}
                  disabled={busy}
                  onChange={(event) => {
                    const share = event.target.checked;
                    void run(
                      () => setGymSharing(snapshot.id, share),
                      share
                        ? "Nur Sätze, Wiederholungen und Trainingsvolumen dieser Einheit werden geteilt."
                        : "Freigabe widerrufen. Deine Stats sind für deinen Partner nicht mehr abrufbar.",
                    );
                  }}
                />
                <span>
                  Meine Einheiten-Stats mit diesem Partner teilen
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Nur Summen aus dieser Einheit: Sätze, Wiederholungen und Volumen (kg ×
                    Wiederholungen). Einzelne Übungen und frühere Trainings bleiben privat.
                  </span>
                </span>
              </label>
              <fieldset className="space-y-3 rounded-xl border border-border p-3">
                <legend className="px-1 text-sm font-semibold">
                  Meine Besuchsfreigaben für diesen Partner
                </legend>
                <label className="flex min-h-11 items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0"
                    checked={snapshot.own.visitSharing?.counts ?? false}
                    disabled={busy}
                    onChange={(event) => {
                      const share = event.target.checked;
                      void run(
                        () =>
                          setGymVisitSharing(
                            snapshot.id,
                            share,
                            snapshot.own.visitSharing?.days ?? false,
                          ),
                        share
                          ? "Nur deine Gym-Tagesanzahl der aktuellen Woche und des aktuellen Monats ist freigegeben."
                          : "Deine Wochen-/Monatszahlen sind nicht mehr freigegeben.",
                      );
                    }}
                  />
                  <span>
                    Meine Wochen-/Monatszahlen teilen
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Anzahl deiner Gym-Tage, ohne Datumsliste. Unabhängig von den Einheiten-Stats.
                    </span>
                  </span>
                </label>
                <label className="flex min-h-11 items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0"
                    checked={snapshot.own.visitSharing?.days ?? false}
                    disabled={busy}
                    onChange={(event) => {
                      const share = event.target.checked;
                      void run(
                        () =>
                          setGymVisitSharing(
                            snapshot.id,
                            snapshot.own.visitSharing?.counts ?? false,
                            share,
                          ),
                        share
                          ? "Deine konkreten Besuchstage des aktuellen Monats sind freigegeben."
                          : "Deine konkreten Besuchstage sind nicht mehr freigegeben.",
                      );
                    }}
                  />
                  <span>
                    Konkrete Besuchstage teilen
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Nur Tage im aktuellen Monat. Daraus kann dein Partner die Anzahl selbst
                      ableiten, auch wenn die Zahlenfreigabe aus ist.
                    </span>
                  </span>
                </label>
                <p className="text-xs text-muted-foreground">
                  Gilt nur für diese gemeinsame Einheit. Standardmäßig aus; jederzeit einzeln
                  widerrufbar. Keine automatische Übergabe an Mira.
                </p>
              </fieldset>
              <form onSubmit={submitSet} className="space-y-3 rounded-2xl border border-border p-4">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Dumbbell className="h-4 w-4" aria-hidden="true" />
                  Deinen Satz erfassen
                </h3>
                <label className="block text-sm">
                  Übung
                  <input
                    className={`${control} mt-1`}
                    value={exercise}
                    onChange={(e) => setExercise(e.target.value)}
                    maxLength={80}
                    required
                    placeholder="Zum Beispiel Kniebeuge"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    Wiederholungen
                    <input
                      className={`${control} mt-1`}
                      inputMode="numeric"
                      type="number"
                      min="1"
                      max="1000"
                      step="1"
                      value={reps}
                      onChange={(e) => setReps(e.target.value)}
                      required
                    />
                  </label>
                  <label className="text-sm">
                    Gewicht (kg)
                    <input
                      className={`${control} mt-1`}
                      inputMode="decimal"
                      type="number"
                      min="0"
                      max="1000"
                      step="0.25"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      required
                    />
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ohne Zusatzgewicht: 0 kg. Das Volumen zählt nur das eingetragene Gewicht, nicht
                  dein Körpergewicht.
                </p>
                {snapshot.status !== "active" && (
                  <p className="text-xs text-muted-foreground">
                    Sobald dein Partner beitritt, könnt ihr eure Sätze erfassen.
                  </p>
                )}
                <button
                  className={button}
                  type="submit"
                  disabled={busy || snapshot.status !== "active"}
                >
                  Satz für mich speichern
                </button>
              </form>
              <div>
                <h3 className="font-semibold">Deine Sätze dieser Einheit</h3>
                {!snapshot.own.sets.length && (
                  <p className="mt-2 text-sm text-muted-foreground">Noch kein Satz gespeichert.</p>
                )}
                <ul className="mt-2 space-y-2">
                  {snapshot.own.sets.map((set) => (
                    <li
                      key={set.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm"
                    >
                      <span className="min-w-0 break-words">
                        {set.exercise}
                        <span className="block text-muted-foreground">
                          {set.reps} Wdh. · {formatNumber(set.weightKg)} kg
                        </span>
                      </span>
                      <button
                        className={`${secondary} shrink-0`}
                        type="button"
                        disabled={busy}
                        aria-label={`Satz ${set.exercise} entfernen`}
                        onClick={() =>
                          void run(
                            () => deleteGymSet(snapshot.id, set.id),
                            "Dein Satz wurde entfernt.",
                          )
                        }
                      >
                        Entfernen
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              {!closing ? (
                <button
                  className={secondary}
                  type="button"
                  disabled={busy}
                  onClick={() => setClosing(true)}
                >
                  Gemeinsame Einheit beenden …
                </button>
              ) : (
                <div className="space-y-2 rounded-xl border border-border p-3">
                  <p className="text-sm">
                    Einheit für euch beide beenden? Jeder behält seinen eigenen Verlauf. Alle
                    Partner-Freigaben enden.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={button}
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => closeGymSession(snapshot.id),
                          "Einheit beendet. Dein Gym-Verlauf bleibt privat erhalten.",
                        )
                      }
                    >
                      Für beide beenden
                    </button>
                    <button
                      type="button"
                      className={secondary}
                      disabled={busy}
                      onClick={() => setClosing(false)}
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          <GymHistory
            history={history}
            busy={busy}
            load={showHistory}
            clear={() => setHistory(null)}
          />
          <GymVisitCalendar userId={userId} refreshKey={visitRevision} />
        </div>
      )}
    </div>
  );
}

function Stats({ sets, reps, volumeKg }: { sets: number; reps: number; volumeKg: number }) {
  return (
    <dl className="mt-3 space-y-1 text-sm">
      <div className="flex justify-between gap-2">
        <dt>Sätze</dt>
        <dd className="font-semibold tabular-nums">{sets}</dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt>Wiederholungen</dt>
        <dd className="font-semibold tabular-nums">{reps}</dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt>Volumen</dt>
        <dd className="font-semibold tabular-nums">{formatNumber(volumeKg)} kg</dd>
      </div>
    </dl>
  );
}

function GymHistory({
  history,
  busy,
  load,
  clear,
}: {
  history: Awaited<ReturnType<typeof getGymHistory>> | null;
  busy: boolean;
  load: () => Promise<void>;
  clear: () => void;
}) {
  return (
    <div className="border-t border-border pt-4">
      <h3 className="font-semibold">Mein privater Gym-Verlauf</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Deine letzten 500 Gym-Sätze aus beendeten Einheiten. Nose-Pushup-Trainings bleiben
        unverändert in ihrem bisherigen Verlauf.
      </p>
      <button
        className={`${secondary} mt-3`}
        type="button"
        disabled={busy}
        onClick={() => (history ? clear() : void load())}
      >
        {history ? "Verlauf ausblenden" : "Meinen Verlauf laden"}
      </button>
      {history && (
        <div className="mt-3 space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Gym-Sätze gespeichert.</p>
          ) : (
            history.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-border p-3 text-sm">
                <p className="font-medium">{entry.exercise}</p>
                <p className="text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString("de-DE")} · {entry.reps} Wdh. ·{" "}
                  {formatNumber(entry.weightKg)} kg
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
