import { SportSectionLabel } from "@/components/SportPageIntro";
import { useEffect, useState, type DragEvent, type ReactNode } from "react";
import {
  loadLayout,
  nextSize,
  resetLayout,
  saveLayout,
  sizeLabel,
  sizeClass,
  widgetMeta,
  WIDGET_CATALOG,
  type LayoutItem,
  type WidgetId,
  type WidgetSize,
} from "@/lib/dashboard-layout";

export function DashboardGrid({
  renderWidget,
}: {
  renderWidget: (id: WidgetId, size: WidgetSize) => ReactNode;
}) {
  const [loadedLayout, setLayout] = useState<LayoutItem[] | null>(null);
  const layout = loadedLayout ?? [];
  const [editing, setEditing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dragId, setDragId] = useState<WidgetId | null>(null);

  // Server and first client render match. Never persist defaults during hydration.
  useEffect(() => {
    setLayout(loadLayout());
  }, []);

  const commit = (next: LayoutItem[]) => {
    setLayout(next);
    saveLayout(next);
  };

  const move = (id: WidgetId, dir: -1 | 1) => {
    const idx = layout.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= layout.length) return;
    const next = [...layout];
    const tmp = next[idx]!;
    next[idx] = next[j]!;
    next[j] = tmp;
    commit(next);
  };

  const resize = (id: WidgetId) => {
    commit(layout.map((x) => (x.id === id ? { ...x, size: nextSize(x.size) } : x)));
  };

  const remove = (id: WidgetId) => {
    commit(layout.filter((x) => x.id !== id));
  };

  const add = (id: WidgetId) => {
    if (layout.some((x) => x.id === id)) return;
    const meta = widgetMeta(id);
    commit([...layout, { id, size: meta.defaultSize }]);
    setAddOpen(false);
  };

  const onDragStart = (id: WidgetId) => setDragId(id);
  const onDragOver = (e: DragEvent, overId: WidgetId) => {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    const from = layout.findIndex((x) => x.id === dragId);
    const to = layout.findIndex((x) => x.id === overId);
    if (from < 0 || to < 0) return;
    const next = [...layout];
    const [item] = next.splice(from, 1);
    if (!item) return;
    next.splice(to, 0, item);
    setLayout(next);
  };
  const onDragEnd = () => {
    if (dragId) saveLayout(layout);
    setDragId(null);
  };

  const missing = WIDGET_CATALOG.filter((w) => !layout.some((l) => l.id === w.id));

  if (loadedLayout === null) {
    return (
      <p className="mt-4 text-xs text-muted-foreground" role="status">
        Übersicht wird geladen…
      </p>
    );
  }

  return (
    <div className="mt-3">
      <div className="dashboard-customize-bar mb-3 flex flex-wrap items-center gap-2">
        <SportSectionLabel number="03">Dein Cockpit</SportSectionLabel>
        <button
          type="button"
          aria-pressed={editing}
          onClick={() => {
            setEditing((e) => !e);
            setAddOpen(false);
          }}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            editing
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-secondary/50 text-muted-foreground"
          }`}
        >
          {editing ? "Fertig" : "Übersicht anpassen"}
        </button>
        {editing && (
          <>
            <button
              type="button"
              onClick={() => setAddOpen((v) => !v)}
              className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
            >
              + Widget
            </button>
            <button
              type="button"
              onClick={() => {
                setLayout(resetLayout());
                setAddOpen(false);
              }}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"
            >
              Standard
            </button>
          </>
        )}
      </div>

      {editing && addOpen && (
        <div className="mb-3 rounded-2xl border border-border bg-card/80 p-3">
          <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Hinzufügen
          </div>
          {missing.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Alle Widgets sind bereits auf der Übersicht.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-2">
              {missing.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => add(w.id)}
                    className="w-full rounded-xl border border-border bg-secondary/40 px-2 py-2 text-left text-xs transition active:scale-[0.98]"
                  >
                    <span className="font-semibold text-foreground">{w.label}</span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {w.description}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {editing && (
        <p className="mb-2 text-[11px] text-muted-foreground">
          Ziehen zum Sortieren · Größe tippen (Klein/Mittel/Groß) · × zum Entfernen
        </p>
      )}

      <div className="dashboard-widget-grid grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {layout.map((item) => {
          const body = renderWidget(item.id, item.size);
          // Hide empty slots (e.g. challenges before login id is ready) unless editing
          if (body == null && !editing) return null;
          return (
            <div
              key={item.id}
              data-widget-id={item.id}
              draggable={editing}
              onDragStart={() => onDragStart(item.id)}
              onDragOver={(e) => onDragOver(e, item.id)}
              onDragEnd={onDragEnd}
              className={`${sizeClass(item.size)} relative ${editing ? "rounded-2xl ring-1 ring-primary/30" : ""}`}
            >
              {editing && (
                <div className="absolute -top-2 right-1 z-10 flex items-center gap-0.5 rounded-full border border-border bg-background/95 px-1 py-0.5 shadow-md backdrop-blur">
                  <button
                    type="button"
                    className="px-1.5 text-[10px] text-muted-foreground"
                    onClick={() => move(item.id, -1)}
                    aria-label="Nach oben"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="px-1.5 text-[10px] text-muted-foreground"
                    onClick={() => move(item.id, 1)}
                    aria-label="Nach unten"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="rounded px-1.5 text-[10px] font-bold uppercase text-primary"
                    onClick={() => resize(item.id)}
                    aria-label={`Größe ändern (aktuell ${sizeLabel(item.size)})`}
                  >
                    {sizeLabel(item.size)}
                  </button>
                  <button
                    type="button"
                    className="px-1.5 text-xs text-destructive"
                    onClick={() => remove(item.id)}
                    aria-label="Entfernen"
                  >
                    ×
                  </button>
                  <span
                    className="cursor-grab px-1 text-[10px] text-muted-foreground"
                    title="Ziehen"
                  >
                    ⋮⋮
                  </span>
                </div>
              )}
              <div className={editing ? "pt-3 opacity-95" : ""}>
                {body ?? (
                  <div className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
                    {widgetMeta(item.id).label} (noch nicht verfügbar)
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {layout.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Keine Widgets. Tippe „+ Widget“ oder „Standard“.
        </div>
      )}
    </div>
  );
}
