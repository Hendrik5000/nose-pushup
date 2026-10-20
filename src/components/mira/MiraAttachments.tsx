import { useEffect, useRef, useState } from "react";
import { Camera, FilePlus2, Images, Paperclip, X } from "lucide-react";
import {
  checkMiraSelection,
  MIRA_FILE_ACCEPT,
  MIRA_IMAGE_ACCEPT,
  removeMiraAttachment,
  type LocalMiraAttachment,
} from "@/lib/mira-attachments";

type Props = {
  items: LocalMiraAttachment[];
  onChange: (items: LocalMiraAttachment[]) => void;
  onError: (error: string) => void;
  disabled: boolean;
};
export function MiraAttachmentPicker({ items, onChange, onError, disabled }: Props) {
  const camera = useRef<HTMLInputElement>(null);
  const photos = useRef<HTMLInputElement>(null);
  const files = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const choose = (list: FileList | null) => {
    if (!list?.length || disabled) return;
    const added = Array.from(list).map((file) => ({ id: crypto.randomUUID(), file }));
    try {
      checkMiraSelection([...items, ...added].map((item) => item.file));
      onChange([...items, ...added]);
      menu.current?.removeAttribute("open");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Dateien konnten nicht ausgewählt werden.");
    }
  };
  return (
    <>
      <input
        ref={camera}
        type="file"
        accept={MIRA_IMAGE_ACCEPT}
        capture="environment"
        className="hidden"
        aria-label="Kamera-Foto auswählen"
        disabled={disabled}
        onChange={(event) => {
          choose(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={photos}
        type="file"
        accept={MIRA_IMAGE_ACCEPT}
        multiple
        className="hidden"
        aria-label="Fotos aus der Mediathek auswählen"
        disabled={disabled}
        onChange={(event) => {
          choose(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={files}
        type="file"
        accept={MIRA_FILE_ACCEPT}
        multiple
        className="hidden"
        aria-label="Dateien vom Gerät auswählen"
        disabled={disabled}
        onChange={(event) => {
          choose(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      <details
        ref={menu}
        className="mira-attachment-picker"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            menu.current?.removeAttribute("open");
            menu.current?.querySelector("summary")?.focus();
          }
        }}
      >
        <summary
          aria-label="Foto oder Datei hinzufügen"
          aria-disabled={disabled}
          onClick={(event) => {
            if (disabled) event.preventDefault();
          }}
        >
          <Paperclip aria-hidden="true" />
        </summary>
        <div className="mira-attachment-menu" role="group" aria-label="Anhang auswählen">
          <button type="button" disabled={disabled} onClick={() => camera.current?.click()}>
            <Camera aria-hidden="true" />
            Foto aufnehmen
          </button>
          <button type="button" disabled={disabled} onClick={() => photos.current?.click()}>
            <Images aria-hidden="true" />
            Mediathek
          </button>
          <button type="button" disabled={disabled} onClick={() => files.current?.click()}>
            <FilePlus2 aria-hidden="true" />
            Dateien vom Gerät
          </button>
        </div>
      </details>
    </>
  );
}
function LocalPreview({ item }: { item: LocalMiraAttachment }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!item.file.type.startsWith("image/")) return;
    const local = URL.createObjectURL(item.file);
    setUrl(local);
    return () => URL.revokeObjectURL(local);
  }, [item]);
  return url ? (
    <img src={url} alt="Lokale Bildvorschau" className="mira-attachment-image" />
  ) : (
    <FilePlus2 aria-hidden="true" />
  );
}
export function MiraAttachmentPreview({ items, onChange, disabled }: Omit<Props, "onError">) {
  if (!items.length) return null;
  return (
    <section className="mira-attachment-preview" aria-label="Lokale Anhänge vor dem Senden">
      <p>Noch nicht gesendet · nur auf diesem Gerät. Erst „Senden“ überträgt diese Anhänge.</p>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <LocalPreview item={item} />
            <span className="mira-attachment-name">
              <strong>{item.file.name}</strong>
              <small>
                {item.file.type || item.file.name.split(".").pop()?.toUpperCase()} ·{" "}
                {Math.ceil(item.file.size / 1024)} KB
              </small>
            </span>
            <button
              type="button"
              disabled={disabled}
              aria-label={`${item.file.name} entfernen`}
              onClick={() => onChange(removeMiraAttachment(items, item.id))}
            >
              <X aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
