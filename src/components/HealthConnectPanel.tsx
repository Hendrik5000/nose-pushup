import { useEffect, useState } from "react";
import { formatRelativeSync } from "@/lib/smartwatch";
import {
  getHcAutoSync,
  getHcCachedSummary,
  getHealthConnectStatus,
  openHealthConnectApp,
  openHealthConnectPlayStore,
  requestHealthConnectPermissions,
  saveManualAsHealthConnect,
  setHcAutoSync,
  syncHealthConnect,
  type HealthConnectSummary,
} from "@/lib/health-connect";

export function HealthConnectPanel() {
  const [status, setStatus] = useState(() => getHealthConnectStatus());
  const [summary, setSummary] = useState<HealthConnectSummary | null>(() => getHcCachedSummary());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Quick form when no bridge
  const [steps, setSteps] = useState("");
  const [kcal, setKcal] = useState("");
  const [sleepH, setSleepH] = useState("");

  const refresh = () => {
    setStatus(getHealthConnectStatus());
    setSummary(getHcCachedSummary());
  };

  useEffect(() => {
    if (!getHcAutoSync()) return;
    void (async () => {
      const res = await syncHealthConnect();
      if (res.ok && res.summary) {
        setSummary(res.summary);
        setMsg(res.message);
        refresh();
      }
    })();
  }, []);

  const onPermissions = async () => {
    setBusy(true);
    setMsg(null);
    const res = await requestHealthConnectPermissions();
    setMsg(
      res.via === "app"
        ? "Health Connect geöffnet. Nach der Freigabe kannst du Werte hier manuell übernehmen."
        : res.message.includes("Bridge")
          ? "Die Verbindung zu Health Connect ist fehlgeschlagen. Bitte prüfe die Freigabe."
          : res.message,
    );
    setBusy(false);
    refresh();
  };

  const onSync = async () => {
    setBusy(true);
    setMsg(null);
    const res = await syncHealthConnect();
    if (res.summary) setSummary(res.summary);
    setMsg(
      res.ok && res.summary
        ? `Health Connect aktualisiert: ${res.summary.steps.toLocaleString("de-DE")} Schritte.`
        : res.message.includes("Bridge")
          ? "Automatischer Abruf nicht verfügbar. Werte bitte manuell übernehmen."
          : res.message,
    );
    setBusy(false);
    refresh();
  };

  const onManualSave = async () => {
    const s = parseInt(steps || "0", 10);
    if (!s && !kcal && !sleepH) {
      setMsg("Mindestens Schritte, kcal oder Schlaf eingeben");
      return;
    }
    setBusy(true);
    setMsg(null);
    const { error, summary: saved } = await saveManualAsHealthConnect({
      steps: s || 0,
      activeKcal: parseInt(kcal || "0", 10) || 0,
      sleepHours: parseFloat(sleepH || "0") || 0,
    });
    setBusy(false);
    if (error) setMsg(error);
    else {
      setSummary(saved);
      setMsg("Gesundheitswerte gespeichert ✓");
      setSteps("");
      setKcal("");
      setSleepH("");
      refresh();
    }
  };

  const toggleAuto = () => {
    const next = !status.autoSync;
    setHcAutoSync(next);
    refresh();
    setMsg(
      next
        ? "Automatische Aktualisierung beim Öffnen aktiviert."
        : "Automatische Aktualisierung deaktiviert.",
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-secondary/30 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Google Health Connect
            </div>
            <div className="mt-1 text-base font-semibold text-foreground">
              {status.hasBridge
                ? "Verbindung verfügbar"
                : status.isAndroid
                  ? "Manuelle Übernahme"
                  : "Manuell erfassen"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Letzte Aktualisierung: {formatRelativeSync(status.lastSyncAt)}
              {status.hasBridge ? "" : " · kein automatischer Abruf"}
            </p>
          </div>
          <span className="text-3xl leading-none" aria-hidden>
            💚
          </span>
        </div>

        {summary && (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Metric label="Schritte" value={summary.steps.toLocaleString("de-DE")} />
            <Metric label="kcal" value={String(summary.activeKcal)} />
            <Metric
              label="Schlaf"
              value={summary.sleepMin ? `${(summary.sleepMin / 60).toFixed(1)}h` : "—"}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onPermissions}
          className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm font-semibold text-primary disabled:opacity-60"
        >
          Zugriff einrichten
        </button>
        {status.hasBridge && (
          <button
            type="button"
            disabled={busy}
            onClick={onSync}
            className="rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "…" : "Jetzt aktualisieren"}
          </button>
        )}
        <button
          type="button"
          onClick={openHealthConnectApp}
          className="rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-sm font-semibold"
        >
          Health Connect öffnen
        </button>
        <button
          type="button"
          onClick={openHealthConnectPlayStore}
          className="rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-sm font-semibold"
        >
          Play Store
        </button>
      </div>

      {status.hasBridge && (
        <button
          type="button"
          onClick={toggleAuto}
          className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-sm ${
            status.autoSync
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border bg-secondary/40 text-muted-foreground"
          }`}
        >
          <span>Beim Öffnen automatisch abrufen</span>
          <span className="text-xs font-semibold">{status.autoSync ? "AN" : "AUS"}</span>
        </button>
      )}

      {!status.hasBridge && (
        <div className="rounded-2xl border border-border bg-background/40 p-3">
          <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Werte manuell übernehmen
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              inputMode="numeric"
              placeholder="Schritte"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              className="rounded-xl border border-border bg-background/60 px-2 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              type="number"
              inputMode="numeric"
              placeholder="kcal"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              className="rounded-xl border border-border bg-background/60 px-2 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              type="number"
              inputMode="decimal"
              placeholder="Schlaf h"
              value={sleepH}
              onChange={(e) => setSleepH(e.target.value)}
              className="rounded-xl border border-border bg-background/60 px-2 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onManualSave}
            className="mt-2 w-full rounded-xl border border-border px-3 py-2 text-sm font-medium disabled:opacity-60"
          >
            Werte speichern
          </button>
        </div>
      )}

      {!status.hasBridge && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Ohne Android-App-Verbindung werden Werte nicht automatisch aus Health Connect übernommen.
          Trage sie hier ein und speichere sie selbst.
        </p>
      )}
      <details className="rounded-xl border border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">
          Technische Hinweise zur Verbindung
        </summary>
        <p className="mt-2 leading-relaxed">
          Automatischer Abruf setzt eine Android-App mit Health-Connect-Integration voraus; ohne
          diese Integration ist nur die manuelle Übernahme möglich. Die Integration liest über eine
          native Bridge (<code>window.NosePushHealthConnect</code>) und kann beim Öffnen dieser
          Ansicht aktualisieren, wenn die Option aktiviert ist. Im Browser allein ist kein
          automatischer Abruf möglich.
        </p>
      </details>

      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/80 bg-background/40 px-2 py-2">
      <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
