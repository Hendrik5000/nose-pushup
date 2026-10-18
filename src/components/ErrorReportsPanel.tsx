import { useMemo, useState } from "react";
import {
  clearFixedReports,
  exportErrorReportsJson,
  getErrorReports,
  markReportFixed,
  type ErrorReport,
} from "@/lib/error-reports";

export function ErrorReportsPanel() {
  const [tick, setTick] = useState(0);
  const reports = useMemo(() => getErrorReports(), [tick]);
  const open = reports.filter((r) => !r.fixed);

  const refresh = () => setTick((t) => t + 1);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(exportErrorReportsJson());
      alert("Fehlerberichte in die Zwischenablage kopiert — an Grok senden zum Auto-Fix.");
    } catch {
      alert("Kopieren fehlgeschlagen. Bitte manuell aus der Konsole lesen.");
    }
  };

  if (reports.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Keine gespeicherten Fehlerberichte.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {open.length} offen · {reports.length} gesamt
        </span>
        <button
          type="button"
          onClick={copyAll}
          className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          Alle kopieren (für Auto-Fix)
        </button>
        <button
          type="button"
          onClick={() => {
            clearFixedReports();
            refresh();
          }}
          className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"
        >
          Behobene löschen
        </button>
      </div>
      <ul className="max-h-72 space-y-2 overflow-y-auto">
        {reports.slice(0, 20).map((r) => (
          <ReportRow key={r.id} report={r} onChange={refresh} />
        ))}
      </ul>
    </div>
  );
}

function ReportRow({ report: r, onChange }: { report: ErrorReport; onChange: () => void }) {
  return (
    <li
      className={`rounded-xl border p-3 text-left text-xs ${
        r.fixed ? "border-border/50 opacity-50" : "border-destructive/40 bg-destructive/5"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-foreground">{r.message.slice(0, 160)}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            {new Date(r.ts).toLocaleString("de-DE")} · {r.source} · {r.route}
          </div>
          {r.stack && (
            <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-all text-[10px] text-muted-foreground">
              {r.stack.slice(0, 600)}
            </pre>
          )}
        </div>
        {!r.fixed && (
          <button
            type="button"
            onClick={() => {
              markReportFixed(r.id);
              onChange();
            }}
            className="shrink-0 rounded-full border border-border px-2 py-1 text-[10px]"
          >
            Behoben
          </button>
        )}
      </div>
    </li>
  );
}
