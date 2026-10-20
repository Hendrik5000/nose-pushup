import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  currentMiraSession,
  handoffToMira,
  previewMiraDraft,
  readMiraDraft,
  type MiraDraftChoice,
} from "@/lib/mira-handoff";

export function MiraHandoff({
  userId,
  text,
  source,
  label = "Mit Mira besprechen",
  onNavigate,
  className = "text-xs font-semibold text-primary",
}: {
  userId: string;
  text: string;
  source: string;
  label?: string;
  onNavigate?: () => void;
  className?: string;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [incoming, setIncoming] = useState(text);
  const [existing, setExisting] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [choice, setChoice] = useState<MiraDraftChoice>("append");
  const [status, setStatus] = useState("");
  const begin = () => {
    try {
      const id = currentMiraSession();
      setSessionId(id);
      setExisting(readMiraDraft(id));
      setIncoming(text);
      setChoice("append");
      setStatus("");
      setOpen(true);
    } catch {
      setStatus("Mira-Entwurf konnte nicht gelesen werden. Es wurde nichts geändert.");
    }
  };
  const preview = previewMiraDraft(existing, incoming, choice);
  const confirm = () => {
    try {
      handoffToMira({ userId, sessionId, expectedDraft: existing, text: incoming, choice });
      setOpen(false);
      onNavigate?.();
      void navigate({ to: "/ai" });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Entwurf nicht gespeichert.");
    }
  };
  return (
    <>
      <button type="button" className={className} onClick={begin}>
        {label}
      </button>
      {!open && status && (
        <p role="status" className="text-xs">
          {status}
        </p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="alo-dialog max-h-[85dvh] overflow-y-auto">
          <DialogTitle>Mit Mira besprechen</DialogTitle>
          <DialogDescription>
            Nur dieser ausgewählte Text aus {source} wird übernommen, keine Anhänge oder weiteren
            Quelldaten. Kein Versand beim Öffnen; erst „Senden“ im Mira-Chat startet die KI-Anfrage.
            Dabei gelten der dortige Chatverlauf und deine bestehenden Datenfreigaben.
          </DialogDescription>
          <label className="space-y-2 text-sm">
            Text für Mira bearbeiten
            <textarea
              aria-label="Text für Mira bearbeiten"
              className="min-h-36 w-full rounded-xl border bg-background p-3"
              value={incoming}
              onChange={(event) => setIncoming(event.target.value)}
            />
          </label>
          {existing.trim() && (
            <fieldset className="space-y-2 text-sm">
              <legend className="font-semibold">Ein Mira-Entwurf ist bereits vorhanden</legend>
              {(
                [
                  ["keep", "Vorhandenen Entwurf behalten · nichts übernehmen"],
                  ["append", "Diesen Text an den vorhandenen Entwurf anhängen"],
                  ["new", "Neuen Chat öffnen · bisherigen Entwurf behalten"],
                ] as const
              ).map(([value, title]) => (
                <label key={value} className="flex min-h-11 items-center gap-2">
                  <input
                    type="radio"
                    name="mira-draft-choice"
                    value={value}
                    checked={choice === value}
                    onChange={() => setChoice(value)}
                  />
                  {title}
                </label>
              ))}
            </fieldset>
          )}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Exakter Entwurf im Mira-Chat</p>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-secondary/50 p-3 text-xs">
              {preview}
            </pre>
          </div>
          <button
            type="button"
            className="alo-btn-primary min-h-11"
            disabled={!preview.trim()}
            onClick={confirm}
          >
            {choice === "keep"
              ? "Vorhandenen Entwurf öffnen"
              : choice === "new"
                ? "Neuen Chat mit Entwurf öffnen"
                : "Entwurf in Mira öffnen"}
          </button>
          <p className="text-xs text-muted-foreground">
            Kein automatisches Senden. Keine zusätzlichen Anbieter oder Datenfreigaben.
          </p>
          {status && (
            <p role="status" className="text-sm">
              {status}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
