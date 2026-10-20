import {
  adjustManualCount,
  formatWorkoutCount,
  manualWorkoutInput,
  parseManualCount,
  workoutBest,
  workoutCountUnit,
} from "@/lib/workout-ui";
import {
  finalizeWorkoutSave,
  captureWorkoutDraft,
  clearPendingWorkoutSaveContext,
  nextWorkoutContextGeneration,
  pendingWorkoutSaveCache,
  resolvePendingWorkoutSaveIdentity,
  unplannedWorkoutDraftKey,
  workoutSaveIdentityLookupKey,
  workoutContextKey,
  workoutContextToken,
} from "@/lib/workout-save";
import { DesignView } from "@/components/DesignView";
import { createFileRoute, Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SportPageIntro, SportSectionLabel } from "@/components/SportPageIntro";
import { Activity, ArrowLeft, Dumbbell, Pause, Play, RotateCcw, Timer } from "lucide-react";
import { useExerciseEngine, ensureMotionPermission } from "@/hooks/useExerciseEngine";
import { useCameraDetection, type RepQuality } from "@/hooks/useCameraDetection";
import { feedbackRep, feedbackSuccess } from "@/lib/feedback";
import { saveOrQueue } from "@/lib/offline-queue";
import type { ExerciseMeta } from "@/lib/exercises";
import { getConfig } from "@/lib/exercises";
import {
  createWorkoutSession,
  finishWorkoutSet,
  correctCompletedWorkoutSet,
  extendWorkoutRest,
  pauseWorkout,
  readWorkoutSession,
  recordWorkoutRep,
  startWorkoutSet,
  summarizeWorkout,
  undoWorkoutRep,
  validateWorkoutSearch,
  workoutSessionStorageKey,
  writeWorkoutMetadata,
  writeWorkoutSession,
  type WorkoutSession,
} from "@/lib/workout-session";

type PushMode = "nose" | "manual" | "camera";

export const Route = createFileRoute("/_authenticated/workout/$exerciseId")({
  validateSearch: (search: Record<string, unknown>) => validateWorkoutSearch(search),
  head: ({ params }) => ({
    meta: [{ title: `${params.exerciseId === "pushup" ? "Liegestütze" : "Training"} — Alo` }],
  }),
  component: WorkoutScreen,
});

const MOTIVATIONAL = [
  "Atme — und weiter.",
  "Du bist stärker als gestern.",
  "Noch einer. Und noch einer.",
  "Form vor Tempo.",
  "Stark!",
  "Beast-Modus aktiv.",
  "Halte durch — du schaffst das.",
  "Power!",
];

let workoutVisitSequence = 0;

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
}

function WorkoutScreen() {
  const { exerciseId } = useParams({ from: "/_authenticated/workout/$exerciseId" });
  const search = useSearch({ from: "/_authenticated/workout/$exerciseId" });
  const navigate = useNavigate();

  const [exercise, setExercise] = useState<ExerciseMeta | null>(null);
  const [exerciseLoadError, setExerciseLoadError] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const workoutVisitIdRef = useRef<number | null>(null);
  if (workoutVisitIdRef.current === null) workoutVisitIdRef.current = ++workoutVisitSequence;
  const workoutVisitId = workoutVisitIdRef.current;
  const routeContextKey = workoutContextKey(userId, exerciseId, search);
  const saveContextKey = workoutContextKey(userId, exerciseId, {});
  const contextGenerationRef = useRef({ key: "", generation: 0 });
  contextGenerationRef.current = nextWorkoutContextGeneration(
    contextGenerationRef.current,
    routeContextKey,
  );
  const currentWorkoutContext = workoutContextToken(workoutVisitId, contextGenerationRef.current);
  const workoutContextRef = useRef(currentWorkoutContext);
  workoutContextRef.current = currentWorkoutContext;
  const [best, setBest] = useState<number | null>(null);
  const [latestCount, setLatestCount] = useState<number | null>(null);
  const [latestStatus, setLatestStatus] = useState<
    "loading" | "loaded" | "empty" | "error" | "unavailable"
  >("loading");
  const [bestStatus, setBestStatus] = useState<
    "loading" | "loaded" | "empty" | "error" | "unavailable"
  >("loading");

  const [active, setActive] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [focused, setFocused] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const savingOwnerRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const releaseSaveLock = useCallback((owner: string) => {
    if (savingOwnerRef.current !== owner) return;
    savingOwnerRef.current = null;
    savingRef.current = false;
    if (mountedRef.current && workoutContextRef.current === owner) setSaving(false);
  }, []);
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [motionError, setMotionError] = useState<string | null>(null);
  const [motivation, setMotivation] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const unplannedDraftRevision = useRef(0);
  const [editingCompletedSet, setEditingCompletedSet] = useState<number | null>(null);
  const [completedSetEditValue, setCompletedSetEditValue] = useState("");
  const [completedSetEditError, setCompletedSetEditError] = useState<string | null>(null);
  const [completedSetEditOwner, setCompletedSetEditOwner] = useState<string | null>(null);
  const manualInputRef = useRef("");
  const setManualInputValue = useCallback((value: string) => {
    manualInputRef.current = value;
    setManualInput(value);
  }, []);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [summary, setSummary] = useState<{
    count: number;
    durationMs: number;
    isBest: boolean;
    formScore?: number | null;
    cleanReps?: number | null;
    rpe?: number | null;
    plannedSets?: number;
    actualSets?: number;
    plannedReps?: number | null;
    actualReps?: number;
    partial?: boolean;
  } | null>(null);
  const [repGrades, setRepGrades] = useState<{ grade: number; full: boolean }[]>([]);
  // RPE-Abfrage (1–10) vor dem endgültigen Speichern
  const [awaitingRpe, setAwaitingRpe] = useState(false);
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const [draftConflict, setDraftConflict] = useState<WorkoutSession | null>(null);
  const completedEditOwnerRef = useRef("");
  const hydratedSessionKey = useRef<string | null>(null);
  const observedCount = useRef(0);
  useEffect(() => {
    const editOwner = JSON.stringify([routeContextKey, session?.id ?? null]);
    if (completedEditOwnerRef.current === editOwner) return;
    completedEditOwnerRef.current = editOwner;
    setEditingCompletedSet(null);
    setCompletedSetEditValue("");
    setCompletedSetEditError(null);
    setCompletedSetEditOwner(null);
  }, [routeContextKey, session?.id]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  useEffect(() => {
    const owner = savingOwnerRef.current;
    if (owner && owner !== currentWorkoutContext) {
      savingOwnerRef.current = null;
      savingRef.current = false;
      setSaving(false);
    } else if (!owner) {
      // A stale finalizer may have released its ref lock just before this effect ran.
      setSaving(false);
    }
  }, [currentWorkoutContext, releaseSaveLock]);
  const restRemaining =
    session?.phase === "rest" && session.restEndsAt
      ? Math.max(0, Math.ceil((session.restEndsAt - now) / 1000))
      : null;

  const isPushup = exerciseId === "pushup";
  const pushMode: PushMode =
    isPushup && (search.mode === "nose" || search.mode === "manual" || search.mode === "camera")
      ? search.mode
      : "nose";
  const useCamera = isPushup && pushMode === "camera";
  const useManual = isPushup && pushMode === "manual";
  const performanceLayout =
    typeof document !== "undefined" &&
    document.documentElement.dataset.designStyle === "performance";
  const isPlanned = !!(search.sets || search.reps || search.rest_s || search.title);
  const plan = useMemo(
    () => ({
      sets: search.sets ?? 1,
      reps: search.reps ?? null,
      restSeconds: search.rest_s ?? 60,
      title: search.title ?? null,
    }),
    [search.sets, search.reps, search.rest_s, search.title],
  );

  const focusControls = (
    <>
      <div className="alo-focus-toolbar">
        <span>Dein Training</span>
        <button
          type="button"
          className="alo-btn"
          aria-pressed={focused}
          onClick={() => setFocused((v) => !v)}
        >
          {focused ? "Details anzeigen" : "Fokusmodus"}
        </button>
      </div>
      {isPlanned && session && (
        <div className="alo-session-strip" role="status">
          <strong>
            Satz {Math.min(session.currentSet, plan.sets)}/{plan.sets}
          </strong>
          <span>
            {session.phase === "rest"
              ? `Pause · ${restRemaining ?? 0}s`
              : session.phase === "paused"
                ? "Pausiert"
                : session.phase === "completed"
                  ? "Abgeschlossen"
                  : session.phase === "preparation"
                    ? "Bereit"
                    : "Aktiv"}
          </span>
          <span>
            {session.currentReps}
            {plan.reps ? `/${plan.reps}` : ""} {workoutCountUnit(exercise?.unit ?? "reps")}
          </span>
        </div>
      )}
    </>
  );
  // Effective detection: for push-ups we honor the mode toggle.
  const detection = useMemo(() => {
    if (!exercise) return "touch" as const;
    if (isPushup) {
      if (useCamera || useManual) return "touch" as const; // driven externally / not at all
      return exercise.detection_type;
    }
    return exercise.detection_type;
  }, [exercise, isPushup, useCamera, useManual]);

  const {
    count,
    pop,
    bump,
    reset: resetEngine,
    setCount: setEngineCount,
    decrement,
  } = useExerciseEngine({
    exerciseId,
    detection,
    active: useCamera ? false : active, // when camera-driven, we bump() from camera
    onTick: (n) => {
      feedbackRep(n);
      if (n > 0 && n % 5 === 0) {
        setMotivation(MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)]);
      }
    },
  });

  // Camera detector — only mounted for camera mode
  const cameraBump = useCallback(
    (q: RepQuality) => {
      setRepGrades((prev) => [...prev, { grade: q.grade, full: q.full }]);
      bump();
    },
    [bump],
  );
  const {
    videoRef,
    error: cameraError,
    ready: cameraReady,
    status: cameraStatus,
    elbowAngle,
    liveCue,
    lastQuality,
  } = useCameraDetection({
    active: useCamera && active,
    onRep: cameraBump,
  });

  useEffect(() => {
    if (!useCamera || !cameraError) return;
    setActive(false);
    setStartedAt(null);
    setSession((current) => (current ? pauseWorkout(current) : current));
  }, [useCamera, cameraError]);

  const formStats = useMemo(() => {
    if (repGrades.length === 0) return null;
    const avg = repGrades.reduce((s, r) => s + r.grade, 0) / repGrades.length;
    return {
      formScore: Math.round(avg * 10) / 10,
      cleanReps: repGrades.filter((r) => r.full && r.grade >= 4).length,
    };
  }, [repGrades]);

  // Load exercise + user best
  useEffect(() => {
    let cancelled = false;
    setExercise(null);
    setExerciseLoadError(false);
    setBest(null);
    setLatestCount(null);
    setLatestStatus("loading");
    setBestStatus("loading");
    setUserId(null);
    (async () => {
      try {
        const [{ data: u, error: userError }, { data: ex, error: exerciseError }] =
          await Promise.all([
            supabase.auth.getUser(),
            supabase.from("exercises").select("*").eq("id", exerciseId).maybeSingle(),
          ]);
        if (cancelled) return;
        if (userError || exerciseError) {
          setExerciseLoadError(true);
          setLatestStatus("error");
          setBestStatus("error");
          return;
        }
        if (!ex) {
          navigate({ to: "/" });
          return;
        }
        setExercise(ex as ExerciseMeta);
        if (!u.user) {
          setLatestStatus("unavailable");
          setBestStatus("unavailable");
          return;
        }
        setUserId(u.user.id);
        const [
          { data: p, error: profileError },
          { data: history, error: historyError },
          { data: highest, error: highestError },
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("personal_bests, best_count")
            .eq("id", u.user.id)
            .maybeSingle(),
          supabase
            .from("workouts")
            .select("count")
            .eq("user_id", u.user.id)
            .eq("exercise_id", exerciseId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("workouts")
            .select("count")
            .eq("user_id", u.user.id)
            .eq("exercise_id", exerciseId)
            .order("count", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        if (cancelled) return;
        const latest = history?.count ?? null;
        setLatestCount(latest);
        setLatestStatus(historyError ? "error" : latest === null ? "empty" : "loaded");
        const personalBest = workoutBest(
          exerciseId,
          p?.personal_bests as Record<string, number> | null,
          p?.best_count,
          highest?.count ?? null,
        );
        setBest(personalBest);
        setBestStatus(
          profileError || highestError ? "error" : personalBest === null ? "empty" : "loaded",
        );
      } catch {
        if (cancelled) return;
        setExerciseLoadError(true);
        setLatestStatus("error");
        setBestStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exerciseId, navigate]);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    const key = workoutSessionStorageKey(userId, exerciseId);
    hydratedSessionKey.current = null;
    setSessionHydrated(false);
    setDraftConflict(null);
    setSummary(null);
    setAwaitingRpe(false);
    let restored: WorkoutSession | null = null;
    try {
      restored = readWorkoutSession(window.localStorage, key);
    } catch {
      // A blocked Storage accessor must not prevent an in-memory workout.
    }
    if (restored) {
      const planMatches =
        restored.plan.sets === plan.sets &&
        restored.plan.reps === plan.reps &&
        restored.plan.restSeconds === plan.restSeconds &&
        restored.plan.title === plan.title;
      if (!planMatches) {
        // Do not replace an unfinished draft with a new route plan without an explicit choice.
        setDraftConflict(restored);
        setSession(null);
        setSessionHydrated(true);
        return;
      }
      const safeRestore = restored.phase === "active" ? pauseWorkout(restored) : restored;
      setSession(safeRestore);
      setEngineCount(safeRestore.currentReps);
      if (useManual) {
        const restoredCount =
          safeRestore.phase === "completed"
            ? summarizeWorkout(safeRestore).actualReps
            : safeRestore.currentReps;
        setManualInputValue(restoredCount ? String(restoredCount) : "");
      }
      setActive(false);
      setStartedAt(safeRestore.startedAt ?? null);
      observedCount.current = restored.currentReps;
    } else {
      setSession(isPlanned ? createWorkoutSession(plan) : null);
      setEngineCount(0);
      setManualInputValue("");
      setActive(false);
      setStartedAt(null);
      observedCount.current = 0;
    }
    hydratedSessionKey.current = key;
    setSessionHydrated(true);
  }, [userId, exerciseId, isPlanned, plan, setEngineCount, setManualInputValue, useManual]);

  useEffect(() => {
    if (!userId || !session || !sessionHydrated || draftConflict || typeof window === "undefined")
      return;
    const key = workoutSessionStorageKey(userId, exerciseId);
    if (hydratedSessionKey.current !== key) return;
    writeWorkoutSession(window.localStorage, key, session);
  }, [userId, exerciseId, session, sessionHydrated, draftConflict]);

  // Keep a paused draft if the user navigates away or backgrounds this page.
  const sessionRef = useRef(session);
  const userRef = useRef(userId);
  useEffect(() => {
    sessionRef.current = session;
    userRef.current = userId;
  }, [session, userId]);
  useEffect(() => {
    const persistPaused = () => {
      const current = sessionRef.current;
      const uid = userRef.current;
      if (!current || !uid || current.phase === "completed" || current.phase === "paused") return;
      writeWorkoutSession(
        window.localStorage,
        workoutSessionStorageKey(uid, exerciseId),
        pauseWorkout(current, Date.now()),
      );
    };
    window.addEventListener("pagehide", persistPaused);
    window.addEventListener("beforeunload", persistPaused);
    return () => {
      window.removeEventListener("pagehide", persistPaused);
      window.removeEventListener("beforeunload", persistPaused);
    };
  }, [exerciseId]);

  useEffect(() => {
    if (!startedAt && session?.phase !== "rest" && session?.phase !== "active") return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [startedAt, session?.phase]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      setActive(true);
      setStartedAt((s) => s ?? Date.now());
      if (isPlanned)
        setSession((current) => (current ? startWorkoutSet(current) : createWorkoutSession(plan)));
      setMotionError(null);
      setSavedHint(null);
      return;
    }

    const id = window.setTimeout(() => setCountdown((value) => (value ?? 0) - 1), 900);
    return () => window.clearTimeout(id);
  }, [countdown, isPlanned, plan]);

  useEffect(() => {
    if (!isPlanned || !session || session.phase !== "active") {
      observedCount.current = count;
      return;
    }
    const delta = count - observedCount.current;
    observedCount.current = count;
    if (delta <= 0) return;
    setSession((current) => {
      if (!current || current.phase !== "active") return current;
      let next = current;
      for (let i = 0; i < delta; i++) next = recordWorkoutRep(next);
      if (next.plan.reps !== null && next.currentReps >= next.plan.reps) {
        next = finishWorkoutSet(next);
        setActive(false);
        setStartedAt(null);
        observedCount.current = 0;
        resetEngine();
      }
      return next;
    });
  }, [count, isPlanned, session, resetEngine]);

  const start = useCallback(async () => {
    if (savingRef.current) return;
    if (detection === "motion_vertical" || detection === "combo") {
      const ok = await ensureMotionPermission();
      if (!ok) {
        setMotionError("Bewegungssensor wurde nicht freigegeben.");
        return;
      }
    }
    setCountdown(3);
    if (isPlanned)
      setSession((current) =>
        current
          ? { ...current, phase: "preparation", startedAt: current.startedAt ?? Date.now() }
          : createWorkoutSession(plan),
      );
    setActive(false);
    setStartedAt(null);
    setMotionError(null);
    setSavedHint(null);
    setSummary(null);
  }, [detection, isPlanned, plan]);

  const handleSurfaceTap = useCallback(() => {
    if (useCamera) return;
    if (detection === "timer" || detection === "motion_vertical") return;
    if (!active) {
      if (isPlanned && session && ["rest", "paused", "completed"].includes(session.phase)) return;
      start();
      return;
    }
    bump();
  }, [useCamera, detection, active, start, bump, isPlanned, session]);

  const finish = () => {
    if (savingRef.current) return;
    if (useManual && editingCompletedSet !== null) {
      setSavedHint("Bitte die Satzkorrektur zuerst übernehmen oder abbrechen.");
      return;
    }
    const total = isPlanned && session ? summarizeWorkout(session, Date.now()).actualReps : count;
    if (total <= 0 || !userId || !exercise) {
      resetAll();
      return;
    }
    // Erst RPE abfragen, dann speichern
    setAwaitingRpe(true);
  };

  const saveWithRpe = async (rpe: number | null) => {
    const saveOwner = workoutContextRef.current;
    if (savingOwnerRef.current && savingOwnerRef.current !== saveOwner)
      releaseSaveLock(savingOwnerRef.current);
    if (savingRef.current) return;
    const sessionSummary = isPlanned && session ? summarizeWorkout(session, Date.now()) : null;
    const savedCount = sessionSummary?.actualReps ?? count;
    if (savedCount <= 0 || !userId || !exercise) {
      resetAll();
      return;
    }
    if (savedCount > 1000) {
      setAwaitingRpe(false);
      setSavedHint(
        "Speichern nicht möglich: Pro Training sind höchstens 1.000 Wiederholungen erlaubt. Dein Entwurf bleibt erhalten.",
      );
      return;
    }
    setAwaitingRpe(false);
    savingRef.current = true;
    savingOwnerRef.current = saveOwner;
    setSaving(true);
    setActive(false);
    const durationAtFirstAttempt =
      sessionSummary?.actualDurationMs ?? (startedAt ? Date.now() - startedAt : 0);
    const payload = {
      user_id: userId,
      exercise_id: exerciseId,
      count: savedCount,
      form_score: formStats?.formScore ?? null,
      clean_reps: formStats?.cleanReps ?? null,
      rpe,
    };
    const draftKey =
      session?.id ??
      unplannedWorkoutDraftKey(
        workoutVisitId,
        unplannedDraftRevision.current,
        "activity",
        startedAt,
      );
    const payloadKey = JSON.stringify(payload);
    const identityContextKey = saveContextKey;
    const identityLookupKey = workoutSaveIdentityLookupKey(
      identityContextKey,
      draftKey,
      payloadKey,
    );
    const pendingIdentity = resolvePendingWorkoutSaveIdentity(
      identityContextKey,
      draftKey,
      payloadKey,
      pendingWorkoutSaveCache.get(identityLookupKey) ?? null,
      () => globalThis.crypto?.randomUUID?.() ?? `workout-${Date.now()}-${Math.random()}`,
      () => new Date().toISOString(),
      durationAtFirstAttempt,
    );
    pendingWorkoutSaveCache.set(identityLookupKey, pendingIdentity);
    const draftStorageKey = workoutSessionStorageKey(userId, exerciseId);
    let draftStorage: Storage | null = null;
    try {
      if (typeof window !== "undefined") draftStorage = window.localStorage;
    } catch {
      // Storage may be blocked; save completion must still be handled safely.
    }
    const capturedDraft = draftStorage
      ? captureWorkoutDraft(draftStorage, draftStorageKey, session)
      : null;
    const duration_ms = pendingIdentity.durationMs;
    // Offline landet das Training in der Warteschlange und wird später nachgesendet.
    try {
      let saveResult;
      try {
        saveResult = await saveOrQueue("workouts", {
          id: pendingIdentity.id,
          ...payload,
          duration_ms,
          created_at: pendingIdentity.createdAt,
        });
      } catch {
        if (mountedRef.current && workoutContextRef.current === saveOwner) {
          setSavedHint("Speichern fehlgeschlagen – deine Daten bleiben erhalten");
          setAwaitingRpe(true);
        }
        return;
      }
      let error: unknown;
      let queued: boolean;
      try {
        ({ error, queued } = saveResult);
      } catch {
        if (mountedRef.current && workoutContextRef.current === saveOwner) {
          setSavedHint("Speichern fehlgeschlagen – deine Daten bleiben erhalten");
          setAwaitingRpe(true);
        }
        return;
      }
      if (error) {
        if (mountedRef.current && workoutContextRef.current === saveOwner) {
          setSavedHint("Speichern fehlgeschlagen – deine Daten bleiben erhalten");
          setAwaitingRpe(true);
        }
        return;
      }
      const uiContextStillCurrent =
        mountedRef.current &&
        workoutContextRef.current === saveOwner &&
        JSON.stringify(sessionRef.current) === JSON.stringify(session);
      const finalization = finalizeWorkoutSave({
        outcome: queued ? "queued" : "saved",
        storage: draftStorage,
        captured: capturedDraft,
        identityLookupKey,
        uiCurrent: uiContextStillCurrent,
        onConfirmedSuccess: () => {
          if (isPlanned && sessionSummary && draftStorage)
            writeWorkoutMetadata(draftStorage, {
              version: 1,
              rowId: pendingIdentity.id,
              userId,
              exerciseId,
              partial: sessionSummary.partial,
              summary: { ...sessionSummary, actualReps: savedCount, actualDurationMs: duration_ms },
              createdAt: pendingIdentity.createdAt,
            });
        },
      });
      if (!uiContextStillCurrent) return;
      try {
        feedbackSuccess();
      } catch {
        // Optional success feedback must not turn a completed save into a retry prompt.
      }
      const newBest = !sessionSummary?.partial && savedCount > (best ?? -1);
      setSummary({
        count: savedCount,
        durationMs: duration_ms,
        isBest: newBest && !queued,
        formScore: formStats?.formScore ?? null,
        cleanReps: formStats?.cleanReps ?? null,
        rpe,
        plannedSets: sessionSummary?.plannedSets,
        actualSets: sessionSummary?.actualSets,
        plannedReps: sessionSummary?.plannedReps,
        actualReps: sessionSummary?.actualReps,
        partial: sessionSummary?.partial,
      });
      setLatestCount(savedCount);
      setLatestStatus("loaded");
      if (queued) {
        setSavedHint("Auf diesem Gerät vorgemerkt – Bestwert nach Synchronisierung prüfen");
      } else if (newBest) {
        setBest(savedCount);
        setBestStatus("loaded");
        setSavedHint(`Neuer Bestwert: ${savedCount}${exercise.unit === "seconds" ? " Sek." : ""}`);
      } else {
        setSavedHint("Training gespeichert");
      }
      if (!finalization.uiDraftClosed) {
        setSavedHint(
          queued
            ? "Auf diesem Gerät vorgemerkt. Der lokale Entwurf konnte nicht sicher bereinigt werden."
            : "Training gespeichert. Der lokale Entwurf konnte nicht sicher bereinigt werden.",
        );
      }
      setActive(false);
      setStartedAt(null);
      setCountdown(null);
      resetEngine();
      setSession(null);
      if (!session) unplannedDraftRevision.current += 1;
    } finally {
      releaseSaveLock(saveOwner);
    }
  };

  const resetAll = () => {
    if (savingRef.current) return;
    const draftKey =
      session?.id ??
      unplannedWorkoutDraftKey(
        workoutVisitId,
        unplannedDraftRevision.current,
        useManual ? "manual" : "activity",
        useManual ? manualInputRef.current : startedAt,
      );
    clearPendingWorkoutSaveContext(saveContextKey, draftKey);
    unplannedDraftRevision.current += 1;
    setActive(false);
    setStartedAt(null);
    setCountdown(null);
    setSummary(null);
    setAwaitingRpe(false);
    setManualInput("");
    resetEngine();
    setSavedHint(null);
    setMotivation(null);
    setRepGrades([]);
    setSession(isPlanned ? createWorkoutSession(plan) : null);
    try {
      if (userId && typeof window !== "undefined")
        window.localStorage.removeItem(workoutSessionStorageKey(userId, exerciseId));
    } catch {
      // Draft cleanup is best effort.
    }
  };

  const elapsed = startedAt ? now - startedAt : 0;
  const pace =
    startedAt && count > 0 && exercise?.unit !== "seconds" ? count / (elapsed / 60000) : 0;
  const latestStatValue =
    latestStatus === "loading"
      ? "Lädt …"
      : latestStatus === "error"
        ? "Nicht verfügbar"
        : latestStatus === "unavailable"
          ? "Nicht verfügbar"
          : latestStatus === "empty"
            ? "Noch keine Erfassung"
            : formatWorkoutCount(latestCount ?? 0, exercise?.unit ?? "reps");
  const bestStatValue =
    bestStatus === "loading"
      ? "Lädt …"
      : bestStatus === "error" || bestStatus === "unavailable"
        ? "Nicht verfügbar"
        : bestStatus === "empty"
          ? "Noch kein Bestwert"
          : (best?.toString() ?? "Noch kein Bestwert");
  const cfg = exercise ? getConfig(exerciseId) : null;
  const isTapDriven = !useCamera && (detection === "touch" || detection === "combo");

  const continueSavedDraft = () => {
    if (!draftConflict || savingRef.current) return;
    const savedPlan = draftConflict.plan;
    setSessionHydrated(false);
    setDraftConflict(null);
    void navigate({
      to: "/workout/$exerciseId",
      params: { exerciseId },
      replace: true,
      search: {
        mode: pushMode,
        sets: savedPlan.sets,
        reps: savedPlan.reps ?? undefined,
        rest_s: savedPlan.restSeconds,
        title: savedPlan.title ?? undefined,
      },
    });
  };

  const discardSavedDraft = () => {
    if (!draftConflict || !userId || savingRef.current || typeof window === "undefined") return;
    const key = workoutSessionStorageKey(userId, exerciseId);
    clearPendingWorkoutSaveContext(saveContextKey, draftConflict.id);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // The user explicitly discarded the in-memory draft; storage cleanup is best effort.
    }
    hydratedSessionKey.current = key;
    setDraftConflict(null);
    setSession(isPlanned ? createWorkoutSession(plan) : null);
    setEngineCount(0);
    setManualInput("");
    setActive(false);
    setStartedAt(null);
    observedCount.current = 0;
    setSessionHydrated(true);
  };

  if (!exercise) {
    return (
      <main
        className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-sm text-muted-foreground"
        role={exerciseLoadError ? "alert" : "status"}
      >
        {exerciseLoadError ? (
          <>
            <p>Übung und Trainingsdaten konnten nicht geladen werden.</p>
            <button
              type="button"
              className="rounded-xl border border-border px-4 py-2"
              onClick={() => window.location.reload()}
            >
              Erneut versuchen
            </button>
          </>
        ) : (
          "Lade…"
        )}
      </main>
    );
  }

  if (draftConflict) {
    return (
      <>
        <DesignView variant="sport">
          <main
            className="alo-training-focus sport-only mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col justify-center gap-6 px-5 py-8 sm:px-8"
            data-training-focus={focused}
          >
            {focusControls}
            <SportPageIntro
              eyebrow="WORKOUT · ENTWURF GESICHERT"
              title="Dein Training wartet"
              description="Ein anderer Plan ist geöffnet. Entscheide, ob du die gespeicherte Session fortsetzen oder bewusst verwerfen möchtest."
            />
            <section
              className="rounded-3xl border border-primary/30 bg-card/70 p-6"
              role="alert"
              aria-labelledby="saved-draft-sport-title"
            >
              <SportSectionLabel number="01">Offener Trainingsentwurf</SportSectionLabel>
              <h2 id="saved-draft-sport-title" className="mt-4 text-2xl font-bold">
                {draftConflict.plan.title ?? "Training"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {draftConflict.plan.sets} {draftConflict.plan.sets === 1 ? "Satz" : "Sätze"}
                {draftConflict.plan.reps
                  ? ` · ${formatWorkoutCount(draftConflict.plan.reps, exercise.unit)} je Satz`
                  : ` · ohne ${exercise.unit === "seconds" ? "Sekundenziel" : "Wiederholungsziel"}`}{" "}
                · {formatWorkoutCount(draftConflict.currentReps, exercise.unit)} im aktuellen Satz
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={continueSavedDraft}
                  className="rounded-2xl bg-primary px-4 py-4 text-sm font-bold text-primary-foreground"
                >
                  Entwurf fortsetzen
                </button>
                <button
                  type="button"
                  onClick={discardSavedDraft}
                  className="rounded-2xl border border-border bg-secondary px-4 py-4 text-sm font-semibold"
                >
                  Entwurf verwerfen und neuen Plan starten
                </button>
              </div>
            </section>
          </main>
        </DesignView>
        <DesignView variant="classic">
          <main
            className="alo-training-focus classic-only mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-5 py-8"
            data-training-focus={focused}
          >
            {focusControls}
            <section
              className="rounded-3xl border border-border bg-card p-5"
              aria-labelledby="saved-draft-title"
              role="alert"
            >
              <h1 id="saved-draft-title" className="text-xl font-bold text-foreground">
                Ungespeichertes Training gefunden
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Ein neuer Plan ist geöffnet. Dein bisheriger Trainingsentwurf bleibt erhalten, bis
                du entscheidest.
              </p>
              <div className="mt-4 rounded-2xl border border-border bg-background/50 p-3 text-sm">
                <div className="font-semibold">
                  Bisheriger Entwurf: {draftConflict.plan.title ?? "Training"}
                </div>
                <div className="mt-1 text-muted-foreground">
                  {draftConflict.plan.sets} {draftConflict.plan.sets === 1 ? "Satz" : "Sätze"}
                  {draftConflict.plan.reps
                    ? ` · ${formatWorkoutCount(draftConflict.plan.reps, exercise.unit)} je Satz`
                    : ` · ohne ${exercise.unit === "seconds" ? "Sekundenziel" : "Wiederholungsziel"}`}
                  {` · ${formatWorkoutCount(draftConflict.currentReps, exercise.unit)} im aktuellen Satz`}
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={continueSavedDraft}
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
                >
                  Bisherigen Entwurf fortsetzen
                </button>
                <button
                  type="button"
                  onClick={discardSavedDraft}
                  className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground"
                >
                  Entwurf verwerfen und neuen Plan starten
                </button>
              </div>
            </section>
          </main>
        </DesignView>
      </>
    );
  }

  const modeLabel: Record<PushMode, string> = { nose: "Nase", manual: "Manuell", camera: "Kamera" };

  const manualEnabled = !isPlanned || session?.phase === "active";
  const updateManualInput = (value: string) => {
    if (savingRef.current) return;
    const parsed = value === "" ? 0 : parseManualCount(value);
    const nextValue = value === "" ? "" : parsed === null ? value : String(parsed);
    setManualInputValue(nextValue);
    if (isPlanned)
      setSession((s) =>
        s?.phase === "active" && parsed !== null ? { ...s, currentReps: parsed } : s,
      );
  };
  const beginCompletedSetEdit = (index: number) => {
    if (!session || session.setReps[index] === undefined || savingRef.current) return;
    setEditingCompletedSet(index);
    setCompletedSetEditValue(String(session.setReps[index] ?? ""));
    setCompletedSetEditError(null);
    setCompletedSetEditOwner(JSON.stringify([routeContextKey, session.id]));
    setAwaitingRpe(false);
  };
  const cancelCompletedSetEdit = () => {
    setEditingCompletedSet(null);
    setCompletedSetEditValue("");
    setCompletedSetEditError(null);
    setCompletedSetEditOwner(null);
  };
  const applyCompletedSetEdit = () => {
    if (savingRef.current) return;
    const parsed = parseManualCount(completedSetEditValue);
    if (
      parsed === null ||
      editingCompletedSet === null ||
      !session ||
      completedSetEditOwner !== JSON.stringify([routeContextKey, session.id])
    ) {
      setCompletedSetEditError("Bitte eine ganze Zahl zwischen 0 und 1.000 eingeben.");
      return;
    }
    const next = correctCompletedWorkoutSet(session, editingCompletedSet, parsed);
    if (next === session && session.setReps[editingCompletedSet] !== parsed) {
      setCompletedSetEditError("Dieser Satz kann nicht korrigiert werden.");
      return;
    }
    setSession(next);
    if (next.phase === "completed") setManualInputValue(String(summarizeWorkout(next).actualReps));
    setAwaitingRpe(false);
    cancelCompletedSetEdit();
  };
  const manualCompletedSetsReview =
    isPlanned && session && session.setReps.length > 0 ? (
      <div className="mt-4 w-full max-w-xl space-y-2 rounded-xl border border-border p-3 text-left">
        <p className="text-sm font-semibold">Abgeschlossene Sätze korrigieren</p>
        {session.setReps.map((reps, index) => (
          <div key={`${session.id}-${index}`} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-24">
              Satz {index + 1}: {reps}
            </span>
            {editingCompletedSet === index ? (
              <>
                <input
                  aria-label={`Korrektur für Satz ${index + 1}`}
                  type="number"
                  min={0}
                  max={1000}
                  value={completedSetEditValue}
                  aria-invalid={completedSetEditError !== null}
                  onChange={(event) => {
                    setCompletedSetEditValue(event.target.value);
                    setCompletedSetEditError(null);
                  }}
                  className="w-24 rounded-lg border border-border bg-background px-2 py-1"
                />
                <button
                  type="button"
                  onClick={applyCompletedSetEdit}
                  className="rounded-lg bg-primary px-3 py-1 text-primary-foreground"
                >
                  Übernehmen
                </button>
                <button
                  type="button"
                  onClick={cancelCompletedSetEdit}
                  className="rounded-lg border border-border px-3 py-1"
                >
                  Abbrechen
                </button>
                {completedSetEditError && (
                  <span role="alert" className="w-full text-destructive">
                    {completedSetEditError}
                  </span>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => beginCompletedSetEdit(index)}
                className="rounded-lg border border-border px-3 py-1"
              >
                Korrigieren
              </button>
            )}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Gesamt: {summarizeWorkout(session).actualReps} / 1.000 Wiederholungen.
        </p>
        {session.phase === "completed" && (
          <button
            type="button"
            disabled={
              saving ||
              editingCompletedSet !== null ||
              summarizeWorkout(session).actualReps <= 0 ||
              summarizeWorkout(session).actualReps > 1000
            }
            onClick={() => setAwaitingRpe(true)}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            Ergebnis speichern
          </button>
        )}
      </div>
    ) : null;

  const completedManualReps =
    session?.phase === "active" ? session.setReps.reduce((sum, reps) => sum + reps, 0) : 0;
  const manualInputState = manualWorkoutInput(manualInput, completedManualReps);
  const { error: manualInputError } = manualInputState;
  const canSubmitManual = manualInputState.canSubmit && editingCompletedSet === null;
  const manualControls = (
    <div
      className="alo-manual-essential mt-4 grid w-full max-w-xs grid-cols-2 gap-3"
      role="group"
      aria-label="Wiederholungen anpassen"
    >
      <button
        type="button"
        aria-label="Eine Wiederholung weniger"
        disabled={
          !manualEnabled ||
          saving ||
          !manualInput ||
          manualInputError !== null ||
          Number(manualInput) <= 0
        }
        onClick={() => updateManualInput(adjustManualCount(manualInput, -1))}
        className="min-h-14 min-w-14 rounded-2xl border border-border bg-secondary px-4 py-3 text-2xl font-bold disabled:opacity-40"
      >
        −
      </button>
      <button
        type="button"
        aria-label="Eine Wiederholung mehr"
        disabled={
          !manualEnabled || saving || manualInputError !== null || Number(manualInput) >= 1000
        }
        onClick={() => updateManualInput(adjustManualCount(manualInput, 1))}
        className="min-h-14 min-w-14 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-2xl font-bold text-primary disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
  const manualHint = (
    <p
      id="manual-save-hint"
      className="alo-manual-essential mt-3 text-center text-sm leading-relaxed text-muted-foreground"
      aria-live="polite"
    >
      {manualInputError ??
        (isPlanned && session?.phase === "active"
          ? `Verbleibendes Trainingsbudget: ${Math.max(0, 1000 - completedManualReps)} Wiederholungen.`
          : !manualEnabled
            ? "Starte den nächsten Satz, um Wiederholungen einzutragen."
            : !manualInput || Number(manualInput) <= 0
              ? "Zum Speichern mindestens 1 Wiederholung eintragen. Noch wurde nichts gespeichert."
              : "Deine Eingabe ist noch nicht gespeichert. Danach kannst du die Belastung angeben.")}
    </p>
  );

  // Manual mode: user just types how many they did.
  const submitManual = () => {
    if (savingRef.current) return;
    if (editingCompletedSet !== null) {
      setSavedHint("Bitte die Satzkorrektur zuerst übernehmen oder abbrechen.");
      return;
    }
    const { count: n, error, canSubmit } = manualWorkoutInput(manualInput, completedManualReps);
    if (!canSubmit || n === null) {
      setSavedHint(error ?? "Zum Speichern mindestens 1 Wiederholung eintragen.");
      return;
    }
    if (!userId || !exercise) return;
    if (isPlanned && session) {
      if (session.phase !== "active") return;
      const activeBudgetState = manualWorkoutInput(manualInput, completedManualReps);
      if (activeBudgetState.error) {
        setSavedHint(activeBudgetState.error);
        return;
      }
      let next = { ...session, currentReps: n };
      next = finishWorkoutSet(next);
      setSession(next);
      setNow(Date.now());
      if (next.phase === "completed") {
        const total = next.setReps.reduce((sum, value) => sum + value, 0);
        setManualInputValue(String(total));
        setAwaitingRpe(total <= 1000);
        if (total > 1000)
          setSavedHint(
            "Pro Training sind höchstens 1.000 Wiederholungen erlaubt. Korrigiere einen Satz; dein Entwurf bleibt erhalten.",
          );
      } else {
        setManualInputValue("");
      }
      return;
    }
    setAwaitingRpe(true);
  };

  const saveManualWithRpe = async (rpe: number | null) => {
    const saveOwner = workoutContextRef.current;
    if (savingOwnerRef.current && savingOwnerRef.current !== saveOwner)
      releaseSaveLock(savingOwnerRef.current);
    if (savingRef.current) return;
    if (editingCompletedSet !== null) {
      setSavedHint("Bitte die Satzkorrektur zuerst übernehmen oder abbrechen.");
      return;
    }
    const inputAtSave = manualInputRef.current;
    const completedCountAtSave =
      session?.phase === "active" ? session.setReps.reduce((sum, reps) => sum + reps, 0) : 0;
    const inputState = manualWorkoutInput(inputAtSave, completedCountAtSave);
    if (inputState.error) {
      setSavedHint(inputState.error);
      return;
    }
    const sessionSummary = isPlanned && session ? summarizeWorkout(session) : null;
    const n = sessionSummary?.actualReps ?? inputState.count ?? 0;
    if (n <= 0) {
      setSavedHint("Zum Speichern mindestens 1 Wiederholung eintragen.");
      return;
    }
    if (!userId || !exercise) return;
    if (n > 1000) {
      setAwaitingRpe(false);
      setSavedHint(
        "Speichern nicht möglich: Pro Training sind höchstens 1.000 Wiederholungen erlaubt. Dein Entwurf bleibt erhalten.",
      );
      return;
    }
    setAwaitingRpe(false);
    savingRef.current = true;
    savingOwnerRef.current = saveOwner;
    setSaving(true);
    const payload = {
      user_id: userId,
      exercise_id: exerciseId,
      count: n,
      form_score: null,
      clean_reps: null,
      rpe,
    };
    const draftKey =
      session?.id ??
      unplannedWorkoutDraftKey(
        workoutVisitId,
        unplannedDraftRevision.current,
        "manual",
        inputAtSave,
      );
    const payloadKey = JSON.stringify(payload);
    const identityContextKey = saveContextKey;
    const identityLookupKey = workoutSaveIdentityLookupKey(
      identityContextKey,
      draftKey,
      payloadKey,
    );
    const pendingIdentity = resolvePendingWorkoutSaveIdentity(
      identityContextKey,
      draftKey,
      payloadKey,
      pendingWorkoutSaveCache.get(identityLookupKey) ?? null,
      () => globalThis.crypto?.randomUUID?.() ?? `workout-${Date.now()}-${Math.random()}`,
      () => new Date().toISOString(),
      sessionSummary?.actualDurationMs ?? 0,
    );
    pendingWorkoutSaveCache.set(identityLookupKey, pendingIdentity);
    const draftStorageKey = workoutSessionStorageKey(userId, exerciseId);
    let draftStorage: Storage | null = null;
    try {
      if (typeof window !== "undefined") draftStorage = window.localStorage;
    } catch {
      // Storage may be blocked; save completion must still be handled safely.
    }
    const capturedDraft = draftStorage
      ? captureWorkoutDraft(draftStorage, draftStorageKey, session)
      : null;
    const duration_ms = pendingIdentity.durationMs;
    try {
      let saveResult;
      try {
        saveResult = await saveOrQueue("workouts", {
          id: pendingIdentity.id,
          ...payload,
          duration_ms,
          created_at: pendingIdentity.createdAt,
        });
      } catch {
        if (mountedRef.current && workoutContextRef.current === saveOwner) {
          setSavedHint("Speichern fehlgeschlagen – deine Eingaben bleiben erhalten");
          setAwaitingRpe(true);
        }
        return;
      }
      let error: unknown;
      let queued: boolean;
      try {
        ({ error, queued } = saveResult);
      } catch {
        if (mountedRef.current && workoutContextRef.current === saveOwner) {
          setSavedHint("Speichern fehlgeschlagen – deine Eingaben bleiben erhalten");
          setAwaitingRpe(true);
        }
        return;
      }
      if (error) {
        if (mountedRef.current && workoutContextRef.current === saveOwner) {
          setSavedHint("Speichern fehlgeschlagen – deine Eingaben bleiben erhalten");
          setAwaitingRpe(true);
        }
        return;
      }
      const uiContextStillCurrent =
        mountedRef.current &&
        workoutContextRef.current === saveOwner &&
        manualInputRef.current === inputAtSave &&
        JSON.stringify(sessionRef.current) === JSON.stringify(session);
      const finalization = finalizeWorkoutSave({
        outcome: queued ? "queued" : "saved",
        storage: draftStorage,
        captured: capturedDraft,
        identityLookupKey,
        uiCurrent: uiContextStillCurrent,
        onConfirmedSuccess: () => {
          if (isPlanned && sessionSummary && draftStorage)
            writeWorkoutMetadata(draftStorage, {
              version: 1,
              rowId: pendingIdentity.id,
              userId,
              exerciseId,
              partial: sessionSummary.partial,
              summary: { ...sessionSummary, actualDurationMs: duration_ms },
              createdAt: pendingIdentity.createdAt,
            });
        },
      });
      if (!uiContextStillCurrent) return;
      setLatestCount(n);
      setLatestStatus("loaded");
      try {
        feedbackSuccess();
      } catch {
        // Optional success feedback must not turn a completed save into a retry prompt.
      }
      const newBest = !sessionSummary?.partial && n > (best ?? -1);
      setSummary({
        count: n,
        durationMs: duration_ms,
        isBest: newBest && !queued,
        rpe,
        plannedSets: sessionSummary?.plannedSets,
        actualSets: sessionSummary?.actualSets,
        plannedReps: sessionSummary?.plannedReps,
        actualReps: sessionSummary?.actualReps,
        partial: sessionSummary?.partial,
      });
      if (queued) {
        setSavedHint("Auf diesem Gerät vorgemerkt – Bestwert nach Synchronisierung prüfen");
      } else if (newBest) {
        setBest(n);
        setBestStatus("loaded");
        setSavedHint(`Neuer Bestwert: ${n}`);
      } else {
        setSavedHint("Training gespeichert");
      }
      if (!finalization.uiDraftClosed) {
        setSavedHint(
          queued
            ? "Auf diesem Gerät vorgemerkt. Der lokale Entwurf konnte nicht sicher bereinigt werden."
            : "Training gespeichert. Der lokale Entwurf konnte nicht sicher bereinigt werden.",
        );
      }
      setManualInputValue("");
      setSession(null);
      if (!session) unplannedDraftRevision.current += 1;
    } finally {
      releaseSaveLock(saveOwner);
    }
  };

  if (useManual) {
    return (
      <>
        <DesignView variant="sport">
          <main
            className="alo-training-focus sport-only mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col gap-6 px-5 py-6 sm:px-8"
            data-training-focus={focused}
          >
            {focusControls}
            <SportPageIntro
              eyebrow="SESSION · MANUELLE ERFASSUNG"
              title={isPushup ? "Liegestütze" : exercise.name}
              description="Du gibst dein Ergebnis selbst ein. Dein Entwurf und Satzplan bleiben während der Session erhalten."
            >
              <Link to="/" className="sport-back-link inline-flex items-center gap-2">
                <ArrowLeft size={16} /> Zurück
              </Link>
            </SportPageIntro>
            <section className="alo-training-secondary sport-focus-card rounded-3xl border border-border bg-card/60 p-5 sm:p-7">
              <SportSectionLabel number="01">Dein Leistungsstand</SportSectionLabel>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Stat
                  label="Persönlicher Bestwert"
                  value={bestStatValue}
                  unit={
                    best !== null && bestStatus === "loaded" && exercise.unit === "seconds"
                      ? "Sek."
                      : undefined
                  }
                />
                <Stat label="Letzte Erfassung" value={latestStatValue} />
              </div>
            </section>
            {isPlanned && session && (
              <section
                className="alo-session-controls rounded-3xl border border-primary/25 bg-primary/5 p-5 text-center"
                aria-live="polite"
              >
                <SportSectionLabel number="02">Trainingsplan</SportSectionLabel>
                {plan.title && <div className="mt-3 text-lg font-bold">{plan.title}</div>}
                <div className="mt-2 text-sm font-semibold text-muted-foreground">
                  Satz {Math.min(session.currentSet, plan.sets)} / {plan.sets} ·{" "}
                  {session.phase === "preparation"
                    ? "Vorbereitung"
                    : session.phase === "rest"
                      ? `Pause ${restRemaining ?? 0}s`
                      : session.phase === "paused"
                        ? "Pausiert"
                        : session.phase === "completed"
                          ? "Plan abgeschlossen"
                          : "Aktiver Satz"}
                  {plan.reps ? ` · Ziel ${plan.reps} je Satz` : ""}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Bisher {session.setReps.reduce((a, b) => a + b, 0) + session.currentReps}{" "}
                  Wiederholungen
                </div>
                {session.phase === "preparation" && (
                  <button
                    onClick={() => {
                      setSession((s) => (s ? startWorkoutSet(s) : s));
                      setNow(Date.now());
                    }}
                    className="mt-4 w-full rounded-2xl bg-primary px-4 py-3 font-semibold text-primary-foreground"
                  >
                    Satz starten
                  </button>
                )}
                {session.phase === "rest" && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSession((s) => (s ? extendWorkoutRest(s, 30) : s))}
                      className="rounded-xl border border-border px-3 py-3 text-sm"
                    >
                      +30 Sek.
                    </button>
                    <button
                      onClick={() => {
                        setSession((s) => (s ? startWorkoutSet(s) : s));
                        setNow(Date.now());
                      }}
                      className="rounded-xl bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground"
                    >
                      Fortsetzen
                    </button>
                  </div>
                )}
                {session.phase === "paused" && (
                  <button
                    onClick={() => {
                      setSession((s) => (s ? startWorkoutSet(s) : s));
                      setNow(Date.now());
                    }}
                    className="mt-4 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"
                  >
                    Fortsetzen
                  </button>
                )}
                {session.phase === "active" && (
                  <button
                    onClick={() => setSession((s) => (s ? pauseWorkout(s) : s))}
                    className="mt-4 w-full rounded-xl border border-border px-4 py-3 text-sm"
                  >
                    Pausieren
                  </button>
                )}
                {session.phase !== "completed" &&
                  (session.currentReps > 0 || session.setReps.some((r) => r > 0)) && (
                    <button
                      onClick={finish}
                      className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-sm"
                    >
                      Teiltraining speichern
                    </button>
                  )}
                {!summary && (
                  <button
                    type="button"
                    onClick={resetAll}
                    className="alo-training-discard mt-2 w-full rounded-xl border border-border px-4 py-3 text-sm"
                  >
                    Entwurf verwerfen
                  </button>
                )}
              </section>
            )}
            {!summary && (
              <section
                className="alo-manual-entry sport-focus-card flex flex-1 flex-col items-center justify-center rounded-[2rem] border border-border bg-card/65 p-6 text-center sm:p-10"
                data-entry-enabled={!isPlanned || session?.phase === "active"}
              >
                {isPlanned && session && (
                  <div className="mb-5 rounded-full border border-border bg-background/50 px-4 py-2 text-xs font-semibold text-muted-foreground">
                    {session.phase === "completed"
                      ? "Plan abgeschlossen"
                      : `Satz ${Math.min(session.currentSet, plan.sets)} / ${plan.sets} · ${session.phase === "rest" ? `Pause ${restRemaining ?? 0}s` : "Wiederholungen eintragen"}`}
                  </div>
                )}
                <SportSectionLabel number={isPlanned ? "03" : "02"}>
                  Erfasse deine Wiederholungen
                </SportSectionLabel>
                <label
                  htmlFor="manual-repetitions-sport"
                  className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Anzahl der Liegestütze
                </label>
                <input
                  id="manual-repetitions-sport"
                  aria-label="Anzahl der Liegestütze"
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={0}
                  max={1000}
                  value={manualInput}
                  aria-invalid={manualInputError !== null}
                  aria-describedby="manual-save-hint"
                  disabled={isPlanned && session?.phase !== "active"}
                  onChange={(e) => updateManualInput(e.target.value)}
                  placeholder="—"
                  className="mt-3 w-full max-w-xs rounded-2xl border border-border bg-background/60 px-5 py-5 text-center font-display text-7xl font-bold tabular-nums text-foreground focus:border-primary focus:outline-none"
                />
                {manualControls}
                <p
                  className="alo-manual-essential mt-3 text-sm text-muted-foreground"
                  aria-live="polite"
                >
                  {manualInputError ??
                    (manualInput === ""
                      ? "Noch keine Erfassung"
                      : `${manualInput} Wiederholungen eingetragen`)}
                </p>
                <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Trage die Anzahl deiner gerade absolvierten Liegestütze ein.
                </p>
                {manualHint}
                {manualCompletedSetsReview}
              </section>
            )}
            {awaitingRpe ? (
              <RpePicker saving={saving} onPick={saveManualWithRpe} />
            ) : (
              (!isPlanned || session?.phase === "active") && (
                <button
                  onClick={submitManual}
                  aria-describedby="manual-save-hint"
                  disabled={
                    saving || !canSubmitManual || (isPlanned && session?.phase !== "active")
                  }
                  className="w-full rounded-2xl bg-primary px-4 py-4 text-base font-bold text-primary-foreground disabled:opacity-50"
                >
                  {saving
                    ? "Speichere …"
                    : isPlanned && session?.phase !== "completed"
                      ? "Satz speichern"
                      : "Einheit speichern"}
                </button>
              )
            )}
            {summary && (
              <section className="rounded-3xl border border-primary/30 bg-primary/10 p-6">
                <SportSectionLabel number="04">Session abgeschlossen</SportSectionLabel>
                <div className="mt-3 text-2xl font-bold">{summary.count} Wiederholungen</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {summary.isBest
                    ? "Neuer Bestwert"
                    : summary.partial
                      ? "Teiltraining gespeichert"
                      : "Gut gemacht"}
                </div>
                {summary.plannedSets !== undefined && (
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    Plan: {summary.plannedSets} {summary.plannedSets === 1 ? "Satz" : "Sätze"}
                    {summary.plannedReps ? ` · ${summary.plannedReps} Wdh. geplant` : ""} ·
                    Tatsächlich: {summary.actualSets ?? 0} Sätze /{" "}
                    {summary.actualReps ?? summary.count} Wdh. · Dauer{" "}
                    {formatTime(summary.durationMs)}
                  </p>
                )}
              </section>
            )}
            {summary && (
              <button
                onClick={resetAll}
                className="alo-training-discard w-full rounded-2xl border border-border bg-secondary px-4 py-3 text-sm font-semibold"
              >
                Neues Training
              </button>
            )}
            {isPlanned && (
              <p className="text-center text-xs text-muted-foreground">
                Zusammenfassung und Teiltraining-Markierung werden lokal zugeordnet.
              </p>
            )}
            <p className="text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {savedHint ?? "Ehrlich und in deinem Tempo"}
            </p>
          </main>
        </DesignView>
        <DesignView variant="classic">
          <main
            className="alo-training-focus classic-only relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6 pb-4"
            data-training-focus={focused}
          >
            {focusControls}
            <header className="flex items-center justify-between">
              <Link
                to="/"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
              >
                <span aria-hidden>←</span>
                <span>Zurück</span>
              </Link>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{exercise.icon}</span>
                <span className="text-sm font-medium text-foreground">
                  {isPushup ? "Liegestütze" : exercise.name}
                  <span className="ml-2 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    Manuell
                  </span>
                </span>
              </div>
            </header>

            <section className="mt-6 grid grid-cols-2 gap-3">
              <Stat
                label="Bestwert"
                value={bestStatValue}
                unit={
                  best !== null && bestStatus === "loaded" && exercise.unit === "seconds"
                    ? "Sek."
                    : undefined
                }
              />
              <Stat label="Letzte Erfassung" value={latestStatValue} />
            </section>

            {isPlanned && session && (
              <section
                className="mt-3 rounded-2xl border border-border bg-card/50 p-3 text-center"
                aria-live="polite"
              >
                {plan.title && <div className="mb-1 text-sm font-semibold">{plan.title}</div>}
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Satz {Math.min(session.currentSet, plan.sets)} / {plan.sets} ·{" "}
                  {session.phase === "preparation"
                    ? "Vorbereitung"
                    : session.phase === "rest"
                      ? `Pause ${restRemaining ?? 0}s`
                      : session.phase === "paused"
                        ? "Pausiert"
                        : session.phase === "completed"
                          ? "Plan abgeschlossen"
                          : "Aktiver Satz"}
                  {plan.reps ? ` · Ziel ${plan.reps} je Satz` : ""}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Bisher {session.setReps.reduce((a, b) => a + b, 0) + session.currentReps}{" "}
                  Wiederholungen
                </div>
                {session.phase === "preparation" && (
                  <button
                    onClick={() => {
                      setSession((s) => (s ? startWorkoutSet(s) : s));
                      setNow(Date.now());
                    }}
                    className="mt-2 w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    Satz starten
                  </button>
                )}
                {session.phase === "rest" && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => setSession((s) => (s ? extendWorkoutRest(s, 30) : s))}
                      className="flex-1 rounded-lg border border-border px-3 py-2 text-xs"
                    >
                      +30 Sek.
                    </button>
                    <button
                      onClick={() => {
                        setSession((s) => (s ? startWorkoutSet(s) : s));
                        setNow(Date.now());
                      }}
                      className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                    >
                      Fortsetzen
                    </button>
                  </div>
                )}
                {session.phase === "paused" && (
                  <button
                    onClick={() => {
                      setSession((s) => (s ? startWorkoutSet(s) : s));
                      setNow(Date.now());
                    }}
                    className="mt-2 w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    Fortsetzen
                  </button>
                )}
                {session.phase === "active" && (
                  <button
                    onClick={() => setSession((s) => (s ? pauseWorkout(s) : s))}
                    className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-xs"
                  >
                    Pausieren
                  </button>
                )}
                {session.phase !== "completed" &&
                  (session.currentReps > 0 || session.setReps.some((r) => r > 0)) && (
                    <button
                      onClick={finish}
                      className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-xs"
                    >
                      Teiltraining speichern
                    </button>
                  )}
                {!summary && (
                  <button
                    type="button"
                    onClick={resetAll}
                    className="alo-training-discard mt-2 w-full rounded-lg border border-border px-3 py-2 text-xs"
                  >
                    Verwerfen
                  </button>
                )}
              </section>
            )}

            {!summary && (
              <>
                <section
                  className="alo-manual-entry mt-6 flex flex-1 flex-col items-center justify-center rounded-[2rem] border border-border bg-card/60 p-6 text-center backdrop-blur"
                  data-entry-enabled={!isPlanned || session?.phase === "active"}
                >
                  {isPlanned && session && (
                    <div className="text-xs font-medium text-muted-foreground">
                      {session.phase === "completed"
                        ? "Plan abgeschlossen"
                        : `Satz ${Math.min(session.currentSet, plan.sets)} / ${plan.sets} · ${session.phase === "rest" ? `Pause ${restRemaining ?? 0}s` : "Wiederholungen eintragen"}`}
                    </div>
                  )}
                  <label
                    htmlFor="manual-repetitions"
                    className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground"
                  >
                    Wie viele Liegestütze hast du gerade gemacht?
                  </label>
                  <input
                    id="manual-repetitions"
                    aria-label="Anzahl der Liegestütze"
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min={0}
                    max={1000}
                    value={manualInput}
                    aria-invalid={manualInputError !== null}
                    aria-describedby="manual-save-hint"
                    disabled={isPlanned && session?.phase !== "active"}
                    onChange={(e) => updateManualInput(e.target.value)}
                    placeholder="—"
                    className="mt-4 w-full max-w-[14rem] rounded-2xl border border-border bg-background/60 py-4 text-center font-display text-[5rem] font-bold tabular-nums text-foreground focus:border-primary focus:outline-none"
                  />
                  {manualControls}
                  <p
                    className="alo-manual-essential mt-3 text-sm text-muted-foreground"
                    aria-live="polite"
                  >
                    {manualInputError ??
                      (manualInput === ""
                        ? "Noch keine Erfassung"
                        : `${manualInput} Wiederholungen eingetragen`)}
                  </p>
                  <p className="mt-4 max-w-[16rem] text-sm text-muted-foreground">
                    Trage die Anzahl deiner gerade absolvierten Liegestütze ein und speichere.
                  </p>
                  {manualHint}
                  {manualCompletedSetsReview}
                </section>

                {awaitingRpe ? (
                  <RpePicker saving={saving} onPick={saveManualWithRpe} />
                ) : (
                  (!isPlanned || session?.phase === "active") && (
                    <button
                      onClick={submitManual}
                      aria-describedby="manual-save-hint"
                      disabled={
                        saving || !canSubmitManual || (isPlanned && session?.phase !== "active")
                      }
                      className="mt-4 w-full rounded-xl bg-primary px-4 py-4 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"
                    >
                      {saving
                        ? "Speichere…"
                        : isPlanned && session?.phase !== "completed"
                          ? "Satz speichern"
                          : "Einheit speichern"}
                    </button>
                  )
                )}
              </>
            )}
            {summary && (
              <div className="mt-4 w-full rounded-2xl border border-primary/20 bg-primary/10 p-4 text-left">
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {summary.partial ? "Teiltraining gespeichert" : "Training abgeschlossen"}
                </div>
                <div className="mt-2 text-lg font-semibold text-foreground">
                  {summary.count} Wiederholungen
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {summary.isBest
                    ? "Neuer Bestwert"
                    : summary.partial
                      ? "Teiltraining gespeichert"
                      : "Gut gemacht"}
                </div>
                {summary.plannedSets !== undefined && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Plan: {summary.plannedSets} {summary.plannedSets === 1 ? "Satz" : "Sätze"}
                    {summary.plannedReps ? ` · ${summary.plannedReps} Wdh. geplant` : ""} ·
                    Tatsächlich: {summary.actualSets ?? 0}{" "}
                    {summary.actualSets === 1 ? "Satz" : "Sätze"} /{" "}
                    {summary.actualReps ?? summary.count} Wdh. · Tatsächliche Dauer:{" "}
                    {formatTime(summary.durationMs)} · Plandauer nicht vorgegeben
                  </div>
                )}
              </div>
            )}

            {summary && (
              <button
                onClick={resetAll}
                className="alo-training-discard mt-3 w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-medium"
              >
                Neues Training
              </button>
            )}

            {isPlanned && (
              <p className="mt-2 text-center text-[10px] text-muted-foreground">
                Zusammenfassung und Teiltraining-Markierung werden nur auf diesem Gerät lokal
                zugeordnet.
              </p>
            )}
            <p className="mt-3 text-center text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
              {savedHint ?? "Ehrlichkeitsmodus 🙏"}
            </p>
          </main>
        </DesignView>
      </>
    );
  }

  return (
    <>
      <DesignView variant="sport">
        <main
          className="alo-training-focus sport-only relative mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col gap-6 px-5 py-6 sm:px-8 pb-10"
          data-training-focus={focused}
        >
          {focusControls}
          <SportPageIntro
            eyebrow={isPlanned ? "WORKOUT · GEPLANTE SESSION" : "WORKOUT · LIVE-TRACKING"}
            title={isPushup ? "Liegestütze" : "" + exercise.name}
            description={
              isPlanned
                ? (plan.title ??
                  `${plan.sets} Sätze${plan.reps ? ` · ${formatWorkoutCount(plan.reps, exercise.unit)} je Satz` : ` · Freies ${exercise.unit === "seconds" ? "Sekundenziel" : "Wiederholungsziel"}`}`)
                : exercise.unit === "seconds"
                  ? "Halte die Position. Deine Zeit und Bestleistung werden live erfasst."
                  : "Bleib im Rhythmus. Deine Wiederholungen und Bestleistung werden live erfasst."
            }
          >
            <Link to="/" className="sport-back-link inline-flex items-center gap-2">
              <ArrowLeft size={16} /> Zurück
            </Link>
          </SportPageIntro>
          <section className="alo-training-secondary grid gap-3 sm:grid-cols-3">
            <Stat label="Trainingszeit" value={formatTime(elapsed)} />
            <Stat
              label={exercise.unit === "seconds" ? "Status" : "Tempo"}
              value={
                exercise.unit === "seconds"
                  ? active
                    ? "Läuft"
                    : "Bereit"
                  : pace
                    ? pace.toFixed(0)
                    : "—"
              }
              unit={exercise.unit === "seconds" ? undefined : "/min"}
            />
            <Stat
              label="Persönlicher Bestwert"
              value={bestStatValue}
              unit={
                best !== null && bestStatus === "loaded" && exercise.unit === "seconds"
                  ? "Sek."
                  : undefined
              }
            />
          </section>
          {isPlanned && session && (
            <section
              className="alo-session-controls rounded-3xl border border-primary/25 bg-primary/5 p-5"
              aria-live="polite"
            >
              <SportSectionLabel number="01">Satzsteuerung</SportSectionLabel>
              {plan.title && <p className="mt-3 text-base font-bold">{plan.title}</p>}
              <div className="mt-2 flex flex-wrap items-baseline gap-2">
                <span className="text-xl font-bold">
                  Satz {Math.min(session.currentSet, plan.sets)} / {plan.sets}
                </span>
                <span className="text-sm text-muted-foreground">
                  {session.phase === "preparation"
                    ? "Vorbereitung"
                    : session.phase === "rest"
                      ? "Pause"
                      : session.phase === "paused"
                        ? "Pausiert"
                        : session.phase === "completed"
                          ? "Abgeschlossen"
                          : "Aktiver Satz"}
                </span>
                {plan.reps && (
                  <span className="text-sm text-muted-foreground">
                    · {count} / {plan.reps} {workoutCountUnit(exercise.unit)}
                  </span>
                )}
              </div>
              {restRemaining !== null && (
                <div className="mt-3 font-display text-4xl font-bold tabular-nums text-primary">
                  {Math.floor(restRemaining / 60)}:{String(restRemaining % 60).padStart(2, "0")}
                </div>
              )}
              {session.phase === "preparation" && (
                <button
                  onClick={() => {
                    setSession((s) => (s ? startWorkoutSet(s) : s));
                    setActive(true);
                    setStartedAt(Date.now());
                  }}
                  className="mt-4 w-full rounded-2xl bg-primary px-4 py-3 font-semibold text-primary-foreground"
                >
                  Satz starten
                </button>
              )}
              {session.phase === "rest" && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSession((s) => (s ? extendWorkoutRest(s, 30) : s))}
                    className="rounded-xl border border-border px-3 py-3 text-sm"
                  >
                    +30 Sek.
                  </button>
                  <button
                    onClick={() => {
                      setSession((s) => (s ? startWorkoutSet(s) : s));
                      setActive(true);
                      setStartedAt(Date.now());
                    }}
                    className="rounded-xl bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground"
                  >
                    Fortsetzen
                  </button>
                </div>
              )}
              {session.phase === "paused" && (
                <button
                  onClick={() => {
                    setSession((s) => (s ? startWorkoutSet(s) : s));
                    setActive(true);
                    setStartedAt(Date.now());
                  }}
                  className="mt-3 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"
                >
                  Fortsetzen
                </button>
              )}
            </section>
          )}
          {useCamera && (!active || !!cameraError) && (
            <aside className="rounded-2xl border border-border bg-card/55 p-4 text-sm leading-relaxed text-muted-foreground">
              Beim Start lädt die App Erkennungssoftware und ein Pose-Modell. Die Pose wird lokal
              verarbeitet; Video und Einzelbilder werden nicht gespeichert oder übertragen. Stelle
              das Handy seitlich auf und achte auf gute Beleuchtung.{" "}
              <button
                type="button"
                className="ml-1 font-semibold text-primary underline underline-offset-4"
                onClick={() =>
                  navigate({
                    to: "/workout/$exerciseId",
                    params: { exerciseId },
                    search: { ...search, mode: "manual" },
                  })
                }
              >
                Ohne Kamera manuell trainieren
              </button>
            </aside>
          )}

          <section
            className="sport-workout-stage relative flex min-h-[24rem] flex-1 flex-col items-center justify-center overflow-hidden rounded-[2rem] border border-primary/20 bg-card/75 px-5 py-8 text-center sm:min-h-[32rem]"
            onPointerDown={handleSurfaceTap}
          >
            {useCamera && (
              <video
                ref={performanceLayout ? videoRef : undefined}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35"
                playsInline
                muted
              />
            )}
            <SportSectionLabel number={isPlanned ? "02" : "01"}>
              {exercise.unit === "seconds" ? (
                <>
                  <Timer className="mr-2 inline" size={15} />
                  {exercise.name}
                </>
              ) : isPushup ? (
                `Liegestütze · ${modeLabel[pushMode]}`
              ) : (
                exercise.name
              )}
            </SportSectionLabel>
            {countdown !== null && (
              <span className="mt-6 rounded-full border border-primary/30 bg-primary/10 px-5 py-2 text-sm font-bold text-primary">
                Los in {countdown} …
              </span>
            )}
            <span
              key={pop}
              className="relative mt-4 font-display text-[8rem] font-bold leading-none tabular-nums text-foreground sm:text-[10rem]"
            >
              {count}
            </span>
            <span className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              {motivation ??
                (useCamera
                  ? "Seitlich aufstellen: Der ganze Körper muss gut beleuchtet sichtbar sein."
                  : !active && count === 0
                    ? cfg?.idleHint
                    : cfg?.activeHint)}
            </span>
            {motionError && <span className="mt-3 text-sm text-destructive">{motionError}</span>}
            {useCamera && cameraError && (
              <span role="alert" className="mt-3 text-sm text-destructive">
                Kamera nicht verfügbar. Bitte manuell trainieren oder Kameraberechtigung prüfen.
              </span>
            )}
            {useCamera && active && !cameraError && (
              <span
                role="status"
                aria-live="polite"
                className="mt-3 inline-flex items-center gap-2 text-sm"
              >
                <Activity size={16} />
                {cameraReady ? `Kameraerkennung · ${cameraStatus}` : cameraStatus}
              </span>
            )}
            {useCamera && cameraReady && elbowAngle !== null && (
              <span className="mt-2 text-sm font-semibold tabular-nums text-primary">
                Ellbogenwinkel {elbowAngle}° ·{" "}
                {elbowAngle >= 155 ? "oben" : elbowAngle <= 85 ? "unten" : "Bewegung"}
              </span>
            )}
            {useCamera && cameraReady && lastQuality && (
              <span className="mt-2 text-xs text-muted-foreground">
                Form {lastQuality.grade.toFixed(1)} / 5
                {lastQuality.full ? " · volle Wiederholung" : " · halbe Wiederholung"}
              </span>
            )}
            {useCamera && cameraReady && liveCue && (
              <span className="mt-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-bold text-primary">
                {liveCue}
              </span>
            )}
            {formStats && (
              <span className="mt-3 text-xs text-muted-foreground">
                Technik {formStats.formScore.toFixed(1)} · {formStats.cleanReps} saubere
                Wiederholungen
              </span>
            )}
          </section>
          {!active &&
            count === 0 &&
            !isTapDriven &&
            countdown === null &&
            (!isPlanned || session?.phase === "preparation") && (
              <button
                className="alo-workout-start inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-bold text-primary-foreground"
                onClick={start}
              >
                <Play size={18} />
                Starten
              </button>
            )}
          {isPlanned && session && active && !awaitingRpe && (
            <div className="alo-workout-actions grid grid-cols-2 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => {
                  decrement();
                  setSession((s) => (s ? undoWorkoutRep(s) : s));
                }}
                disabled={count <= 0}
                className="rounded-xl border border-border bg-secondary px-3 py-3 text-sm disabled:opacity-40"
              >
                {exercise.unit === "seconds" ? "Sekunde −1" : "Wiederholung −1"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActive(false);
                  setStartedAt(null);
                  setSession((s) => (s ? pauseWorkout(s) : s));
                }}
                className="rounded-xl border border-border bg-secondary px-3 py-3 text-sm"
              >
                Pausieren
              </button>
              <button
                type="button"
                onClick={() => {
                  setSession((s) => (s ? finishWorkoutSet(s, Date.now()) : s));
                  setActive(false);
                  setStartedAt(null);
                  observedCount.current = 0;
                  resetEngine();
                }}
                className="rounded-xl border border-border bg-secondary px-3 py-3 text-sm"
              >
                Satz abschließen
              </button>
            </div>
          )}
          {awaitingRpe && <RpePicker saving={saving} onPick={saveWithRpe} />}
          {!awaitingRpe &&
            (active ||
              count > 0 ||
              (isPlanned &&
                !!session &&
                ["rest", "paused", "completed"].includes(session.phase))) && (
              <div className="alo-workout-actions grid grid-cols-2 gap-3">
                <button
                  onClick={resetAll}
                  className="alo-training-discard rounded-2xl border border-border bg-secondary px-4 py-4 text-sm font-semibold"
                >
                  <RotateCcw className="mr-2 inline" size={15} />
                  Verwerfen
                </button>
                <button
                  onClick={finish}
                  aria-describedby="counted-save-hint"
                  disabled={
                    saving ||
                    (isPlanned && session ? summarizeWorkout(session).actualReps <= 0 : count === 0)
                  }
                  className="rounded-2xl bg-primary px-4 py-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
                >
                  {saving
                    ? "Speichere …"
                    : isPlanned && session?.phase !== "completed"
                      ? "Teiltraining speichern"
                      : "Einheit speichern"}
                </button>
              </div>
            )}
          {!awaitingRpe && active && count === 0 && (
            <p id="counted-save-hint" className="mt-3 text-center text-sm text-muted-foreground">
              Zum Speichern zuerst{" "}
              {exercise.unit === "seconds"
                ? "mindestens 1 Sekunde erfassen"
                : "mindestens 1 Wiederholung erfassen"}
              . Noch wurde nichts gespeichert.
            </p>
          )}
          {summary && !active && (
            <section className="rounded-3xl border border-primary/30 bg-primary/10 p-5">
              <SportSectionLabel number="03">Trainingsergebnis</SportSectionLabel>
              <div className="mt-3 text-2xl font-bold">
                {summary.count} {exercise.unit === "seconds" ? "Sekunden" : "Wiederholungen"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {summary.isBest
                  ? "Neuer Bestwert"
                  : summary.partial
                    ? "Teiltraining gespeichert"
                    : "Gut gemacht"}
              </div>
              {summary.plannedSets !== undefined && (
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  Plan: {summary.plannedSets} Sätze
                  {summary.plannedReps
                    ? ` · ${summary.plannedReps} ${workoutCountUnit(exercise.unit)} geplant`
                    : ""}{" "}
                  · Tatsächlich {summary.actualSets ?? 0} Sätze /{" "}
                  {summary.actualReps ?? summary.count} {workoutCountUnit(exercise.unit)} · Dauer{" "}
                  {formatTime(summary.durationMs)}
                  {summary.partial ? " · Teiltraining" : ""}
                </p>
              )}
              {summary.formScore != null && (
                <div className="mt-3 flex justify-between rounded-xl bg-background/50 p-3 text-sm">
                  <span>Technik-Note</span>
                  <span className="font-bold">
                    {summary.formScore.toFixed(1)} / 5 · {summary.cleanReps} sauber
                  </span>
                </div>
              )}
            </section>
          )}
          {isPlanned && (
            <p className="text-center text-xs text-muted-foreground">
              Zusammenfassung und Teiltraining-Markierung werden lokal zugeordnet.
            </p>
          )}
          <p className="text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {savedHint ??
              (useCamera
                ? cameraError
                  ? "Kamera nicht verfügbar – manuelle Erfassung möglich"
                  : active
                    ? cameraReady
                      ? "Kameraerkennung bereit"
                      : "Kameraerkennung wird vorbereitet"
                    : "Starten · Kamera-Modus"
                : isTapDriven
                  ? "Tippe auf die Trainingsfläche"
                  : active
                    ? "Erkennung aktiv"
                    : "Bereit zum Start")}
          </p>
        </main>
      </DesignView>
      <DesignView variant="classic">
        <main
          className="alo-training-focus classic-only relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6 pb-4"
          data-training-focus={focused}
        >
          {focusControls}
          <header className="flex items-center justify-between">
            <Link
              to="/"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
            >
              <span aria-hidden>←</span>
              <span>Zurück</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{exercise.icon}</span>
              <span className="text-sm font-medium text-foreground">
                {isPushup ? "Liegestütze" : exercise.name}
                {isPushup && (
                  <span className="ml-2 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    {modeLabel[pushMode]}
                  </span>
                )}
              </span>
            </div>
          </header>

          <section className="mt-6 grid grid-cols-3 gap-3">
            <Stat label="Zeit" value={formatTime(elapsed)} />
            <Stat
              label={exercise.unit === "seconds" ? "Status" : "Tempo"}
              value={
                exercise.unit === "seconds"
                  ? active
                    ? "Läuft"
                    : "Aus"
                  : pace
                    ? pace.toFixed(0)
                    : "—"
              }
              unit={exercise.unit === "seconds" ? undefined : "/min"}
            />
            <Stat
              label="Bestwert"
              value={best === null ? "Noch kein Bestwert" : best.toString()}
              unit={best !== null && exercise.unit === "seconds" ? "Sek." : undefined}
            />
          </section>

          {isPlanned && session && (
            <section
              className="mt-3 rounded-2xl border border-border bg-card/50 p-3 text-center"
              aria-live="polite"
            >
              {plan.title && (
                <div className="mb-1 text-sm font-semibold text-foreground">{plan.title}</div>
              )}
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {session.phase === "preparation"
                  ? "Vorbereitung"
                  : session.phase === "rest"
                    ? "Pause"
                    : session.phase === "paused"
                      ? "Pausiert"
                      : session.phase === "completed"
                        ? "Abgeschlossen"
                        : "Aktiver Satz"}
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                Satz {Math.min(session.currentSet, plan.sets)} / {plan.sets}
                {plan.reps ? ` · ${count} / ${plan.reps} ${workoutCountUnit(exercise.unit)}` : ""}
              </div>
              {restRemaining !== null && (
                <div className="mt-1 text-2xl font-bold tabular-nums text-primary">
                  {Math.floor(restRemaining / 60)}:{String(restRemaining % 60).padStart(2, "0")}
                </div>
              )}
              {session.phase === "rest" && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setSession((s) => (s ? extendWorkoutRest(s, 30) : s))}
                    className="flex-1 rounded-lg border border-border px-3 py-2 text-xs"
                  >
                    +30 Sek.
                  </button>
                  <button
                    onClick={() => {
                      setSession((s) => (s ? startWorkoutSet(s) : s));
                      setActive(true);
                      setStartedAt(Date.now());
                    }}
                    className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    Fortsetzen
                  </button>
                </div>
              )}
              {session.phase === "paused" && (
                <button
                  onClick={() => {
                    setSession((s) => (s ? startWorkoutSet(s) : s));
                    setActive(true);
                    setStartedAt(Date.now());
                  }}
                  className="mt-2 w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                >
                  Fortsetzen
                </button>
              )}
            </section>
          )}
          {useCamera && (!active || !!cameraError) && (
            <aside className="mt-3 rounded-xl border border-border bg-card/50 p-3 text-sm text-foreground">
              Wenn du „Starten“ wählst, lädt die App zuerst die Erkennungssoftware vom jsDelivr-CDN
              und das Pose-Modell von Google Cloud; anschließend fragt dein Browser nach
              Kamerazugriff. Die Pose wird danach direkt auf diesem Gerät aus dem Kamerabild
              berechnet. Weder Video noch Einzelbilder werden gespeichert oder übertragen. Stelle
              das Handy seitlich auf und sorge für gutes Licht; Schulter, Ellbogen, Handgelenk,
              Hüfte und Knie müssen sichtbar sein. Die automatische Erkennung kann Wiederholungen
              übersehen oder falsch zählen.{" "}
              <button
                type="button"
                className="underline"
                onClick={() =>
                  navigate({
                    to: "/workout/$exerciseId",
                    params: { exerciseId },
                    search: { ...search, mode: "manual" },
                  })
                }
              >
                Ohne Kamera manuell trainieren
              </button>
            </aside>
          )}

          <button
            onPointerDown={handleSurfaceTap}
            aria-label={isTapDriven ? "Antippen" : "Aktiv"}
            className="group relative mt-6 flex flex-1 select-none items-center justify-center overflow-hidden rounded-[2rem] border border-border bg-card/60 backdrop-blur active:bg-card transition-colors"
          >
            {useCamera && (
              <video
                ref={performanceLayout ? undefined : videoRef}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
                playsInline
                muted
              />
            )}

            {count === 0 && !active && !useCamera && (
              <>
                <span className="pointer-events-none absolute h-40 w-40 rounded-full bg-primary/20 animate-pulse-ring" />
                <span className="pointer-events-none absolute h-40 w-40 rounded-full bg-primary/10 animate-pulse-ring [animation-delay:0.7s]" />
              </>
            )}

            <div className="relative z-10 flex flex-col items-center gap-3 px-4 text-center">
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
                {isPushup ? `Liegestütze · ${modeLabel[pushMode]}` : exercise.name}
              </span>
              {countdown !== null && (
                <div className="rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
                  Los in {countdown}…
                </div>
              )}
              <span
                key={pop}
                className="font-display text-[9rem] leading-none font-bold tabular-nums text-foreground animate-count-pop"
                style={{ textShadow: "0 0 40px oklch(0.82 0.19 95 / 0.35)" }}
              >
                {count}
              </span>
              <span className="mt-2 max-w-[16rem] text-sm text-muted-foreground">
                {motivation ??
                  (useCamera
                    ? "Handy seitlich aufstellen: Der ganze Körper muss gut beleuchtet sichtbar sein. Die Erkennung kann Wiederholungen übersehen."
                    : !active && count === 0
                      ? cfg?.idleHint
                      : cfg?.activeHint)}
              </span>
              {motionError && <span className="text-xs text-destructive">{motionError}</span>}
              {useCamera && cameraError && (
                <span role="alert" className="text-xs text-destructive">
                  Kamera nicht verfügbar oder nicht freigegeben. Wähle „Ohne Kamera manuell
                  trainieren“ oder prüfe die Kameraberechtigung.
                </span>
              )}
              {useCamera && active && !cameraReady && !cameraError && (
                <span role="status" aria-live="polite" className="text-sm text-foreground">
                  {cameraStatus}
                </span>
              )}
              {useCamera && cameraReady && (
                <div className="flex flex-col items-center gap-1">
                  <span role="status" aria-live="polite" className="text-sm text-foreground">
                    Kameraerkennung · {cameraStatus}
                  </span>
                  {elbowAngle !== null && (
                    <div className="flex items-center gap-2">
                      {/* Arc indicator */}
                      <svg viewBox="0 0 48 28" className="h-7 w-12">
                        <path
                          d="M4 24 A20 20 0 0 1 44 24"
                          fill="none"
                          stroke="oklch(var(--color-secondary)/0.5)"
                          strokeWidth="4"
                          strokeLinecap="round"
                        />
                        <path
                          d="M4 24 A20 20 0 0 1 44 24"
                          fill="none"
                          stroke="oklch(var(--color-primary))"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray="62.8"
                          strokeDashoffset={62.8 * (1 - Math.min(1, elbowAngle / 180))}
                          className="transition-all duration-150"
                        />
                      </svg>
                      <span className="text-xs font-bold tabular-nums text-foreground">
                        {elbowAngle}°
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {elbowAngle >= 155 ? "▲ oben" : elbowAngle <= 85 ? "▼ unten" : "…"}
                      </span>
                    </div>
                  )}
                  {lastQuality && (
                    <span className="text-[11px] font-semibold text-foreground">
                      {"★".repeat(Math.round(lastQuality.grade))}
                      <span className="text-muted-foreground">
                        {"★".repeat(Math.max(0, 5 - Math.round(lastQuality.grade)))}
                      </span>
                      {!lastQuality.full && (
                        <span className="ml-1 text-muted-foreground">· halbe Wiederholung</span>
                      )}
                    </span>
                  )}
                  {liveCue && (
                    <span className="rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-[11px] font-semibold text-primary">
                      {liveCue}
                    </span>
                  )}
                  {formStats && (
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Technik {formStats.formScore.toFixed(1)} · {formStats.cleanReps} sauber
                    </span>
                  )}
                </div>
              )}
            </div>

            <Corner className="left-3 top-3" />
            <Corner className="right-3 top-3 rotate-90" />
            <Corner className="right-3 bottom-3 rotate-180" />
            <Corner className="left-3 bottom-3 -rotate-90" />
          </button>

          {!active &&
            count === 0 &&
            !isTapDriven &&
            countdown === null &&
            (!isPlanned || session?.phase === "preparation") && (
              <button
                onClick={start}
                className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98]"
              >
                Starten
              </button>
            )}

          {isPlanned && session && active && !awaitingRpe && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  decrement();
                  setSession((s) => (s ? undoWorkoutRep(s) : s));
                }}
                disabled={count <= 0}
                className="rounded-xl border border-border bg-secondary px-2 py-3 text-xs disabled:opacity-40"
              >
                Korrigieren −1
              </button>
              <button
                type="button"
                onClick={() => {
                  setActive(false);
                  setStartedAt(null);
                  setSession((s) => (s ? pauseWorkout(s) : s));
                }}
                className="rounded-xl border border-border bg-secondary px-2 py-3 text-xs"
              >
                Pausieren
              </button>
              <button
                type="button"
                onClick={() => {
                  setSession((s) => (s ? finishWorkoutSet(s, Date.now()) : s));
                  setActive(false);
                  setStartedAt(null);
                  observedCount.current = 0;
                  resetEngine();
                }}
                className="rounded-xl border border-border bg-secondary px-2 py-3 text-xs"
              >
                Satz abschließen
              </button>
            </div>
          )}
          {awaitingRpe && <RpePicker saving={saving} onPick={saveWithRpe} />}

          {!awaitingRpe &&
            (active ||
              count > 0 ||
              (isPlanned &&
                !!session &&
                ["rest", "paused", "completed"].includes(session.phase))) && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  onClick={resetAll}
                  className="alo-training-discard rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground transition hover:bg-secondary/80 active:scale-[0.98]"
                >
                  Verwerfen
                </button>
                <button
                  onClick={finish}
                  aria-describedby="counted-save-hint"
                  disabled={
                    saving ||
                    (isPlanned && session ? summarizeWorkout(session).actualReps <= 0 : count === 0)
                  }
                  className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"
                >
                  {saving
                    ? "Speichere…"
                    : isPlanned && session?.phase !== "completed"
                      ? "Teiltraining speichern"
                      : "Einheit speichern"}
                </button>
              </div>
            )}

          {summary && !active && (
            <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/10 p-4 text-left">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {summary.partial ? "Teiltraining gespeichert" : "Training abgeschlossen"}
              </div>
              <div className="mt-2 text-lg font-semibold text-foreground">
                {summary.count} {exercise.unit === "seconds" ? "Sekunden" : "Wiederholungen"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {summary.isBest ? "Neuer Bestwert" : "Gut gemacht"}
              </div>
              {summary.plannedSets !== undefined && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Plan: {summary.plannedSets} {summary.plannedSets === 1 ? "Satz" : "Sätze"}
                  {summary.plannedReps
                    ? ` · ${summary.plannedReps} ${workoutCountUnit(exercise.unit)} geplant`
                    : ""}{" "}
                  · Tatsächlich: {summary.actualSets ?? 0}{" "}
                  {(summary.actualSets ?? 0) === 1 ? "Satz" : "Sätze"} /{" "}
                  {summary.actualReps ?? summary.count} {workoutCountUnit(exercise.unit)} ·
                  Tatsächliche Dauer: {formatTime(summary.durationMs)} · Plandauer nicht vorgegeben
                  {summary.partial ? " · Teiltraining" : ""}
                </div>
              )}
              {summary.formScore != null && (
                <div className="mt-2 flex items-center justify-between rounded-xl bg-background/50 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">Technik-Note</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {summary.formScore.toFixed(1)} / 5 · {summary.cleanReps} sauber
                  </span>
                </div>
              )}
            </div>
          )}

          {isPlanned && (
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              Zusammenfassung und Teiltraining-Markierung werden nur auf diesem Gerät lokal
              zugeordnet.
            </p>
          )}
          <p className="mt-3 text-center text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            {savedHint ??
              (useCamera
                ? cameraError
                  ? "Kamera nicht verfügbar – ohne Kamera manuell trainieren"
                  : active
                    ? cameraReady
                      ? "Kameraerkennung bereit"
                      : "Kameraerkennung wird vorbereitet"
                    : "Starten · Kamera-Modus"
                : isTapDriven
                  ? "Tippe irgendwo auf die Fläche"
                  : active
                    ? "Erkennung aktiv"
                    : "Bereit zum Start")}
          </p>
        </main>
      </DesignView>
    </>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 px-3 py-3 backdrop-blur">
      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-1">
        <span className="break-words text-base font-semibold tabular-nums text-foreground sm:text-xl">
          {value}
        </span>
        {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

function Corner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`pointer-events-none absolute h-5 w-5 border-l-2 border-t-2 border-primary/70 ${className}`}
    />
  );
}

/** RPE-Abfrage (1–10) nach dem Satz — ein Tippen genügt, überspringbar. */
function RpePicker({ saving, onPick }: { saving: boolean; onPick: (rpe: number | null) => void }) {
  return (
    <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Wie schwer war das?
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        1 = sehr leicht · 10 = maximale Belastung
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
          <button
            key={v}
            type="button"
            disabled={saving}
            onClick={() => onPick(v)}
            className={`rounded-xl border py-2.5 text-sm font-semibold tabular-nums transition active:scale-95 disabled:opacity-50 ${
              v <= 3
                ? "border-green-500/30 bg-green-500/10 text-green-400"
                : v <= 6
                  ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                  : v <= 8
                    ? "border-orange-500/30 bg-orange-500/10 text-orange-400"
                    : "border-red-500/30 bg-red-500/10 text-red-400"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={() => onPick(null)}
        className="mt-2 w-full rounded-xl border border-border bg-secondary/60 px-4 py-2.5 text-xs font-medium text-muted-foreground transition active:scale-[0.98] disabled:opacity-50"
      >
        {saving ? "Speichere…" : "Ohne Angabe speichern"}
      </button>
    </div>
  );
}
