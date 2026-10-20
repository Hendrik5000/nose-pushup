import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { listAlo, putAlo, type AloBody } from "@/lib/alo-store";
import { loadRoomsForUser, detectChatMode, postMessage, type LocalRoom } from "@/lib/chat-backend";
import { addWorkoutNote } from "@/lib/extra-features";
import { MiraHandoff } from "./MiraHandoff";
export function ContentActions({
  userId,
  text,
  title,
  source,
  triggerLabel = "Alo-Aktionen",
  extra = {},
  onMiraNavigate,
}: {
  userId: string;
  text: string;
  title: string;
  source: string;
  triggerLabel?: string;
  extra?: AloBody;
  onMiraNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rooms, setRooms] = useState<LocalRoom[]>([]);
  const [room, setRoom] = useState("");
  const [collection, setCollection] = useState("");
  const [collections, setCollections] = useState(() => listAlo("collection", userId));
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("lokal");
  const [busy, setBusy] = useState(false);
  const begin = async () => {
    setOpen(true);
    setStatus("");
    setRoom("");
    setCollection("");
    setCollections(listAlo("collection", userId));
    try {
      setMode(
        (await detectChatMode()) === "supabase"
          ? "Cloud · für alle angemeldeten Raumteilnehmer sichtbar"
          : "nur lokal auf diesem Gerät · kein Versand an andere Personen",
      );
      setRooms(await loadRoomsForUser(userId));
    } catch {
      setStatus("Nexus-Räume nicht verfügbar.");
    }
  };
  const saveNote = () => {
    try {
      addWorkoutNote(`${source}: ${text}`);
      setStatus("Als Trainingsnotiz gespeichert.");
    } catch {
      setStatus("Speichern fehlgeschlagen. Gerätespeicher prüfen.");
    }
  };
  const saveCollection = () => {
    if (!collection) return;
    try {
      putAlo(
        "capture",
        {
          title,
          text,
          source,
          area:
            source === "Training" || source === "Nose-Pushup"
              ? "nose"
              : source === "Mira"
                ? "mira"
                : "nexus",
          collectionId: collection,
          ...extra,
        },
        undefined,
        userId,
      );
      setStatus("Kopie in der Sammlung gespeichert.");
    } catch {
      setStatus("Nicht gespeichert. Gerätespeicher prüfen.");
    }
  };
  const share = async () => {
    if (!room || busy) return;
    setBusy(true);
    try {
      const posted = await postMessage(userId, { roomId: room, content: `${title}\n\n${text}` });
      setStatus(
        posted ? "Nachricht gespeichert. " + mode : "Nicht gesendet. Bitte erneut versuchen.",
      );
      if (posted) setRoom("");
    } catch {
      setStatus("Nicht gesendet. Deine Vorschau bleibt erhalten.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <MiraHandoff userId={userId} text={text} source={source} onNavigate={onMiraNavigate} />
      <button
        type="button"
        className="text-xs font-semibold text-primary"
        onClick={() => void begin()}
      >
        {triggerLabel}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="alo-dialog">
          <DialogTitle>Mit Alo weiterverwenden</DialogTitle>
          <DialogDescription>
            Quelle: {source}. Es wird eine Kopie gespeichert; das Original bleibt unverändert.
          </DialogDescription>
          <h3 className="font-semibold">{title}</h3>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-secondary/50 p-3 text-xs">
            {text}
          </pre>
          <button type="button" className="alo-btn" onClick={saveNote}>
            Als Trainingsnotiz speichern
          </button>
          <label>
            Sammlung
            <select
              aria-label="Zielsammlung"
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
            >
              <option value="">Sammlung wählen</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {String(c.body.title)}
                </option>
              ))}
            </select>
          </label>
          {!collections.length && (
            <p className="text-xs text-muted-foreground">
              Lege zuerst über Alo → Sammlungen eine Sammlung an.
            </p>
          )}
          <button type="button" className="alo-btn" disabled={!collection} onClick={saveCollection}>
            In Sammlung ablegen
          </button>
          <label>
            Nexus-Empfänger
            <select
              aria-label="Nexus-Empfänger"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            >
              <option value="">Raum wählen</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-muted-foreground">
            {mode}. Inhalt der Nachricht: obiger Titel und vollständiger Text. Anhänge werden nicht
            mitgesendet. Vorhandene Nexus-Cloudräume sind keine privaten Räume.
          </p>
          <button
            type="button"
            className="alo-btn-primary"
            disabled={!room || busy}
            onClick={() => void share()}
          >
            {busy
              ? "Wird gesendet …"
              : `In Nexus teilen · ${rooms.find((r) => r.id === room)?.name ?? "Raum wählen"}`}
          </button>
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
