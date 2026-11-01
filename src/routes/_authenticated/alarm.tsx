import { createFileRoute } from "@tanstack/react-router";
import { AlarmClock, Check, Clock3, Volume2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AloHomeLink } from "@/components/AloHomeLink";
import {
  DEFAULT_ALARM_SETTINGS,
  getNextAlarmDate,
  readAlarmSettings,
  saveAlarmSettings,
  type AlarmSettings,
} from "@/lib/alarm";
import { previewAlarmSound, primeAlarmAudio } from "@/lib/alarm-sound";
import { getAloOwner } from "@/lib/alo-store";

export const Route = createFileRoute("/_authenticated/alarm")({
  head: () => ({
    meta: [
      { title: "Wecker — Alo" },
      {
        name: "description",
        content: "Stelle deinen täglichen Alo-Wecker mit sanft ansteigendem Weckton ein.",
      },
    ],
  }),
  component: AlarmPage,
});

function AlarmPage() {
  const userId = getAloOwner() ?? "";
  const [settings, setSettings] = useState<AlarmSettings>({ ...DEFAULT_ALARM_SETTINGS });
  const [time, setTime] = useState(DEFAULT_ALARM_SETTINGS.time);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const stopPreviewRef = useRef<(() => void) | null>(null);
  const previewUiTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    const load = () => {
      const saved = readAlarmSettings(userId);
      setSettings(saved);
      setTime(saved.time);
      setEnabled(saved.enabled);
    };
    load();
    window.addEventListener("alo-alarm-settings-changed", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("alo-alarm-settings-changed", load);
      window.removeEventListener("storage", load);
    };
  }, [userId]);

  useEffect(
    () => () => {
      stopPreviewRef.current?.();
      if (previewUiTimer.current !== null) window.clearTimeout(previewUiTimer.current);
    },
    [],
  );

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    if (!userId) {
      setMessage("Bitte melde dich erneut an, um deinen Wecker zu speichern.");
      return;
    }
    const next: AlarmSettings = {
      ...settings,
      time,
      enabled,
      snoozeUntil: undefined,
    };
    if (enabled) void primeAlarmAudio();
    try {
      saveAlarmSettings(userId, next);
      setSettings(next);
      setMessage(
        enabled ? "Wecker gespeichert und eingeschaltet." : "Wecker gespeichert und ausgeschaltet.",
      );
    } catch {
      setMessage(
        "Der Wecker konnte nicht gespeichert werden. Bitte prüfe den Speicherplatz deines Browsers.",
      );
    }
  };

  const togglePreview = async () => {
    if (previewing) {
      stopPreviewRef.current?.();
      stopPreviewRef.current = null;
      if (previewUiTimer.current !== null) window.clearTimeout(previewUiTimer.current);
      previewUiTimer.current = null;
      setPreviewing(false);
      return;
    }
    try {
      setMessage("");
      setPreviewing(true);
      const stop = await previewAlarmSound(9_000);
      if (!stop) {
        setPreviewing(false);
        setMessage(
          "Dieser Browser unterstützt die Weckton-Wiedergabe nicht oder blockiert sie gerade.",
        );
        return;
      }
      stopPreviewRef.current = stop;
      previewUiTimer.current = window.setTimeout(() => {
        stopPreviewRef.current = null;
        previewUiTimer.current = null;
        setPreviewing(false);
      }, 9_000);
    } catch {
      setPreviewing(false);
      setMessage(
        "Der Ton konnte nicht gestartet werden. Prüfe die Lautstärke und erlaube Alo die Audiowiedergabe.",
      );
    }
  };

  const nextAlarm = enabled ? getNextAlarmDate(time) : null;
  const nextAlarmLabel = nextAlarm
    ? nextAlarm.toLocaleString("de-DE", {
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "ausgeschaltet";

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col gap-5 px-4 pt-5 pb-28 sm:px-7 sm:pt-8">
      <header className="space-y-5">
        <div className="flex items-center justify-between">
          <AloHomeLink className="px-2 text-[10px]" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Funktion 10
          </span>
        </div>
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <AlarmClock className="h-4 w-4" aria-hidden="true" /> Dein Alltag
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Dein sanfter Wecker
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Stell deine tägliche Weckzeit ein. Ein heller, sanft ansteigender Ton wird nach und nach
            präsenter, damit du angenehm und zuverlässig wach wirst.
          </p>
        </div>
      </header>

      <section
        className="rounded-3xl border border-border bg-card/70 p-5 shadow-sm backdrop-blur sm:p-7"
        aria-labelledby="alarm-settings-title"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
            <Clock3 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="alarm-settings-title" className="text-lg font-bold">
              Wann soll Alo klingeln?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Der Wecker wiederholt sich täglich, bis du ihn ausschaltest.
            </p>
          </div>
        </div>

        <form onSubmit={save} className="mt-6 space-y-5">
          <label className="block max-w-xs space-y-2">
            <span className="text-sm font-semibold">Uhrzeit</span>
            <input
              type="time"
              required
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className="min-h-14 w-full rounded-2xl border border-border bg-background px-4 text-2xl font-semibold tabular-nums text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            />
          </label>

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background/50 p-4">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="h-5 w-5 accent-primary"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Wecker einschalten</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {enabled
                  ? `Nächster Alarm: ${nextAlarmLabel}`
                  : "Deine Uhrzeit bleibt gespeichert, der Alarm ist aber aus."}
              </span>
            </span>
          </label>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              className="alo-btn inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
            >
              <Check className="h-4 w-4" aria-hidden="true" /> Wecker speichern
            </button>
            <button
              type="button"
              onClick={() => void togglePreview()}
              className="alo-btn inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-semibold text-foreground"
            >
              <Volume2 className="h-4 w-4" aria-hidden="true" />{" "}
              {previewing ? "Tonprobe stoppen" : "Ton testen (9 Sek.)"}
            </button>
          </div>
          <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
            {message}
          </p>
        </form>
      </section>

      <aside className="rounded-2xl border border-border/70 bg-secondary/40 p-4 text-sm leading-6 text-muted-foreground">
        <p className="font-semibold text-foreground">Wichtig zum Browser-Wecker</p>
        <p className="mt-1">
          Der Alarm läuft, solange Alo geöffnet und vom Browser nicht angehalten ist. Ein Browser
          kann nicht zuverlässig klingeln, wenn die App geschlossen, im Hintergrund ausgesetzt oder
          das Gerät im Ruhemodus ist; Ton und Vibration hängen außerdem von Browser, Gerät und
          Lautstärke ab. Teste den Ton vor dem ersten Einsatz bei entsperrtem Gerät. Die Weckzeit
          wird nur auf diesem Gerät und für dein Alo-Konto gespeichert.
        </p>
      </aside>
    </main>
  );
}
