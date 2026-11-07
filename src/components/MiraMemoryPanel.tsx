import { useEffect, useId, useState } from "react";
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
  const noteInputId = useId();
  const [stateUserId, setStateUserId] = useState(userId);
  const [enabled, setEnabled] = useState(() => isMiraMemoryEnabled(userId));
  const [notes, setNotes] = useState<MiraMemoryNote[]>(() => loadMiraMemoryNotes(userId));
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const currentUserReady = stateUserId === userId;
  const visibleEnabled = currentUserReady && enabled;
  const visibleNotes = currentUserReady ? notes : [];

  useEffect(() => {
    setStateUserId(userId);
    setEnabled(isMiraMemoryEnabled(userId));
    setNotes(loadMiraMemoryNotes(userId));
    setDraft("");
    setMessage("");
  }, [userId]);

  const refresh = () => setNotes(loadMiraMemoryNotes(userId));

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card/50 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Kontext-Gedächtnis</div>
          <p className="text-[11px] text-muted-foreground">
            Nur lokal auf diesem Gerät. Wird nur mitgeschickt, wenn aktiv und Notizen vorhanden
            sind.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const next = !visibleEnabled;
            setMiraMemoryEnabled(next, userId);
            setEnabled(next);
          }}
          className={`min-h-11 min-w-11 rounded-full px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
            visibleEnabled
              ? "bg-primary text-primary-foreground"
              : "border border-border text-muted-foreground"
          }`}
        >
          {visibleEnabled ? "An" : "Aus"}
        </button>
      </div>

      {visibleEnabled && (
        <>
          <div className="space-y-1">
            <label htmlFor={noteInputId} className="sr-only">
              Neue Gedächtnisnotiz
            </label>
            <div className="flex gap-2">
              <input
                id={noteInputId}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setMessage("");
                }}
                placeholder="z. B. Ich schreibe ein Buch über …"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <button
                type="button"
                onClick={() => {
                  const added = addMiraMemoryNote(draft, userId);
                  if (added) {
                    setDraft("");
                    setMessage("");
                    refresh();
                  } else if (draft.trim()) {
                    setMessage("Diese Notiz ist bereits gespeichert.");
                  }
                }}
                className="min-h-11 min-w-11 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Merken
              </button>
            </div>
          </div>
          <p aria-live="polite" role="status" className="min-h-5 text-xs text-muted-foreground">
            {message}
          </p>
          <ul className="max-h-36 space-y-1.5 overflow-y-auto">
            {visibleNotes.length === 0 && (
              <li className="text-xs text-muted-foreground">Noch keine Notizen.</li>
            )}
            {visibleNotes.map((n) => (
              <li
                key={n.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-border/80 px-2 py-1.5 text-xs"
              >
                <span className="min-w-0 break-words">{n.text}</span>
                <button
                  type="button"
                  className="min-h-11 min-w-11 shrink-0 rounded-lg text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={`Notiz löschen: ${n.text}`}
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
          {visibleNotes.length > 0 && (
            <button
              type="button"
              className="min-h-11 rounded-lg px-2 text-xs text-muted-foreground underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
