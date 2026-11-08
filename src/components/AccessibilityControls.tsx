import { useEffect, useState } from "react";
import {
  applyAccessibilityPreferences,
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  readAccessibilityPreferences,
  saveAccessibilityPreferences,
  type AccessibilityPreferences,
  type TextScale,
} from "@/lib/accessibility-preferences";

const TEXT_SCALES: TextScale[] = [100, 110, 120];

export function AccessibilityControls({ userId }: { userId: string | null }) {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(
    DEFAULT_ACCESSIBILITY_PREFERENCES,
  );
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!userId) return;
    const loaded = readAccessibilityPreferences(userId);
    setPreferences(loaded);
    applyAccessibilityPreferences(loaded);
  }, [userId]);

  if (!userId) return null;

  const update = (patch: Partial<AccessibilityPreferences>) => {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    setStatus(
      saveAccessibilityPreferences(userId, next)
        ? "Auf diesem Gerät gespeichert."
        : "Browser-Speicher nicht verfügbar; Auswahl gilt vorübergehend.",
    );
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      <h3 className="text-sm font-semibold">Lesbarkeit & Training</h3>
      <fieldset className="mt-3">
        <legend className="text-xs font-medium text-muted-foreground">Textgröße</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {TEXT_SCALES.map((scale) => (
            <button
              key={scale}
              type="button"
              aria-pressed={preferences.textScale === scale}
              onClick={() => update({ textScale: scale })}
              className={`min-h-11 rounded-xl border px-2 text-sm font-semibold ${
                preferences.textScale === scale
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              {scale}%
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Browser-Zoom bleibt zusätzlich verfügbar.
        </p>
      </fieldset>

      <label className="mt-3 flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border/70 p-3">
        <span className="min-w-0">
          <span className="block text-sm font-medium">Zusätzlich weniger Bewegung</span>
          <span className="block text-[11px] text-muted-foreground">
            Reduziert App-Animationen; Geräteeinstellungen bleiben maßgeblich.
          </span>
        </span>
        <input
          type="checkbox"
          checked={preferences.reduceMotion}
          onChange={(event) => update({ reduceMotion: event.target.checked })}
          className="size-5 shrink-0 accent-primary"
        />
      </label>

      <label className="mt-2 flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border/70 p-3">
        <span className="min-w-0">
          <span className="block text-sm font-medium">Bildschirm beim Workout wach halten</span>
          <span className="block text-[11px] text-muted-foreground">
            Nur während einer aktiven Einheit und nur, wenn dein Browser es unterstützt.
          </span>
        </span>
        <input
          type="checkbox"
          checked={preferences.keepScreenAwake}
          onChange={(event) => update({ keepScreenAwake: event.target.checked })}
          className="size-5 shrink-0 accent-primary"
        />
      </label>
      <p className="mt-2 text-[11px] text-muted-foreground" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
