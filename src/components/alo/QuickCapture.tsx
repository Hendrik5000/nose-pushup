import { useEffect, useRef, useState } from "react";
import { fileToData, listAlo, putAlo, safeLink } from "@/lib/alo-store";
export function QuickCapture({ userId, onSaved }: { userId: string; onSaved?: () => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [area, setArea] = useState("all");
  const [collection, setCollection] = useState("");
  const [attachment, setAttachment] = useState<{ name: string; type: string; data: string } | null>(
    null,
  );
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collections = listAlo("collection", userId);
  const cleanup = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    if (timeout.current) clearTimeout(timeout.current);
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      cleanup();
    };
  }, []);
  const attach = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const data = await fileToData(file);
      if (mounted.current) {
        setAttachment({ name: file.name, type: file.type, data });
        setStatus("");
      }
    } catch (e) {
      if (mounted.current) setStatus(e instanceof Error ? e.message : "Datei nicht lesbar.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const voice = async () => {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatus("Audioaufnahme wird hier nicht unterstützt. Du kannst eine Audiodatei auswählen.");
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const rec = new MediaRecorder(media);
      recorder.current = rec;
      const parts: Blob[] = [];
      let size = 0;
      rec.ondataavailable = (e) => {
        parts.push(e.data);
        size += e.data.size;
        if (size > 900000 && rec.state === "recording") rec.stop();
      };
      rec.onstop = () => {
        cleanup();
        if (mounted.current) {
          setRecording(false);
          const blob = new Blob(parts, { type: rec.mimeType });
          void attach(new File([blob], `Sprachnotiz-${Date.now()}.webm`, { type: rec.mimeType }));
        }
      };
      rec.onerror = () => {
        cleanup();
        if (mounted.current) {
          setRecording(false);
          setStatus("Aufnahme fehlgeschlagen.");
        }
      };
      rec.start(500);
      setRecording(true);
      setStatus("Aufnahme läuft, maximal 60 Sekunden. Stoppen zum Anhören.");
      timeout.current = setTimeout(() => {
        if (rec.state === "recording") rec.stop();
      }, 60000);
    } catch {
      cleanup();
      setStatus("Kein Mikrofonzugriff. Bitte Browserberechtigung prüfen.");
    }
  };
  const save = () => {
    if (!title.trim() && !text.trim() && !url.trim() && !attachment) return;
    if (url.trim() && !safeLink(url)) {
      setStatus("Bitte einen vollständigen http-/https-Link eingeben.");
      return;
    }
    try {
      putAlo(
        "capture",
        {
          title: title.trim() || attachment?.name || "Schnellablage",
          text: text.trim(),
          url: url.trim(),
          area,
          collectionId: collection,
          source: "Schnellablage",
          ...(attachment ? { attachment } : {}),
        },
        undefined,
        userId,
      );
      setTitle("");
      setText("");
      setUrl("");
      setAttachment(null);
      setStatus("Schnellablage lokal gespeichert. Cloud nur bei aktivierter Synchronisierung.");
      onSaved?.();
    } catch {
      setStatus("Nicht gespeichert: Gerätespeicher voll oder gesperrt. Inhalt bleibt im Formular.");
    }
  };
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Schnell speichern</h2>
      <p className="text-xs text-muted-foreground">
        Privat für dein Konto. Keine automatische Übergabe an Mira oder Nexus. Dateien bis 1 MB;
        größere Dateien bitte als Link ablegen.
      </p>
      <label>
        Titel
        <input
          aria-label="Ablage Titel"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
      </label>
      <label>
        Text
        <textarea
          aria-label="Ablage Text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={20000}
        />
      </label>
      <label>
        Link
        <input
          type="url"
          aria-label="Ablage Link"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label>
          Bereich
          <select
            aria-label="Ablage Bereich"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          >
            <option value="all">Alo · Allgemein</option>
            <option value="nose">Training</option>
            <option value="mira">Mira</option>
            <option value="nexus">Nexus</option>
          </select>
        </label>
        <label>
          Sammlung
          <select
            aria-label="Ablage Sammlung"
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
          >
            <option value="">Ohne Sammlung</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {String(c.body.title)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Foto, Audio oder Datei
        <input
          aria-label="Datei zur Schnellablage"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,audio/*,application/pdf,text/plain"
          disabled={busy || recording}
          onChange={(e) => void attach(e.target.files?.[0])}
        />
      </label>
      <button type="button" className="alo-btn" disabled={busy} onClick={() => void voice()}>
        {recording ? "Aufnahme stoppen" : "Sprachnotiz aufnehmen"}
      </button>
      {attachment && (
        <div className="alo-card">
          <p>{attachment.name}</p>
          {attachment.type.startsWith("audio/") && (
            <audio controls src={attachment.data} className="w-full" />
          )}
          {attachment.type.startsWith("image/") && (
            <img className="max-h-40 rounded-xl" src={attachment.data} alt={attachment.name} />
          )}
          <button className="alo-btn" onClick={() => setAttachment(null)}>
            Anhang entfernen
          </button>
        </div>
      )}
      <button
        type="button"
        className="alo-btn-primary"
        disabled={
          busy || recording || (!title.trim() && !text.trim() && !url.trim() && !attachment)
        }
        onClick={save}
      >
        In Schnellablage speichern
      </button>
      {status && (
        <p role="status" className="text-sm">
          {status}
        </p>
      )}
    </div>
  );
}
