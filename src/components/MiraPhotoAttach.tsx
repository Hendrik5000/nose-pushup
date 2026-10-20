/** Photo attach control for Mira chat (controlled). */
export function MiraPhotoAttach({
  value,
  onChange,
  disabled,
  inputId = "mira-photo-input",
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  inputId?: string;
}) {
  return (
    <>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (!file.type.startsWith("image/")) return;
          if (file.size > 1_200_000) {
            window.alert("Foto max. ca. 1,2 MB — bitte kleiner wählen.");
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") onChange(reader.result);
          };
          reader.readAsDataURL(file);
          e.target.value = "";
        }}
      />
      {value && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-2 py-1.5">
          <img src={value} alt="Anhang für Mira" className="h-14 w-14 rounded-lg object-cover" />
          <div className="min-w-0 flex-1 text-[11px] text-muted-foreground">
            Foto bereit — wird mit der nächsten Nachricht gesendet.
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-primary"
            onClick={() => onChange(null)}
          >
            Entfernen
          </button>
        </div>
      )}
      <button
        type="button"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground disabled:opacity-40"
        aria-label="Foto an Mira anhängen"
        title="Foto anhängen"
        disabled={disabled}
        onClick={() => document.getElementById(inputId)?.click()}
      >
        <span aria-hidden="true" className="text-base leading-none">
          📷
        </span>
      </button>
    </>
  );
}
