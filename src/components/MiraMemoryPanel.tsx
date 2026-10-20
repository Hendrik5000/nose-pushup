import { useState } from "react";
import {
  addMiraMemoryNote,
  clearMiraMemory,
  isMiraMemoryEnabled,
  loadMiraMemoryNotes,
  removeMiraMemoryNote,
  setMiraMemoryEnabled,
  type MiraMemoryNote,
} from "@/lib/mira-memory";

export function MiraMemoryPanel({ userId }: { userId?: string | null }) {
  const [enabled, setEnabled] = useState(() => isMiraMemoryEnabled(userId));
  const [notes, setNotes] = useState<MiraMemoryNote[]>(() => loadMiraMemoryNotes(userId));
  const [draft, setDraft] = useState("");

  const refresh = () => setNotes(loadMiraMemoryNotes(userId));

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card/50 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Kontext-Gedächtnis</div>
          <p className="text-[11px] text-muted-foreground">
            Nur lokal auf diesem Gerät. Wird nur mitgeschickt, wenn aktiv und Notizen vorhanden sind.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const next = !enabled;
            setMiraMemoryEnabled(next, userId);
            setEnabled(next);
          }}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            enabled ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
          }`}
        >
          {enabled ? "An" : "Aus"}
        </button>
      </div>

      {enabled && (
        <>
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="z. B. Ich schreibe ein Buch über …"
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => {
                if (addMiraMemoryNote(draft, userId)) {
                  setDraft("");
                  refresh();
                }
              }}
              className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
            >
              Merken
            </button>
          </div>
          <ul className="max-h-36 space-y-1.5 overflow-y-auto">
            {notes.length === 0 && (
              <li className="text-[11px] text-muted-foreground">Noch keine Notizen.</li>
            )}
            {notes.map((n) => (
              <li
                key={n.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-border/80 px-2 py-1.5 text-[11px]"
              >
                <span>{n.text}</span>
                <button
                  type="button"
                  className="shrink-0 text-muted-foreground"
                  aria-label="Notiz löschen"
                  onClick={() => {
                    removeMiraMemoryNote(n.id, userId);
                    refresh();
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          {notes.length > 0 && (
            <button
              type="button"
              className="text-[11px] text-muted-foreground underline"
              onClick={() => {
                clearMiraMemory(userId);
                setEnabled(false);
                refresh();
              }}
            >
              Gedächtnis leeren
            </button>
          )}
        </>
      )}
    </div>
  );
}
