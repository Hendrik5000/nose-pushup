import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { listAlo, putAlo, type AloBody } from "@/lib/alo-store";
import { loadRoomsForUser, detectChatMode, postMessage, type LocalRoom } from "@/lib/chat-backend";
import { addWorkoutNote } from "@/lib/extra-features";
import { useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getAloOwner } from "@/lib/alo-store";
import { getDraft } from "@/lib/chat-extras";
import {
  handoffMiraTextToNexus,
  previewMiraNexusDraft,
  type MiraNexusDraftChoice,
} from "@/lib/mira-nexus-draft";
import { MiraHandoff } from "./MiraHandoff";
export function ContentActions({
  userId,
  text,
  title,
  source,
  triggerLabel = "Alo-Aktionen",
  extra = {},
  onMiraNavigate,
  enableNexusDraft = false,
}: {
  userId: string;
  text: string;
  title: string;
  source: string;
  triggerLabel?: string;
  extra?: AloBody;
  onMiraNavigate?: () => void;
  enableNexusDraft?: boolean;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [rooms, setRooms] = useState<LocalRoom[]>([]);
  const [room, setRoom] = useState("");
  const [collection, setCollection] = useState("");
  const [collections, setCollections] = useState(() => listAlo("collection", userId));
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("lokal");
  const [busy, setBusy] = useState(false);
  const [roomDraftSnapshot, setRoomDraftSnapshot] = useState("");
  const [draftChoice, setDraftChoice] = useState<MiraNexusDraftChoice | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const cancelDraftHandoff = useRef(false);
  const begin = async () => {
    cancelDraftHandoff.current = false;
    setOpen(true);
    setStatus("");
    setRoom("");
    setRoomDraftSnapshot("");
    setDraftChoice(null);
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
  const selectRoom = (nextRoom: string) => {
    setRoom(nextRoom);
    setRoomDraftSnapshot(nextRoom ? getDraft(userId, "room", nextRoom) : "");
    setDraftChoice(null);
    setStatus("");
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
  const openNexusDraft = async () => {
    const selectedRoom = room;
    const expectedDraft = roomDraftSnapshot;
    if (!enableNexusDraft || !selectedRoom || draftBusy) return;
    cancelDraftHandoff.current = false;
    setDraftBusy(true);
    try {
      if (getAloOwner() !== userId)
        throw new Error("Konto geändert. Bitte die Aktion erneut öffnen.");
      const currentRooms = await loadRoomsForUser(userId);
      if (cancelDraftHandoff.current) return;
      if (!currentRooms.some((candidate) => candidate.id === selectedRoom)) {
        setRooms(currentRooms);
        setRoom("");
        setRoomDraftSnapshot("");
        setDraftChoice(null);
        throw new Error(
          "Der ausgewählte Nexus-Raum ist nicht mehr verfügbar. Der Entwurf blieb unverändert.",
        );
      }
      const currentDraft = getDraft(userId, "room", selectedRoom);
      if (currentDraft !== expectedDraft) {
        setRoomDraftSnapshot(currentDraft);
        setDraftChoice(null);
        setStatus(
          "Der Nexus-Entwurf wurde inzwischen geändert. Bitte erneut prüfen und Anhängen oder Ersetzen wählen.",
        );
        return;
      }
      handoffMiraTextToNexus({
        userId,
        roomId: selectedRoom,
        availableRoomIds: currentRooms.map((candidate) => candidate.id),
        text,
        expectedDraft,
        choice: draftChoice,
      });
      setOpen(false);
      await navigate({ to: "/chat" });
    } catch (error) {
      if (!cancelDraftHandoff.current)
        setStatus(
          error instanceof Error
            ? error.message
            : "Der Nexus-Entwurf konnte nicht geöffnet werden.",
        );
    } finally {
      setDraftBusy(false);
    }
  };
  const hasExistingDraft = Boolean(roomDraftSnapshot.trim());
  const draftPreview = previewMiraNexusDraft(roomDraftSnapshot, text, draftChoice);
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
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) cancelDraftHandoff.current = true;
        }}
      >
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
              disabled={draftBusy}
              onChange={(e) => selectRoom(e.target.value)}
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
          {enableNexusDraft && (
            <section
              className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3"
              aria-label="Mira-Antwort als Nexus-Entwurf öffnen"
            >
              <h3 className="font-semibold">Als Nexus-Entwurf öffnen</h3>
              <p className="text-xs text-muted-foreground">
                Übernimmt nur diesen ausgewählten Mira-Text in den Composer des gewählten Raums. Es
                wird keine Nachricht gesendet; Chatverläufe und Anhänge werden nicht übernommen. Bei
                aktiver Alo-Synchronisierung kann der Entwurf wie andere persönliche Entwürfe
                synchronisiert werden.
              </p>
              {room ? (
                <>
                  {hasExistingDraft ? (
                    <>
                      <p className="text-sm">
                        Für „
                        {rooms.find((candidate) => candidate.id === room)?.name ?? "diesen Raum"}"
                        gibt es bereits einen Entwurf. Wähle zuerst, wie du ihn übernehmen möchtest.
                      </p>
                      <pre
                        className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-background/70 p-2 text-xs"
                        aria-label="Vorhandener Nexus-Entwurf"
                      >
                        {roomDraftSnapshot}
                      </pre>
                      <div
                        role="group"
                        aria-label="Umgang mit bestehendem Nexus-Entwurf"
                        className="flex gap-2"
                      >
                        <button
                          type="button"
                          className="alo-btn"
                          aria-pressed={draftChoice === "append"}
                          onClick={() => setDraftChoice("append")}
                        >
                          Anhängen
                        </button>
                        <button
                          type="button"
                          className="alo-btn"
                          aria-pressed={draftChoice === "replace"}
                          onClick={() => setDraftChoice("replace")}
                        >
                          Ersetzen
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm">
                      Für diesen Raum ist noch kein Nexus-Entwurf gespeichert.
                    </p>
                  )}
                  <div>
                    <p className="text-xs font-semibold">Vorschau des Composer-Entwurfs</p>
                    <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-background/70 p-2 text-xs">
                      {draftPreview}
                    </pre>
                  </div>
                  <button
                    type="button"
                    className="alo-btn-primary"
                    disabled={draftBusy || (hasExistingDraft && !draftChoice)}
                    onClick={() => void openNexusDraft()}
                  >
                    {draftBusy ? "Entwurf wird geprüft …" : "Entwurf im Nexus-Composer öffnen"}
                  </button>
                </>
              ) : (
                <p className="text-sm">Wähle oben zuerst den Nexus-Raum und prüfe den Empfänger.</p>
              )}
            </section>
          )}
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
