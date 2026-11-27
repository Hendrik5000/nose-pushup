import { useState } from "react";
import {
  saveMiraActionEntry,
  validateMiraActionCard,
} from "@/lib/mira-action-cards";
import { recordMiraActivity } from "@/lib/mira-activity-log";

type MiraActionCardProps = { action: unknown; userId: string };

/** Renders the fixed confirmation card; saving happens only on an explicit click. */
export function MiraActionCard({ action, userId }: MiraActionCardProps) {
  const parsed = validateMiraActionCard(action);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  if (!parsed) return null;

  const kindLabel = parsed.kind === "task" ? "Aufgabe" : "Notiz";
  const save = () => {
    if (status === "saved") return;
    try {
      saveMiraActionEntry(parsed, userId);
      recordMiraActivity({
        userId,
        kind: "entry",
        label: (parsed.kind === "task" ? "Aufgabe: " : "Notiz: ") + parsed.title,
      });
      setStatus("saved");
      setMessage("Im Alo-Workspace gespeichert.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    }
  };

  return (
    <section
      className="mt-3 min-w-0 overflow-hidden rounded-2xl border border-primary/25 bg-card/80 p-3 text-foreground sm:p-4"
      aria-label={"Mira-Vorschlag: " + kindLabel + " erstellen"}
    >
      <h3 className="text-sm font-semibold">{kindLabel + ": " + parsed.title}</h3>
      <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">
        {parsed.text}
      </p>
      {parsed.due && (
        <p className="mt-1 text-[10px] text-muted-foreground">Faellig: {parsed.due}</p>
      )}
      {status !== "saved" && (
        <button
          type="button"
          onClick={save}
          className="mt-3 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          In Alo speichern
        </button>
      )}
      {message && (
        <p className="mt-2 text-[10px] text-muted-foreground" role="status">
          {message}
        </p>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">
        Nur nach deinem Klick &ndash; nichts wird automatisch gespeichert.
      </p>
    </section>
  );
}
