/** Browser-safe helpers. This module never reads or stores provider credentials. */
export const RUNWARE_IMAGE_LIMIT = 1024 * 1024;
export const RUNWARE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function checkRunwareImage(file: Pick<File, "type" | "size">): void {
  if (!RUNWARE_IMAGE_TYPES.includes(file.type))
    throw new Error("Bitte ein PNG-, JPEG- oder WebP-Bild auswählen.");
  if (file.size <= 0 || file.size > RUNWARE_IMAGE_LIMIT)
    throw new Error("Das Bild darf höchstens 1 MB groß sein und nicht leer sein.");
}

export function readRunwareImage(file: File): Promise<string> {
  checkRunwareImage(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Bild konnte nicht gelesen werden."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export function runwareCostLabel(cost?: number): string {
  return typeof cost === "number" && Number.isFinite(cost) && cost >= 0
    ? `Ist-Kosten: ${cost.toLocaleString("de-DE", { maximumFractionDigits: 6 })} USD`
    : "Ist-Kosten: vom Anbieter nicht gemeldet";
}

/** Incremental UTF-8 NDJSON parsing, including chunks splitting multibyte characters. */
export async function readRunwareStream(
  response: Response,
  onEvent: (event: unknown) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!response.ok || !response.body) throw new Error("Mira-Textstream nicht verfügbar.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  const emit = (line: string) => {
    if (line.trim()) onEvent(JSON.parse(line));
  };
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      if (signal?.aborted)
        throw new Error(
          "Warten abgebrochen. Bereits gestartete Aufgaben können weiter Kosten verursachen.",
        );
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) emit(line);
      if (pending.length > 200_000) throw new Error("Textstream zu groß.");
      if (done) {
        emit(pending);
        break;
      }
    }
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

export function safeRunwareMediaUrl(raw?: string): string | undefined {
  if (!raw) return;
  try {
    const url = new URL(raw);
    if (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.hostname.endsWith(".runware.ai")
    )
      return url.href;
  } catch {
    /* Untrusted persisted records are not executable links. */
  }
}
