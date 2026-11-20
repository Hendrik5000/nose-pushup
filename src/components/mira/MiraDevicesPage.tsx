import { useMemo, useState } from "react";
import {
  clearEmergencyStop,
  coupleDevice,
  describeDeviceState,
  loadMiraDeviceStore,
  MIRA_DEVICE_CAPABILITIES,
  MIRA_PLATFORM_LABELS,
  pauseDevice,
  resumeDevice,
  revokeDevice,
  saveMiraDeviceStore,
  setDevicePermission,
  triggerEmergencyStop,
  type MiraDevice,
  type MiraDeviceCapability,
  type MiraDevicePlatform,
  type MiraDeviceState,
  type MiraDeviceStore,
  type MiraPermissionLevel,
} from "@/lib/mira-device-control";

const STATE_STYLES: Record<MiraDeviceState, string> = {
  "nicht-gekoppelt": "border-border text-muted-foreground bg-muted/40",
  "gekoppelt-offline": "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  verbunden: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  pausiert: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  fehler: "border-destructive/40 bg-destructive/10 text-destructive",
};

const PERMISSION_LEVELS: MiraPermissionLevel[] = ["keine", "lesen", "steuern", "kritisch"];

type Props = {
  userId?: string | null;
};

const EMPTY: MiraDeviceStore = { devices: [], activity: [], emergencyStopActive: false };

/**
 * Phase 1 (Device Control UI): Geraeteuebersicht, Detailansicht,
 * Berechtigungen, Not-Aus und Aktivitaetsprotokoll.
 *
 * Diese Ansicht ersetzt weder den Mira-Chat noch bestehende Mira-Funktionen.
 * Sie ist eine lokale Planungsvorschau ohne Datenbank und ohne echte
 * Fernsteuerung; gekoppelte Geraete werden bewusst als offline angezeigt.
 */
export function MiraDevicesPage({ userId }: Props) {
  const [store, setStore] = useState<MiraDeviceStore>(() =>
    typeof window === "undefined" || !("localStorage" in window)
      ? EMPTY
      : loadMiraDeviceStore(window.localStorage),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [platform, setPlatform] = useState<MiraDevicePlatform>("windows");
  const [confirmKill, setConfirmKill] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => store.devices.find((d) => d.id === selectedId) ?? null,
    [store.devices, selectedId],
  );

  const update = (next: MiraDeviceStore) => {
    setStore(next);
    if (typeof window !== "undefined" && "localStorage" in window) {
      saveMiraDeviceStore(next, window.localStorage);
    }
  };

  const devices = store.devices;
  const connectedCount = devices.filter((d) => d.state === "verbunden").length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Geräte</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gekoppelte Geräte, Berechtigungen und Not-Aus für Mira.
          </p>
        </div>
        <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground">
          {devices.length} {devices.length === 1 ? "Gerät" : "Geräte"} · {connectedCount} verbunden · Phase 1
        </span>
      </header>

      <p
        className="mt-4 rounded-2xl border border-border/70 bg-card/75 p-4 text-xs leading-relaxed text-muted-foreground"
      >
        <strong className="text-foreground">Status: Planungsvorschau.</strong> Nach dem
        Entwicklungsauftrag startet Device Control mit der Oberfläche. Es existiert noch kein Device
        Control Gateway und keine echte Geräteverbindung; gekoppelte Geräte werden deshalb bewusst als
        <em>gekoppelt (offline)</em> angezeigt und niemals als verbunden. Es werden keine Passwörter oder
        Geheimnisse gespeichert. Windows 11 ist die erste Plattform, Android und iPad folgen später.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
        >
          {error}
        </p>
      )}

      <section
        aria-labelledby="kill-switch-heading"
        className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/5 p-4"
      >
        <h2 id="kill-switch-heading" className="text-sm font-bold">
          Not-Aus
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Pausiert sofort alle Geräteverbindungen. Aktionen sind danach erst nach manueller Freigabe
          wieder möglich.
          {store.emergencyStopActive && " Not-Aus ist aktiv, alle Geräte sind pausiert."}
        </p>
        {confirmKill ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                update(triggerEmergencyStop(store));
                setConfirmKill(false);
              }}
              className="min-h-11 rounded-xl bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground"
            >
              Ja, alle Verbindungen pausieren
            </button>
            <button
              type="button"
              onClick={() => setConfirmKill(false)}
              className="min-h-11 rounded-xl border border-border px-4 py-2 text-sm"
            >
              Abbrechen
            </button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setConfirmKill(true)}
              className="min-h-11 rounded-xl bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground"
            >
              Not-Aus auslösen
            </button>
            {store.emergencyStopActive && (
              <button
                type="button"
                onClick={() => update(clearEmergencyStop(store))}
                className="min-h-11 rounded-xl border border-border px-4 py-2 text-sm"
              >
                Not-Aus zurücksetzen
              </button>
            )}
          </div>
        )}
      </section>

      <section
        aria-labelledby="couple-heading"
        className="mt-6 rounded-2xl border border-border/70 bg-card/75 p-4"
      >
        <h2 id="couple-heading" className="text-sm font-bold">
          Gerät koppeln
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Jedes Gerät muss aktiv durch dich gekoppelt werden. Der Kopplungscode ist ein lokaler
          Platzhalter für die spätere sichere Kopplung und gewährt keinen Zugriff.
        </p>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            try {
              const { store: next, device: coupled } = coupleDevice(store, deviceName, platform);
              update(next);
              setSelectedId(coupled.id);
              setDeviceName("");
              setError(null);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Kopplung fehlgeschlagen.");
            }
          }}
        >
          <label className="min-w-0 flex-1 text-xs font-medium">
            <span className="sr-only">Gerätename</span>
            <input
              value={deviceName}
              onChange={(event) => setDeviceName(event.currentTarget.value)}
              placeholder="z. B. Hendriks PC"
              aria-label="Gerätename"
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base"
            />
          </label>
          <label className="text-xs font-medium">
            <span className="sr-only">Plattform</span>
            <select
              value={platform}
              onChange={(event) => setPlatform(event.currentTarget.value as MiraDevicePlatform)}
              aria-label="Plattform"
              className="min-h-11 rounded-xl border border-border bg-background px-3 text-base"
            >
              {(Object.keys(MIRA_PLATFORM_LABELS) as MiraDevicePlatform[]).map((p) => (
                <option key={p} value={p}>
                  {MIRA_PLATFORM_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={deviceName.trim().length === 0}
            className="min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            Koppeln
          </button>
        </form>
      </section>

      <section aria-labelledby="overview-heading" className="mt-6">
        <h2 id="overview-heading" className="text-sm font-bold">
          Geräteübersicht
        </h2>
        {devices.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-border/70 p-4 text-xs text-muted-foreground">
            Noch kein Gerät gekoppelt. Sobald ein Gerät gekoppelt ist, erscheint es hier mit
            Verbindungsstatus und Berechtigungen.
          </p>
        ) : (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {devices.map((device) => (
              <li key={device.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(device.id)}
                  aria-pressed={selectedId === device.id}
                  className={
                    "min-h-11 w-full rounded-2xl border p-3 text-left transition " +
                    (
                      selectedId === device.id
                        ? "border-primary/60 bg-primary/5"
                        : "border-border/70 bg-card/75"
                    )
                  }
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{device.name}</span>
                    <span
                      className={
                        "rounded-full border px-2 py-0.5 text-[10px] " + STATE_STYLES[device.state]
                      }
                    >
                      {describeDeviceState(device.state)}
                    </span>
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {MIRA_PLATFORM_LABELS[device.platform]}
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
          onPermission={(capability, level) => {
            try {
              update(setDevicePermission(store, selected.id, capability, level));
              setError(null);
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Berechtigung konnte nicht geändert werden.",
              );
            }
          }}
          onPause={() => update(pauseDevice(store, selected.id))}
          onResume={() => update(resumeDevice(store, selected.id))}
          onRevoke={() => {
            update(revokeDevice(store, selected.id));
            setSelectedId(null);
          }}
        />
      )}

      <section
        aria-labelledby="activity-heading"
        className="mt-6 rounded-2xl border border-border/70 bg-card/75 p-4"
      >
        <h2 id="activity-heading" className="text-sm font-bold">
          Aktivitäten- und Ausführungsprotokoll
        </h2>
        {store.activity.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Noch keine Aktivitäten.</p>
        ) : (
          <ol className="mt-2 flex flex-col gap-1 text-xs">
            {store.activity.slice(0, 20).map((entry) => (
              <li key={entry.id} className="rounded-xl bg-muted/30 px-3 py-2">
                <span className="text-muted-foreground">
                  {new Date(entry.at).toLocaleString("de-DE")} · {entry.kind}
                </span>
                <span className="mt-0.5 block">{entry.message}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function DeviceDetail({
  device,
  onPermission,
  onPause,
  onResume,
  onRevoke,
}: {
  device: MiraDevice;
  onPermission: (capability: MiraDeviceCapability, level: MiraPermissionLevel) => void;
  onPause: () => void;
  onResume: () => void;
  onRevoke: () => void;
}) {
  return (
    <section
      aria-label={"Details zu " + device.name}
      className="mt-6 rounded-2xl border border-border/70 bg-card/75 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold">{device.name}</h2>
        <span
          className={"rounded-full border px-2 py-0.5 text-[10px] " + STATE_STYLES[device.state]}
        >
          {describeDeviceState(device.state)}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {MIRA_PLATFORM_LABELS[device.platform]}
        {device.coupledAt &&
          " · gekoppelt am " + new Date(device.coupledAt).toLocaleDateString("de-DE")}
        {device.couplingCode && " · lokaler Kopplungscode: " + device.couplingCode}
      </p>

      <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Berechtigungen pro Funktionsgruppe
      </h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-xs">
          <caption className="sr-only">
            Berechtigungsstufen pro Funktionsgruppe für {device.name}
          </caption>
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="py-1 font-medium">Funktionsgruppe</th>
              <th scope="col" className="py-1 font-medium">Stufe</th>
            </tr>
          </thead>
          <tbody>
            {MIRA_DEVICE_CAPABILITIES.map((cap) => (
              <tr key={cap.id} className="border-t border-border/50">
                <th scope="row" className="py-2 align-top font-medium">
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
                    {PERMISSION_LEVELS.map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => onPermission(cap.id, level)}
                        aria-pressed={device.permissions[cap.id] === level}
                        className={
                          "min-h-9 rounded-lg border px-2 text-[11px] transition " +
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
        Stufen: keine · lesen (Status anzeigen) · steuern (freigegebene Aktionen) · kritisch (nur
        nach ausdrücklicher Bestätigung). Kritische Aktionen wie Löschen, Installieren oder Versenden
        bleiben immer bestätigungspflichtig.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPause}
          disabled={device.state === "pausiert"}
          className="min-h-11 rounded-xl border border-border px-4 py-2 text-sm disabled:opacity-40"
        >
          Verbindung pausieren
        </button>
        <button
          type="button"
          onClick={onResume}
          disabled={device.state !== "pausiert"}
          className="min-h-11 rounded-xl border border-border px-4 py-2 text-sm disabled:opacity-40"
        >
          Fortsetzen (bleibt offline)
        </button>
        <button
          type="button"
          onClick={onRevoke}
          className="min-h-11 rounded-xl bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground"
        >
          Kopplung widerrufen
        </button>
      </div>
    </section>
  );
}
