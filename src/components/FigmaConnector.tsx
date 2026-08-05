import { useEffect, useState } from "react";
import { fetchFigmaFileMeta, isFigmaConfigured } from "@/lib/figma";

type FigmaState = {
  loading: boolean;
  error: string | null;
  meta: {
    name: string;
    lastModified: string | null;
    thumbnailUrl: string | null;
    nodeCount: number;
    fileUrl: string;
  } | null;
};

export function FigmaConnector() {
  const [state, setState] = useState<FigmaState>({ loading: true, error: null, meta: null });

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        if (!isFigmaConfigured()) {
          if (!active) return;
          setState({ loading: false, error: null, meta: null });
          return;
        }

        const meta = await fetchFigmaFileMeta();
        if (!active) return;
        setState({ loading: false, error: null, meta });
      } catch (error) {
        if (!active) return;
        setState({ loading: false, error: error instanceof Error ? error.message : "Figma konnte nicht geladen werden", meta: null });
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Figma</div>
          <h2 className="mt-1 text-sm font-semibold">Design-Quelle verbinden</h2>
        </div>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
          {isFigmaConfigured() ? "aktiv" : "bereit"}
        </span>
      </div>

      {state.loading && <p className="mt-4 text-sm text-muted-foreground">Verbinde Figma…</p>}

      {!state.loading && !state.error && !state.meta && (
        <div className="mt-4 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Noch keine Figma-Konfiguration vorhanden. Trage Token und File-Key in den Umgebungsvariablen ein.
        </div>
      )}

      {!state.loading && state.error && (
        <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {!state.loading && state.meta && (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-border bg-background/50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{state.meta.name}</div>
                <div className="text-xs text-muted-foreground">
                  {state.meta.lastModified ? new Date(state.meta.lastModified).toLocaleString("de-DE") : "Keine Zeitangabe"}
                </div>
              </div>
              {state.meta.thumbnailUrl ? (
                <img src={state.meta.thumbnailUrl} alt="Figma Thumbnail" className="h-14 w-20 rounded-xl object-cover" />
              ) : null}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{state.meta.nodeCount} Haupt-Knoten</span>
              <a href={state.meta.fileUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary">
                Im Browser öffnen
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
