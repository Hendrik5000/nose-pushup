import { useEffect, useState } from "react";
import { addWorkoutNote, deleteWorkoutNote, getWorkoutNotes } from "@/lib/extra-features";

export function WorkoutNotesPanel() {
  const [notes, setNotes] = useState(() => getWorkoutNotes());
  const [text, setText] = useState("");
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
    if (!text.trim()) return;
    addWorkoutNote(text);
    setText("");
    setNotes(getWorkoutNotes());
  };

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
        className="mt-2 w-full resize-none rounded-xl border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <button
        type="button"
        onClick={save}
        className="mt-2 w-full rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
      >
        Notiz speichern
      </button>
      <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto">
        {notes.slice(0, 8).map((n) => (
          <li key={n.id} className="rounded-xl border border-border px-3 py-2 text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">
                {new Date(n.ts).toLocaleString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <button
                type="button"
                className="text-muted-foreground"
                onClick={() => {
                  if (
                    !window.confirm(
                      "Trainingsnotiz löschen? Bei aktivierter Synchronisierung wird auch die Cloudkopie gelöscht.",
                    )
                  )
                    return;
                  deleteWorkoutNote(n.id);
                  setNotes(getWorkoutNotes());
                }}
              >
                ×
              </button>
            </div>
            <p className="mt-1 text-foreground">{n.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
