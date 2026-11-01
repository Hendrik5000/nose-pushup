import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { readAttachment } from "@/lib/alo-attachments";
import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fileToData, putAlo, type AloBody } from "@/lib/alo-store";
import type { ChatMode } from "@/lib/chat-backend";
type Tool = {
  id: string;
  room_id: string;
  user_id: string;
  kind: "info" | "file" | "poll" | "event";
  body: AloBody;
  created_at: string;
};
type Vote = { tool_id: string; user_id: string; choice: number };
export function RoomTools({
  userId,
  roomId,
  roomName,
  mode,
}: {
  userId: string;
  roomId: string;
  roomName: string;
  mode: ChatMode;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<"chat" | Tool["kind"]>("chat");
  const [creating, setCreating] = useState(false);
  const [items, setItems] = useState<Tool[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [kind, setKind] = useState<Tool["kind"]>("info");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [options, setOptions] = useState("");
  const [starts, setStarts] = useState("");
  const [file, setFile] = useState<{ name: string; type: string; data: string } | null>(null);
  const [status, setStatus] = useState("");
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = `alo-room-tools:${userId}:${roomId}`;
  const load = useCallback(async () => {
    if (mode === "local") {
      try {
        const saved = JSON.parse(window.localStorage.getItem(key) ?? '{"items":[],"votes":[]}');
        setItems(saved.items);
        setVotes(saved.votes);
        setAvailable(true);
      } catch {
        setAvailable(false);
        setStatus("Lokaler Raumspeicher nicht lesbar.");
      }
      return;
    }
    const { data, error } = await supabase
      .from("alo_room_tools" as never)
      .select("id,room_id,user_id,kind,body,created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      setAvailable(false);
      setStatus(
        "Raumfunktionen in der Cloud nicht eingerichtet oder nicht erreichbar. Alo-Datenbankmigration erforderlich. Es werden keine lokalen Ersatz-Cloudfunktionen vorgetäuscht.",
      );
      return;
    }
    const tools = (data ?? []) as unknown as Tool[];
    setItems(tools);
    setAvailable(true);
    if (tools.some((t) => t.kind === "poll")) {
      const { data: vs, error: voteError } = await supabase
        .from("alo_room_votes" as never)
        .select("tool_id,user_id,choice")
        .in(
          "tool_id",
          tools.filter((t) => t.kind === "poll").map((t) => t.id),
        );
      if (voteError) {
        setStatus("Umfragestimmen derzeit nicht abrufbar.");
        return;
      }
      setVotes((vs ?? []) as unknown as Vote[]);
    } else setVotes([]);
  }, [key, mode, roomId]);
  useEffect(() => {
    void load().catch(() => {
      setAvailable(false);
      setStatus("Raumfunktionen nicht erreichbar.");
    });
  }, [load]);
  const persistLocal = (newItems: Tool[], newVotes: Vote[]) => {
    window.localStorage.setItem(key, JSON.stringify({ items: newItems, votes: newVotes }));
    setItems(newItems);
    setVotes(newVotes);
  };
  const create = async () => {
    if (!title.trim() || busy || !available) return;
    const choices = options
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (
      kind === "poll" &&
      (choices.length < 2 || choices.length > 10 || new Set(choices).size !== choices.length)
    ) {
      setStatus("Bitte 2 bis 10 unterschiedliche Antwortmöglichkeiten, eine je Zeile.");
      return;
    }
    if (kind === "file" && !file) {
      setStatus("Bitte zuerst eine Datei auswählen.");
      return;
    }
    if (kind === "event" && (!starts || !Number.isFinite(new Date(starts).getTime()))) {
      setStatus("Bitte einen gültigen Termin angeben.");
      return;
    }
    const body: AloBody = {
      title: title.trim(),
      text: text.trim(),
      ...(kind === "poll" ? { options: choices } : {}),
      ...(kind === "event" ? { starts: new Date(starts).toISOString() } : {}),
      ...(kind === "file" ? { attachment: file } : {}),
    };
    const preview = `${title.trim()}\n${text.trim()}${kind === "poll" ? `\nAntworten: ${choices.join(" / ")}` : ""}${kind === "event" ? `\nTermin: ${new Date(starts).toLocaleString("de-DE")}` : ""}${file && kind === "file" ? `\nDatei: ${file.name}` : ""}`;
    if (
      !window.confirm(
        `In „${roomName}“ speichern?\n${mode === "supabase" ? "Für alle angemeldeten Nutzer dieses Nexus-Raums sichtbar (keine privaten Räume)." : "Nur auf diesem Gerät, nicht mit anderen Personen geteilt."}\n\n${preview}`,
      )
    )
      return;
    setBusy(true);
    try {
      const tool: Tool = {
        id: crypto.randomUUID(),
        room_id: roomId,
        user_id: userId,
        kind,
        body,
        created_at: new Date().toISOString(),
      };
      if (mode === "local") persistLocal([tool, ...items], votes);
      else {
        const { error } = await supabase.from("alo_room_tools" as never).insert(tool as never);
        if (error) throw new Error("Rauminhalt konnte nicht gespeichert werden.");
        await load();
      }
      setTitle("");
      setText("");
      setOptions("");
      setStarts("");
      setFile(null);
      setStatus(
        mode === "local"
          ? "Lokal gespeichert. Keine Freigabe an andere Geräte oder Personen."
          : "Im Nexus-Raum gespeichert.",
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };
  const vote = async (tool: Tool, choice: number) => {
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "local")
        persistLocal(items, [
          ...votes.filter((v) => !(v.tool_id === tool.id && v.user_id === userId)),
          { tool_id: tool.id, user_id: userId, choice },
        ]);
      else {
        const { error } = await supabase
          .from("alo_room_votes" as never)
          .upsert({ tool_id: tool.id, user_id: userId, choice } as never, {
            onConflict: "tool_id,user_id",
          });
        if (error) throw new Error("Stimme nicht gespeichert.");
        await load();
      }
      setStatus("Stimme gespeichert; du kannst deine Auswahl ändern.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Abstimmen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (tool: Tool) => {
    if (
      !window.confirm(
        `„${String(tool.body.title)}“ ${mode === "local" ? "nur auf diesem Gerät" : "für alle im Raum samt Umfragestimmen/Anhang"} löschen? Bereits heruntergeladene Dateien werden nicht entfernt.`,
      )
    )
      return;
    try {
      if (mode === "local")
        persistLocal(
          items.filter((t) => t.id !== tool.id),
          votes.filter((v) => v.tool_id !== tool.id),
        );
      else {
        const { error } = await supabase
          .from("alo_room_tools" as never)
          .delete()
          .eq("id", tool.id)
          .eq("user_id", userId);
        if (error) throw error;
        await load();
      }
      setStatus("Rauminhalt gelöscht.");
    } catch {
      setStatus("Löschen fehlgeschlagen.");
    }
  };
  return (
    <>
      <button
        ref={trigger}
        className="alo-room-open"
        type="button"
        onClick={() => {
          setOpen(true);
          void load();
        }}
      >
        Raumdetails öffnen
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="alo-dialog alo-room-sheet"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            trigger.current?.focus();
          }}
        >
          <DialogTitle>{roomName} · Raumdetails</DialogTitle>
          <DialogDescription>
            Infos, Dateien, Umfragen und Termine. Dein Chat bleibt im Hintergrund erhalten.
          </DialogDescription>
          <label>
            Inhalt
            <select
              aria-label="Raumdetail auswählen"
              value={section}
              onChange={(e) => {
                const value = e.target.value as typeof section;
                setSection(value);
                setCreating(false);
                if (value !== "chat") setKind(value);
              }}
            >
              <option value="chat">Chat</option>
              <option value="info">Angepinnte Infos</option>
              <option value="file">Dateien</option>
              <option value="poll">Umfragen</option>
              <option value="event">Termine</option>
            </select>
          </label>
          <div className="alo-room-sheet-content space-y-3">
            {section === "chat" && (
              <div className="alo-card space-y-3">
                <h3 className="font-semibold">Dein Gespräch</h3>
                <p className="text-sm text-muted-foreground">
                  Wähle oben einen Inhalt, um Infos, Raumdateien oder Abstimmungen zu öffnen.
                </p>
                <button className="alo-btn-primary" onClick={() => setOpen(false)}>
                  Zum Chat zurück
                </button>
              </div>
            )}
            {section !== "chat" && (
              <>
                <p className="text-xs text-muted-foreground">
                  {mode === "local"
                    ? "Nur auf diesem Gerät. Lokale Umfragen haben keine geräteübergreifenden Teilnehmer."
                    : "Cloud-Raum: für alle angemeldeten Nexus-Nutzer sichtbar. Kein privater Mitgliederraum. Bis zu 100 letzte Rauminhalte; Aktualisieren lädt neue Stimmen."}
                </p>
                <button className="alo-btn" onClick={() => void load()}>
                  Aktualisieren
                </button>
                <button
                  className="alo-btn-primary"
                  onClick={() => setCreating((v) => !v)}
                  aria-expanded={creating}
                >
                  {creating ? "Formular schließen" : "Neuen Eintrag erstellen"}
                </button>
                {creating && (
                  <div className="alo-card space-y-2">
                    <input
                      aria-label="Rauminhalt Titel"
                      placeholder="Titel"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={200}
                    />
                    <textarea
                      aria-label="Rauminhalt Text"
                      placeholder="Inhalt / Beschreibung"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      maxLength={10000}
                    />
                    {kind === "poll" && (
                      <textarea
                        aria-label="Umfrage Antworten"
                        placeholder="Eine Antwortmöglichkeit je Zeile (2–10)"
                        value={options}
                        onChange={(e) => setOptions(e.target.value)}
                        maxLength={2000}
                      />
                    )}
                    {kind === "event" && (
                      <label>
                        Termin (Gerätezeitzone)
                        <input
                          aria-label="Raumtermin Beginn"
                          type="datetime-local"
                          value={starts}
                          onChange={(e) => setStarts(e.target.value)}
                        />
                      </label>
                    )}
                    {kind === "file" && (
                      <>
                        <input
                          type="file"
                          aria-label="Raumdatei auswählen"
                          accept="image/png,image/jpeg,image/gif,image/webp,audio/*,application/pdf,text/plain"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            setBusy(true);
                            void fileToData(f)
                              .then((data) => setFile({ name: f.name, type: f.type, data }))
                              .catch((e) =>
                                setStatus(e instanceof Error ? e.message : "Datei nicht lesbar."),
                              )
                              .finally(() => setBusy(false));
                          }}
                        />
                        <p>
                          Dateien bis 1 MB werden mit dem Raumdatensatz gespeichert, nicht
                          öffentlich verlinkt. {file?.name}
                        </p>
                      </>
                    )}
                    <button
                      type="button"
                      className="alo-btn-primary"
                      disabled={!available || busy || !title.trim()}
                      onClick={() => void create()}
                    >
                      {busy ? "Speichert …" : "Vorschau bestätigen & im Raum speichern"}
                    </button>
                  </div>
                )}
                {(
                  [
                    ["info", "Angepinnte Infos"],
                    ["file", "Dateien"],
                    ["poll", "Umfragen"],
                    ["event", "Termine"],
                  ] as const
                )
                  .filter(([type]) => type === section)
                  .map(([type, label]) => (
                    <section key={type} className="space-y-2">
                      <h3 className="font-semibold">{label}</h3>
                      {items
                        .filter((t) => t.kind === type)
                        .map((tool) => {
                          const a = readAttachment(tool.body.attachment);
                          return (
                            <article className="alo-card space-y-2" key={tool.id}>
                              <h4 className="font-semibold">{String(tool.body.title)}</h4>
                              <p className="whitespace-pre-wrap break-words">
                                {String(tool.body.text ?? "")}
                              </p>
                              {tool.kind === "poll" &&
                                (Array.isArray(tool.body.options)
                                  ? tool.body.options
                                      .filter((v): v is string => typeof v === "string")
                                      .slice(0, 10)
                                  : []
                                ).map((option, i) => (
                                  <button
                                    className="alo-btn block w-full text-left"
                                    aria-pressed={votes.some(
                                      (v) =>
                                        v.tool_id === tool.id &&
                                        v.user_id === userId &&
                                        v.choice === i,
                                    )}
                                    disabled={busy}
                                    key={i}
                                    onClick={() => void vote(tool, i)}
                                  >
                                    {option} ·{" "}
                                    {
                                      votes.filter((v) => v.tool_id === tool.id && v.choice === i)
                                        .length
                                    }{" "}
                                    Stimme(n)
                                    {votes.some(
                                      (v) =>
                                        v.tool_id === tool.id &&
                                        v.user_id === userId &&
                                        v.choice === i,
                                    )
                                      ? " · Deine Wahl"
                                      : ""}
                                  </button>
                                ))}
                              {tool.kind === "event" && (
                                <>
                                  <p>
                                    {new Date(String(tool.body.starts)).toLocaleString("de-DE")}
                                  </p>
                                  <button
                                    className="alo-btn"
                                    onClick={() => {
                                      try {
                                        putAlo(
                                          "task",
                                          {
                                            title: String(tool.body.title),
                                            due: tool.body.starts,
                                            done: false,
                                            source: `Nexus · ${roomName}`,
                                            roomId,
                                          },
                                          `event:${tool.id}`,
                                          userId,
                                        );
                                        setStatus(
                                          "Termin als persönliche Erinnerung in Tagesübersicht übernommen. Keine automatische Kalenderbuchung oder Hintergrund-Push-Nachricht.",
                                        );
                                      } catch {
                                        setStatus("Termin nicht übernommen.");
                                      }
                                    }}
                                  >
                                    In Tagesübersicht übernehmen
                                  </button>
                                </>
                              )}
                              {a && (
                                <a className="alo-btn inline-block" href={a.data} download={a.name}>
                                  Datei herunterladen · {a.name}
                                </a>
                              )}
                              {tool.user_id === userId && (
                                <button
                                  className="ml-2 text-xs text-destructive"
                                  onClick={() => void remove(tool)}
                                >
                                  Löschen
                                </button>
                              )}
                            </article>
                          );
                        })}
                      {!items.some((t) => t.kind === type) && (
                        <p className="alo-empty-state">
                          Noch keine Einträge. Wähle „Neuen Eintrag erstellen“, um diesen Bereich zu
                          füllen.
                        </p>
                      )}
                    </section>
                  ))}
                {status && <p role="status">{status}</p>}
              </>
            )}
            {section === "chat" && status && <p role="status">{status}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
