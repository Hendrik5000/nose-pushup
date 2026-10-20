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
      <button
        type="button"
        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-muted-foreground disabled:opacity-40"
        aria-label="Foto an Mira anhängen"
        title="Foto anhängen"
        disabled={disabled}
        onClick={() => document.getElementById(inputId)?.click()}
      >
        <span aria-hidden="true" className="text-lg leading-none">
          📷
        </span>
      </button>
    </>
  );
}
