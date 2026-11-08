import { useEffect, useState } from "react";
import {
  addWorkoutNote,
  deleteWorkoutNote,
  filterWorkoutNotes,
  getWorkoutNotes,
  MAX_WORKOUT_NOTE_LENGTH,
  updateWorkoutNote,
} from "@/lib/extra-features";

const PAGE_SIZE = 8;

export function WorkoutNotesPanel() {
  const [notes, setNotes] = useState(() => getWorkoutNotes());
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const refresh = () => setNotes(getWorkoutNotes());
    window.addEventListener("alo-data-changed", refresh);
    window.addEventListener("alo-remote-applied", refresh);
    return () => {
      window.removeEventListener("alo-data-changed", refresh);
      window.removeEventListener("alo-remote-applied", refresh);
    };
  }, []);

  const save = () => {
    if (!text.trim() || text.length > MAX_WORKOUT_NOTE_LENGTH) return;
    try {
      const saved = addWorkoutNote(text);
      if (!saved) {
        setStatus("Notiz konnte nicht gespeichert werden. Dein Text bleibt im Feld.");
        return;
      }
      setText("");
      setNotes(getWorkoutNotes());
      setVisibleCount((count) => Math.max(PAGE_SIZE, count));
      setStatus("Trainingsnotiz gespeichert.");
    } catch {
      setStatus("Notiz konnte nicht gespeichert werden. Dein Text bleibt im Feld.");
    }
  };

  const saveEdit = (id: string) => {
    if (!updateWorkoutNote(id, editText)) {
      setStatus(
        "Notiz bleibt unverändert. Sie muss Text enthalten und höchstens 500 Zeichen lang sein.",
      );
      return;
    }
    setEditingId(null);
    setEditText("");
    setNotes(getWorkoutNotes());
    setStatus("Trainingsnotiz aktualisiert.");
  };

  const copyNote = async (noteText: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(noteText);
      setStatus("Notiz kopiert.");
    } catch {
      setStatus("Kopieren ist in diesem Browser nicht verfügbar.");
    }
  };

  const filteredNotes = filterWorkoutNotes(notes, query);
  const shownNotes = filteredNotes.slice(0, visibleCount);

  return (
    <section className="mt-4 rounded-3xl border border-border bg-card/60 p-4 backdrop-blur">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Trainingsnotizen
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Wie hat sich das Set angefühlt?"
        rows={2}
        maxLength={MAX_WORKOUT_NOTE_LENGTH}
        aria-label="Neue Trainingsnotiz"
        className="mt-2 w-full resize-none rounded-xl border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span aria-live="polite">
          {text.length}/{MAX_WORKOUT_NOTE_LENGTH} Zeichen
        </span>
        <button
          type="button"
          disabled={!text.trim() || text.length > MAX_WORKOUT_NOTE_LENGTH}
          onClick={save}
          className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          Notiz speichern
        </button>
      </div>

      <label className="mt-3 block">
        <span className="sr-only">Trainingsnotizen durchsuchen</span>
        <input
          type="search"
          value={query}
          maxLength={100}
          aria-label="Trainingsnotizen durchsuchen"
          onChange={(e) => {
            setQuery(e.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
          placeholder="Notizen durchsuchen"
          className="min-h-11 w-full rounded-xl border border-border bg-background/60 px-3 text-sm outline-none focus:border-primary"
        />
      </label>

      <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
        {shownNotes.map((n) => (
          <li key={n.id} className="rounded-xl border border-border px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">
                {n.updatedAt ? "Bearbeitet · " : ""}
                {new Date(n.updatedAt ?? n.ts).toLocaleString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {editingId !== n.id && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Notiz kopieren"
                    className="min-h-11 rounded-lg px-2 text-muted-foreground"
                    onClick={() => void copyNote(n.text)}
                  >
                    Kopieren
                  </button>
                  <button
                    type="button"
                    aria-label="Notiz bearbeiten"
                    className="min-h-11 rounded-lg px-2 text-muted-foreground"
                    onClick={() => {
                      setEditingId(n.id);
                      setEditText(n.text);
                      setStatus("");
                    }}
                  >
                    Bearbeiten
                  </button>
                  <button
                    type="button"
                    aria-label="Trainingsnotiz löschen"
                    className="min-h-11 min-w-11 rounded-lg text-muted-foreground"
                    onClick={() => {
                      if (
                        !window.confirm(
                          "Trainingsnotiz löschen? Bei aktivierter Synchronisierung wird auch die Cloudkopie gelöscht.",
                        )
                      )
                        return;
                      deleteWorkoutNote(n.id);
                      setNotes(getWorkoutNotes());
                      setStatus("Trainingsnotiz gelöscht.");
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
            {editingId === n.id ? (
              <div className="mt-2 space-y-2">
                <textarea
                  value={editText}
                  maxLength={MAX_WORKOUT_NOTE_LENGTH}
                  aria-label="Trainingsnotiz bearbeiten"
                  onChange={(e) => setEditText(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    {editText.length}/{MAX_WORKOUT_NOTE_LENGTH} Zeichen
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="min-h-11 rounded-lg px-3 text-muted-foreground"
                      onClick={() => {
                        setEditingId(null);
                        setEditText("");
                      }}
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      className="min-h-11 rounded-lg bg-primary px-3 font-medium text-primary-foreground disabled:opacity-50"
                      disabled={!editText.trim() || editText.length > MAX_WORKOUT_NOTE_LENGTH}
                      onClick={() => saveEdit(n.id)}
                    >
                      Speichern
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-1 whitespace-pre-wrap text-foreground">{n.text}</p>
            )}
          </li>
        ))}
      </ul>
      {filteredNotes.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {query ? "Keine passenden Notizen gefunden." : "Noch keine Trainingsnotizen."}
        </p>
      )}
      {visibleCount < filteredNotes.length && (
        <button
          type="button"
          className="mt-2 min-h-11 w-full rounded-xl border border-border text-xs font-medium"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
        >
          Ältere Notizen laden ({filteredNotes.length - visibleCount})
        </button>
      )}
      {status && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {status}
        </p>
      )}
    </section>
  );
}
