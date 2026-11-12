import { useEffect, useMemo, useState } from "react";
import {
  buildTrainingStudioInsights,
  DEFAULT_TRAINING_STUDIO_GOALS,
  loadTrainingStudioGoals,
  normalizeTrainingStudioGoals,
  saveTrainingStudioGoals,
  trainingStudioGroups,
  type TrainingStudioGoals,
} from "@/lib/training-studio";
import { historyExercise, type HistoryWorkout } from "@/lib/workout-history";

const copyGoals = (goals: TrainingStudioGoals): TrainingStudioGoals => ({ ...goals });

function readGoals(userId: string): TrainingStudioGoals {
  try {
    return loadTrainingStudioGoals(window.localStorage, userId);
  } catch {
    return copyGoals(DEFAULT_TRAINING_STUDIO_GOALS);
  }
}

export function TrainingStudio({
  userId,
  rows,
  rangeDays,
}: {
  userId: string;
  rows: readonly HistoryWorkout[];
  rangeDays: number;
}) {
  const [saved, setSaved] = useState({ userId, goals: copyGoals(DEFAULT_TRAINING_STUDIO_GOALS) });
  const [draftState, setDraftState] = useState({
    userId,
    goals: copyGoals(DEFAULT_TRAINING_STUDIO_GOALS),
  });
  const [loadedUserId, setLoadedUserId] = useState("");
  const [status, setStatus] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    const goals = readGoals(userId);
    setSaved({ userId, goals });
    setDraftState({ userId, goals: copyGoals(goals) });
    setLoadedUserId(userId);
    setStatus("");
    setCopyStatus("");
  }, [userId]);

  const goals = saved.userId === userId ? saved.goals : copyGoals(DEFAULT_TRAINING_STUDIO_GOALS);
  const draft = draftState.userId === userId ? draftState.goals : goals;
  const goalsReady =
    Boolean(userId) &&
    loadedUserId === userId &&
    saved.userId === userId &&
    draftState.userId === userId;
  const insights = useMemo(
    () => buildTrainingStudioInsights(rows, rangeDays, goals),
    [rows, rangeDays, goals],
  );
  const groups = useMemo(() => trainingStudioGroups(insights), [insights]);
  const exerciseOptions = useMemo(() => {
    const ids = new Set(rows.map((row) => row.exercise_id).filter(Boolean));
    ids.add(goals.focusExerciseId);
    return [...ids]
      .sort((a, b) => historyExercise(a).name.localeCompare(historyExercise(b).name, "de"))
      .map((id) => ({ id, name: historyExercise(id).name }));
  }, [rows, goals.focusExerciseId]);

  const updateDraft = (patch: Partial<TrainingStudioGoals>) => {
    if (!goalsReady) return;
    setDraftState((current) => ({
      userId,
      goals: normalizeTrainingStudioGoals({
        ...(current.userId === userId ? current.goals : goals),
        ...patch,
      }),
    }));
    setStatus("");
  };

  const save = () => {
    if (!goalsReady) return;
    const next = normalizeTrainingStudioGoals(draft);
    setSaved({ userId, goals: next });
    setDraftState({ userId, goals: copyGoals(next) });
    let ok = false;
    try {
      ok = saveTrainingStudioGoals(window.localStorage, userId, next);
    } catch {
      ok = false;
    }
    setStatus(
      ok
        ? "Ziele wurden nur auf diesem Gerät für dein Konto gespeichert."
        : "Lokales Speichern ist nicht verfügbar; die Ziele gelten vorerst nur in dieser Sitzung.",
    );
  };

  const copySummary = async () => {
    const summary = insights.find((item) => item.id === "studio-50");
    try {
      if (!summary || !navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(`${summary.label}: ${summary.value}. ${summary.detail}`);
      setCopyStatus("Zusammenfassung kopiert.");
    } catch {
      setCopyStatus("Kopieren ist in diesem Browser nicht verfügbar.");
    }
  };

  return (
    <details className="rounded-2xl border border-border/70 bg-background/40 p-3">
      <summary className="flex min-h-11 cursor-pointer select-none items-center text-sm font-semibold">
        Trainingsstudio · 50 persönliche Insights
      </summary>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Fünf kompakte Bereiche statt zusätzlicher Kacheln. Kennzahlen nutzen den bereits geladenen
        Verlauf; deine Ziele bleiben lokal auf diesem Gerät und werden nicht in die Datenbank
        geschrieben.
      </p>
      <div className="mt-3 space-y-2">
        {groups.map((group) => (
          <details
            key={group.id}
            className="rounded-xl border border-border/60 bg-card/50 px-3 py-2"
          >
            <summary className="flex min-h-11 cursor-pointer items-center text-xs font-semibold">
              {group.label}{" "}
              <span className="font-normal text-muted-foreground">· {group.insights.length}</span>
            </summary>
            <dl className="mt-2 divide-y divide-border/50">
              {group.insights.map((item) => (
                <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-2">
                  <dt className="text-xs font-medium">{item.label}</dt>
                  <dd className="text-right text-xs font-semibold tabular-nums">{item.value}</dd>
                  <dd className="col-span-2 mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    {item.detail}
                  </dd>
                </div>
              ))}
            </dl>
            {group.id === "coaching" && (
              <div className="mt-3 border-t border-border/50 pt-3">
                <button
                  type="button"
                  onClick={() => void copySummary()}
                  className="min-h-11 rounded-xl border border-border px-3 text-xs font-medium"
                >
                  Kurzzusammenfassung kopieren
                </button>
                {copyStatus && (
                  <p role="status" className="mt-2 text-xs text-muted-foreground">
                    {copyStatus}
                  </p>
                )}
              </div>
            )}
            {group.id === "ziele" && (
              <fieldset
                disabled={!goalsReady}
                className="mt-3 rounded-xl border border-border/60 p-3"
              >
                <legend className="px-1 text-xs font-semibold">Deine lokalen Ziele</legend>
                {!goalsReady && (
                  <p role="status" className="mb-2 text-xs text-muted-foreground">
                    Lokale Ziele werden geladen …
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs">
                    Trainingstage pro Woche
                    <input
                      type="number"
                      min={1}
                      max={7}
                      step={1}
                      value={draft.weeklySessionTarget}
                      onChange={(event) =>
                        updateDraft({ weeklySessionTarget: event.currentTarget.valueAsNumber })
                      }
                      className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm"
                    />
                  </label>
                  <label className="grid gap-1 text-xs">
                    Fokus-Übung
                    <select
                      value={draft.focusExerciseId}
                      onChange={(event) =>
                        updateDraft({ focusExerciseId: event.currentTarget.value })
                      }
                      className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm"
                    >
                      {exerciseOptions.map((exercise) => (
                        <option key={exercise.id} value={exercise.id}>
                          {exercise.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs">
                    Ziel-Bestwert (
                    {historyExercise(draft.focusExerciseId).unit === "seconds"
                      ? "Sekunden"
                      : historyExercise(draft.focusExerciseId).unit === "reps"
                        ? "Wiederholungen"
                        : "Einheiten"}
                    )
                    <input
                      type="number"
                      min={1}
                      max={1_000_000}
                      step={1}
                      value={draft.focusBestTarget}
                      onChange={(event) =>
                        updateDraft({ focusBestTarget: event.currentTarget.valueAsNumber })
                      }
                      className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm"
                    />
                  </label>
                  <label className="grid gap-1 text-xs">
                    Optionales Zieldatum
                    <input
                      type="date"
                      value={draft.targetDate}
                      onChange={(event) => updateDraft({ targetDate: event.currentTarget.value })}
                      className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm"
                    />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={save}
                    className="min-h-11 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground"
                  >
                    Ziele lokal speichern
                  </button>
                </div>
                {goalsReady && status && (
                  <p role="status" className="mt-2 text-xs text-muted-foreground">
                    {status}
                  </p>
                )}
              </fieldset>
            )}
          </details>
        ))}
      </div>
    </details>
  );
}
