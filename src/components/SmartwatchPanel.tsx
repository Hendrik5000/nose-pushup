import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { localDateKey } from "@/lib/training-dates";
import {
  formatWatchImportResult,
  importWatchRows,
  syncWatchDay,
  type WatchSyncGateway,
} from "@/lib/smartwatch-sync";
import {
  formatRelativeSync,
  getWatchDevices,
  getWatchSnapshot,
  markWatchSynced,
  pairWatch,
  parseHealthJson,
  parseStepsCsv,
  saveWatchSnapshot,
  unpairWatch,
  WATCH_BRANDS,
  type WatchBrand,
  type WatchDevice,
} from "@/lib/smartwatch";

const watchSyncGateway: WatchSyncGateway = {
  getUserId: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user?.id ?? null;
  },
  getEntry: async (userId, day) => {
    const { data, error } = await supabase
      .from("health_entries")
      .select("steps, active_kcal, sleep_min, weight_kg")
      .eq("user_id", userId)
      .eq("day", day)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  upsert: async (payload) => {
    const { error } = await supabase
      .from("health_entries")
      .upsert(payload, { onConflict: "user_id,day" });
    if (error) throw error;
  },
};

export function SmartwatchPanel() {
  const [devices, setDevices] = useState<WatchDevice[]>(() => getWatchDevices());
  const [snapshot, setSnapshot] = useState(() => getWatchSnapshot());
  const [brand, setBrand] = useState<WatchBrand>("galaxy");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    setDevices(getWatchDevices());
    setSnapshot(getWatchSnapshot());
  };

  const onPair = () => {
    pairWatch(brand);
    setMsg(`${WATCH_BRANDS.find((b) => b.id === brand)?.label} gekoppelt`);
    refresh();
  };

  const syncToCloud = (
    day: string,
    fields: { steps?: number; activeKcal?: number; sleepMin?: number },
  ) => syncWatchDay(day, fields, watchSyncGateway);

  const onQuickSync = async () => {
    if (!devices[0]) {
      setMsg("Zuerst eine Uhr koppeln");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const day = snapshot?.day || localDateKey(new Date());
      const steps = snapshot?.steps ?? 0;
      const activeKcal = snapshot?.activeKcal ?? 0;
      const sleepMin = snapshot?.sleepMin ?? 0;
      if (steps || activeKcal || sleepMin) {
        await syncToCloud(day, { steps, activeKcal, sleepMin });
        markWatchSynced(devices[0].id);
        setMsg("Mit Cloud synchronisiert ✓");
      } else {
        setMsg("Keine Watch-Daten — Datei importieren oder manuell eintragen");
      }
    } catch {
      setMsg("Sync fehlgeschlagen. Verbindung prüfen und erneut versuchen.");
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const onFile = async (file: File) => {
    setBusy(true);
    setMsg(null);
    try {
      const text = await file.text();
      let importMessage: string;

      if (file.name.endsWith(".json") || text.trim().startsWith("{")) {
        const parsed = parseHealthJson(text);
        if (parsed && (parsed.steps || parsed.activeKcal || parsed.sleepMin)) {
          const day = parsed.day ?? localDateKey(new Date());
          const snap = {
            day,
            steps: parsed.steps ?? 0,
            activeKcal: parsed.activeKcal ?? 0,
            sleepMin: parsed.sleepMin ?? 0,
            restingHr: parsed.restingHr ?? null,
            source: "watch-import",
            deviceId: devices[0]?.id ?? null,
          };
          await syncToCloud(snap.day, {
            steps: snap.steps,
            activeKcal: snap.activeKcal,
            sleepMin: snap.sleepMin,
          });
          saveWatchSnapshot(snap);
          if (devices[0]) markWatchSynced(devices[0].id);
          importMessage = formatWatchImportResult({ imported: [{ day }], failed: [] });
        } else {
          importMessage = formatWatchImportResult({ imported: [], failed: [] });
        }
      } else {
        const rows = parseStepsCsv(text);
        const result = await importWatchRows(rows.slice(0, 31), (row) =>
          syncToCloud(row.day, { steps: row.steps }),
        );
        const firstImported = result.imported[0];
        if (firstImported) {
          saveWatchSnapshot({
            day: firstImported.day,
            steps: firstImported.steps,
            activeKcal: 0,
            sleepMin: 0,
            restingHr: null,
            source: "watch-csv",
            deviceId: devices[0]?.id ?? null,
          });
          if (devices[0]) markWatchSynced(devices[0].id);
        }
        importMessage = formatWatchImportResult(result);
      }

      setMsg(importMessage);
      refresh();
    } catch {
      setMsg(
        "Import konnte nicht bestätigt werden. Verbindung prüfen und Datei erneut importieren.",
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const primary = devices[0];
  const brandMeta = primary ? WATCH_BRANDS.find((b) => b.id === primary.brand) : null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-secondary/30 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Smartwatch
            </div>
            <div className="mt-1 text-base font-semibold text-foreground">
              {primary ? primary.name : "Keine Uhr gekoppelt"}
            </div>
            {primary && (
              <p className="mt-1 text-xs text-muted-foreground">
                Letzter Sync: {formatRelativeSync(primary.lastSyncAt)}
                {brandMeta ? ` · ${brandMeta.hint}` : ""}
              </p>
            )}
          </div>
          <span className="text-3xl leading-none" aria-hidden>
            ⌚
          </span>
        </div>

        {snapshot && (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Metric label="Schritte" value={snapshot.steps.toLocaleString("de-DE")} />
            <Metric label="kcal" value={String(snapshot.activeKcal)} />
            <Metric
              label="Schlaf"
              value={snapshot.sleepMin ? `${(snapshot.sleepMin / 60).toFixed(1)}h` : "—"}
            />
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Gerät koppeln
        </div>
        <div className="grid grid-cols-3 gap-2">
          {WATCH_BRANDS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBrand(b.id)}
              className={`rounded-xl border px-2 py-2 text-[11px] font-medium transition ${
                brand === b.id
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-secondary/40 text-muted-foreground"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onPair}
          className="mt-3 w-full rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary"
        >
          {primary ? "Gerät aktualisieren" : "Uhr koppeln"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onQuickSync}
          className="rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          Sync
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-sm font-semibold"
        >
          CSV / JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json,text/csv,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
      </div>

      {primary && (
        <button
          type="button"
          onClick={() => {
            unpairWatch(primary.id);
            setMsg("Entkoppelt");
            refresh();
          }}
          className="w-full text-center text-xs text-muted-foreground underline"
        >
          Uhr entfernen
        </button>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Web-Apps können Watch-Sensoren nicht direkt lesen. Koppeln merkt dein Gerät; Sync läuft über
        Health Connect / Export (CSV, JSON) oder manuelle Werte. Auf Android: Samsung Health oder
        Google Health → Health Connect freigeben, dann hier importieren.
      </p>

      {msg && (
        <p
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="text-xs text-muted-foreground"
        >
          {msg}
        </p>
      )}
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
