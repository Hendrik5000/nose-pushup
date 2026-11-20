import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  miraDeviceControlMutation,
  miraDeviceControlState,
} from "@/lib/mira-device-control.functions";
import {
  MIRA_DEVICE_CAPABILITIES,
  MIRA_PLATFORM_LABELS,
  type MiraDeviceCapability,
  type MiraDevicePlatform,
  type MiraPermissionLevel,
} from "@/lib/mira-device-control";
import type {
  MiraGatewayActivity,
  MiraGatewayDevice,
  MiraGatewaySnapshot,
} from "@/lib/mira-device-control.server";

const EMPTY_SNAPSHOT: MiraGatewaySnapshot = {
  configured: false,
  reachable: false,
  devices: [],
  activity: [],
  emergencyStopActive: false,
};

const LEVELS: MiraPermissionLevel[] = ["keine", "lesen", "steuern", "kritisch"];
const ACTIONS = [
  ["status.ping", "Verbindung prüfen"],
  ["status.info", "Gerätestatus"],
  ["programme.liste", "Programme auflisten"],
  ["programme.starten", "Programm starten"],
  ["programme.beenden", "Programm schließen"],
  ["fenster.liste", "Fenster auflisten"],
  ["fenster.fokussieren", "Fenster fokussieren"],
  ["fenster.minimieren", "Fenster minimieren"],
  ["fenster.maximieren", "Fenster maximieren"],
  ["eingabe.maus", "Maus steuern"],
  ["eingabe.tastatur", "Tastatur steuern"],
  ["dateien.auflisten", "Dateien auflisten"],
  ["dateien.lesen", "Textdatei lesen"],
  ["dateien.schreiben", "Neue Textdatei erstellen"],
  ["dateien.umbenennen", "Datei umbenennen"],
  ["dateien.verschieben", "Datei verschieben"],
  ["einstellungen.oeffnen", "Windows-Einstellungen öffnen"],
  ["einstellungen.herunterfahren", "Windows herunterfahren"],
  ["einstellungen.abbrechen-herunterfahren", "Herunterfahren abbrechen"],
  ["audio.lautstaerke", "Lautstärke ändern"],
  ["audio.stummschalten", "Stummschaltung umschalten"],
] as const;

const ACTION_EXAMPLES: Record<string, string> = {
  "status.ping": "{}",
  "status.info": "{}",
  "programme.liste": "{}",
  "programme.starten": '{ "app": "notepad" }',
  "programme.beenden": '{ "processId": 1234 }',
  "fenster.liste": "{}",
  "fenster.fokussieren": '{ "handle": "A1B2" }',
  "fenster.minimieren": '{ "handle": "A1B2" }',
  "fenster.maximieren": '{ "handle": "A1B2" }',
  "eingabe.maus": '{ "action": "click", "x": 500, "y": 300, "button": "left" }',
  "eingabe.tastatur": '{ "text": "Hallo" }',
  "dateien.auflisten": '{ "root": "Documents", "path": "" }',
  "dateien.lesen": '{ "root": "Documents", "path": "notiz.txt" }',
  "dateien.schreiben": '{ "root": "Documents", "path": "notiz.txt", "content": "Hallo" }',
  "dateien.umbenennen": '{ "root": "Documents", "path": "alt.txt", "newName": "neu.txt" }',
  "dateien.verschieben":
    '{ "sourceRoot": "Documents", "sourcePath": "alt.txt", "destinationRoot": "Downloads", "destinationPath": "alt.txt" }',
  "einstellungen.oeffnen": '{ "page": "display" }',
  "einstellungen.herunterfahren": "{}",
  "einstellungen.abbrechen-herunterfahren": "{}",
  "audio.lautstaerke": '{ "direction": "up", "steps": 2 }',
  "audio.stummschalten": "{}",
};

const CONFIRMATION_REQUIRED = new Set([
  "programme.beenden",
  "dateien.schreiben",
  "dateien.umbenennen",
  "dateien.verschieben",
  "einstellungen.herunterfahren",
]);

function deviceState(device: MiraGatewayDevice): string {
  return device.revokedAt ? "Widerrufen" : device.online ? "Verbunden" : "Gekoppelt · offline";
}

function deviceStateStyle(device: MiraGatewayDevice): string {
  if (device.revokedAt) return "border-destructive/40 bg-destructive/10 text-destructive";
  return device.online
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400";
}

function formatFingerprint(value: string): string {
  return (
    value
      .toUpperCase()
      .match(/.{1,4}/g)
      ?.join(" ") ?? value.toUpperCase()
  );
}

export function MiraDevicesPage() {
  const [snapshot, setSnapshot] = useState<MiraGatewaySnapshot>(EMPTY_SNAPSHOT);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [platform] = useState<MiraDevicePlatform>("windows");
  const [pairing, setPairing] = useState<{
    code: string;
    expiresAt: string;
    gatewayUrl: string;
    deviceName: string;
  } | null>(null);
  const [toolId, setToolId] = useState<string>("status.info");
  const [argsText, setArgsText] = useState(ACTION_EXAMPLES["status.info"]);
  const [confirmAction, setConfirmAction] = useState(false);
  const [confirmKill, setConfirmKill] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resultText, setResultText] = useState<string | null>(null);

  const loadState = useServerFn(miraDeviceControlState);
  const mutate = useServerFn(miraDeviceControlMutation);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadState();
      setSnapshot(next);
      setError(next.message ?? null);
      if (!selectedId && next.devices[0]) setSelectedId(next.devices[0].deviceId);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Gerätestatus konnte nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  }, [loadState, selectedId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = useMemo(
    () => snapshot.devices.find((device) => device.deviceId === selectedId) ?? null,
    [snapshot.devices, selectedId],
  );

  async function perform(data: Parameters<typeof mutate>[0]["data"]) {
    setBusy(true);
    setError(null);
    setResultText(null);
    try {
      const result = await mutate({ data });
      if (result.action === "pairing-code") {
        setPairing({
          code: result.code,
          expiresAt: result.expiresAt,
          gatewayUrl: snapshot.gatewayUrl ?? "",
          deviceName: result.deviceName,
        });
      } else if (result.action === "dispatch") {
        setResultText(
          typeof result.detail === "string"
            ? result.detail
            : result.dispatched === false
              ? String(result.reason ?? "Aktion blockiert.")
              : "Aktion an das Gerät gesendet.",
        );
      } else if (result.action === "screen") {
        setResultText(
          result.ok === true
            ? "Bildschirm-Sitzung gestartet."
            : "Bildschirm-Sitzung konnte nicht gestartet werden.",
        );
      } else {
        setResultText("Änderung wurde an das Gateway übermittelt.");
      }
      await refresh();
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Geräteaktion fehlgeschlagen.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function updatePermission(capability: MiraDeviceCapability, level: MiraPermissionLevel) {
    if (!selected) return;
    const permissions = { ...selected.permissions, [capability]: level };
    await perform({ action: "permissions", deviceId: selected.deviceId, permissions });
  }

  async function dispatchAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    try {
      const args = JSON.parse(argsText) as Record<string, unknown>;
      await perform({
        action: "dispatch",
        deviceId: selected.deviceId,
        toolId,
        args,
        confirmation: confirmAction,
      });
      setConfirmAction(false);
    } catch {
      setError("Die Argumente müssen gültiges JSON sein, z. B. " + ACTION_EXAMPLES[toolId]);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-24 pt-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Gerätesteuerung</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Windows-Geräte koppeln, Berechtigungen verwalten und Mira-Aktionen ausführen.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading || busy}
          className="min-h-10 rounded-xl border border-border px-3 text-xs font-semibold disabled:opacity-50"
        >
          {loading ? "Aktualisiere …" : "Status aktualisieren"}
        </button>
      </header>

      {!snapshot.configured ? (
        <section className="mt-5 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4">
          <h2 className="text-sm font-bold">Gateway noch nicht eingerichtet</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Die Oberfläche ist mit einem geschützten Server-Zwischendienst vorbereitet. Für echte
            Geräteverbindungen müssen <code>MIRA_DEVICE_GATEWAY_URL</code> und
            <code> MIRA_DEVICE_GATEWAY_ADMIN_TOKEN</code> als serverseitige Umgebungsvariablen
            gesetzt werden. Der Admin-Token wird niemals an den Browser übertragen.
          </p>
        </section>
      ) : !snapshot.reachable ? (
        <section className="mt-5 rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
          <h2 className="text-sm font-bold">Gateway nicht erreichbar</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {snapshot.message ?? "Verbindung fehlgeschlagen."}
          </p>
        </section>
      ) : (
        <section className="mt-5 rounded-2xl border border-border/70 bg-card/75 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold">Gateway verbunden</h2>
              <p className="mt-1 text-xs text-muted-foreground">{snapshot.gatewayUrl}</p>
            </div>
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-600 dark:text-emerald-400">
              {snapshot.devices.filter((device) => device.online).length} online ·{" "}
              {snapshot.devices.length} gekoppelt
            </span>
          </div>
        </section>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
        >
          {error}
        </p>
      )}
      {resultText && (
        <p role="status" className="mt-4 rounded-xl border border-border bg-muted/40 p-3 text-xs">
          {resultText}
        </p>
      )}

      <section className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
        <h2 className="text-sm font-bold">Not-Aus</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Stoppt freigegebene Aktionen auf deinen Geräten. Das Zurücksetzen des Not-Aus setzt Geräte
          nicht automatisch fort.
          {snapshot.emergencyStopActive && " Not-Aus ist aktiv."}
        </p>
        {snapshot.emergencyStopActive ? (
          <button
            type="button"
            disabled={busy || !snapshot.reachable}
            onClick={() =>
              void perform({ action: "not-aus", active: false, reason: "Manuell zurückgesetzt" })
            }
            className="mt-3 min-h-11 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-40"
          >
            Not-Aus zurücksetzen
          </button>
        ) : confirmKill ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !snapshot.reachable}
              onClick={() => {
                void perform({ action: "not-aus", active: true, reason: "Vom Nutzer ausgelöst" });
                setConfirmKill(false);
              }}
              className="min-h-11 rounded-xl bg-destructive px-4 text-sm font-semibold text-destructive-foreground disabled:opacity-40"
            >
              Ja, alle Geräte stoppen
            </button>
            <button
              type="button"
              onClick={() => setConfirmKill(false)}
              className="min-h-11 rounded-xl border border-border px-4 text-sm"
            >
              Abbrechen
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy || !snapshot.reachable}
            onClick={() => setConfirmKill(true)}
            className="mt-3 min-h-11 rounded-xl bg-destructive px-4 text-sm font-semibold text-destructive-foreground disabled:opacity-40"
          >
            Not-Aus auslösen
          </button>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-border/70 bg-card/75 p-4">
        <h2 className="text-sm font-bold">Windows-Gerät koppeln</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Erzeuge einen einmaligen sechsstelligen Code. Er ist fünf Minuten gültig und kann nur
          einmal verwendet werden.
        </p>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!deviceName.trim()) return;
            void perform({ action: "pairing-code", name: deviceName.trim(), platform });
          }}
        >
          <input
            value={deviceName}
            onChange={(event) => setDeviceName(event.currentTarget.value)}
            placeholder="Gerätename (z. B. Hendriks PC)"
            aria-label="Gerätename"
            maxLength={80}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
          />
          <button
            type="submit"
            disabled={busy || !snapshot.reachable || !deviceName.trim()}
            className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            Einmalcode erzeugen
          </button>
        </form>
        {pairing && (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs font-semibold">Kopplungscode für {pairing.deviceName}</p>
            <p className="mt-2 text-3xl font-bold tracking-[0.25em] tabular-nums">{pairing.code}</p>
            <p className="mt-2 break-all text-xs text-muted-foreground">
              Gateway-URL: {pairing.gatewayUrl}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Gültig bis {new Date(pairing.expiresAt).toLocaleTimeString("de-DE")}. Öffne den Mira
              Device Agent auf Windows, wähle „Kopplung starten“ und gib Gateway-URL sowie Code ein.
            </p>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(pairing.code);
              }}
              className="mt-2 min-h-9 rounded-lg border border-border px-3 text-xs font-semibold"
            >
              Code kopieren
            </button>
          </div>
        )}
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold">Geräteübersicht</h2>
          <span className="text-xs text-muted-foreground">{snapshot.devices.length} Geräte</span>
        </div>
        {snapshot.devices.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
            {snapshot.reachable
              ? "Noch kein Windows-Gerät gekoppelt."
              : "Geräte erscheinen hier, sobald das Gateway erreichbar ist."}
          </p>
        ) : (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {snapshot.devices.map((device) => (
              <li key={device.deviceId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(device.deviceId)}
                  aria-pressed={selectedId === device.deviceId}
                  className={
                    "min-h-16 w-full rounded-2xl border p-3 text-left transition " +
                    (selectedId === device.deviceId
                      ? "border-primary/60 bg-primary/5"
                      : "border-border/70 bg-card/75")
                  }
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{device.name}</span>
                    <span
                      className={
                        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] " +
                        deviceStateStyle(device)
                      }
                    >
                      {deviceState(device)}
                    </span>
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {MIRA_PLATFORM_LABELS[device.platform]} · Agent {device.agentVersion}
                  </span>
                  <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                    Fingerprint {formatFingerprint(device.fingerprint)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <DeviceDetail
          device={selected}
          busy={busy}
          onPermission={(capability, level) => void updatePermission(capability, level)}
          onRevoke={() => {
            if (!confirmRevoke) {
              setConfirmRevoke(true);
              return;
            }
            void perform({
              action: "revoke",
              deviceId: selected.deviceId,
              reason: "Vom Nutzer widerrufen",
            });
            setConfirmRevoke(false);
            setSelectedId(null);
          }}
          confirmRevoke={confirmRevoke}
          onCancelRevoke={() => setConfirmRevoke(false)}
        >
          <form
            onSubmit={dispatchAction}
            className="mt-5 rounded-xl border border-border/70 bg-muted/20 p-3"
          >
            <h3 className="text-xs font-bold">Mira-Steuerkonsole</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Wähle ein freigegebenes Werkzeug. Argumente werden serverseitig geprüft; keine Shell-
              oder PowerShell-Befehle.
            </p>
            <label className="mt-3 block text-xs font-medium">
              Aktion
              <select
                value={toolId}
                onChange={(event) => {
                  setToolId(event.currentTarget.value);
                  setArgsText(ACTION_EXAMPLES[event.currentTarget.value] ?? "{}");
                  setConfirmAction(false);
                }}
                className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3"
              >
                {ACTIONS.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-xs font-medium">
              Parameter (JSON)
              <textarea
                value={argsText}
                onChange={(event) => setArgsText(event.currentTarget.value)}
                rows={3}
                spellCheck={false}
                className="mt-1 w-full rounded-lg border border-border bg-background p-2 font-mono text-xs"
              />
            </label>
            {CONFIRMATION_REQUIRED.has(toolId) && (
              <label className="mt-3 flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={confirmAction}
                  onChange={(event) => setConfirmAction(event.currentTarget.checked)}
                />
                <span>
                  Ich bestätige diese Aktion ausdrücklich. Sie kann Programme schließen oder Dateien
                  verändern.
                </span>
              </label>
            )}
            <button
              type="submit"
              disabled={
                busy ||
                !snapshot.reachable ||
                !selected.online ||
                (CONFIRMATION_REQUIRED.has(toolId) && !confirmAction)
              }
              className="mt-3 min-h-10 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-40"
            >
              Aktion ausführen
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !snapshot.reachable || !selected.online}
              onClick={() =>
                void perform({ action: "screen", deviceId: selected.deviceId, active: true })
              }
              className="min-h-10 rounded-lg border border-border px-3 text-xs disabled:opacity-40"
            >
              Bildschirmfreigabe starten
            </button>
            <button
              type="button"
              disabled={busy || !snapshot.reachable}
              onClick={() =>
                void perform({ action: "screen", deviceId: selected.deviceId, active: false })
              }
              className="min-h-10 rounded-lg border border-border px-3 text-xs disabled:opacity-40"
            >
              Bildschirmfreigabe beenden
            </button>
          </div>
        </DeviceDetail>
      )}

      <section className="mt-6 rounded-2xl border border-border/70 bg-card/75 p-4">
        <h2 className="text-sm font-bold">Aktivitätsprotokoll</h2>
        {snapshot.activity.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Noch keine Gateway-Aktivitäten.</p>
        ) : (
          <ol className="mt-2 flex flex-col gap-1 text-xs">
            {snapshot.activity.slice(0, 30).map((entry) => (
              <ActivityRow key={entry.id} entry={entry} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function DeviceDetail({
  device,
  busy,
  onPermission,
  onRevoke,
  confirmRevoke,
  onCancelRevoke,
  children,
}: {
  device: MiraGatewayDevice;
  busy: boolean;
  onPermission: (capability: MiraDeviceCapability, level: MiraPermissionLevel) => void;
  onRevoke: () => void;
  confirmRevoke: boolean;
  onCancelRevoke: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={"Details zu " + device.name}
      className="mt-6 rounded-2xl border border-border/70 bg-card/75 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold">{device.name}</h2>
        <span className={"rounded-full border px-2 py-0.5 text-[10px] " + deviceStateStyle(device)}>
          {deviceState(device)}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {MIRA_PLATFORM_LABELS[device.platform]} · Agent {device.agentVersion} · gekoppelt am{" "}
        {new Date(device.createdAt).toLocaleString("de-DE")}
      </p>
      <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
        Geräte-Fingerprint: {formatFingerprint(device.fingerprint)}
      </p>

      <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Berechtigungen
      </h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="py-1 font-medium">Funktionsgruppe</th>
              <th className="py-1 font-medium">Stufe</th>
            </tr>
          </thead>
          <tbody>
            {MIRA_DEVICE_CAPABILITIES.map((cap) => (
              <tr key={cap.id} className="border-t border-border/50">
                <th className="py-2 align-top font-medium">
                  {cap.label}
                  <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                    {cap.hint}
                  </span>
                </th>
                <td className="py-2">
                  <div
                    role="group"
                    aria-label={"Berechtigungsstufe für " + cap.label}
                    className="flex flex-wrap gap-1"
                  >
                    {LEVELS.map((level) => (
                      <button
                        key={level}
                        type="button"
                        disabled={busy || !device.online}
                        onClick={() => onPermission(cap.id, level)}
                        aria-pressed={device.permissions[cap.id] === level}
                        className={
                          "min-h-9 rounded-lg border px-2 text-[11px] transition disabled:opacity-40 " +
                          (device.permissions[cap.id] === level
                            ? "border-primary bg-primary/10 font-semibold"
                            : "border-border")
                        }
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        „Kritisch“ hebt die zusätzliche Bestätigung im Mira-Server nicht auf. Shell- und
        PowerShell-Ausführung bleiben gesperrt.
      </p>
      {children}
      <div className="mt-4 flex flex-wrap gap-2">
        {confirmRevoke ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onRevoke}
              className="min-h-10 rounded-lg bg-destructive px-3 text-xs font-semibold text-destructive-foreground disabled:opacity-40"
            >
              Kopplung endgültig widerrufen
            </button>
            <button
              type="button"
              onClick={onCancelRevoke}
              className="min-h-10 rounded-lg border border-border px-3 text-xs"
            >
              Abbrechen
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={onRevoke}
            className="min-h-10 rounded-lg border border-destructive/40 px-3 text-xs text-destructive disabled:opacity-40"
          >
            Gerät widerrufen
          </button>
        )}
      </div>
    </section>
  );
}

function ActivityRow({ entry }: { entry: MiraGatewayActivity }) {
  return (
    <li className="rounded-xl bg-muted/30 px-3 py-2">
      <span className="text-muted-foreground">
        {new Date(entry.at).toLocaleString("de-DE")} · {entry.kind}
        {entry.status ? " · " + entry.status : ""}
      </span>
      <span className="mt-0.5 block break-words">
        {[entry.toolId, entry.detail].filter(Boolean).join(" — ") ||
          entry.deviceId ||
          "Gateway-Ereignis"}
      </span>
    </li>
  );
}
