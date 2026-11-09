import { useState } from "react";
import { copyTextToClipboard } from "@/lib/clipboard";

export function MiraCodeBlock({ text }: { text: string }) {
  const [status, setStatus] = useState("");

  const copy = async () => {
    const copied = await copyTextToClipboard(text);
    setStatus(
      copied
        ? "Codeblock kopiert."
        : "Kopieren nicht verfügbar. Markiere den Code und kopiere ihn manuell.",
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-secondary/60">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Code
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label="Codeblock aus Miras Antwort kopieren"
          className="min-h-11 rounded-lg border border-border bg-background/70 px-3 text-xs font-semibold text-foreground"
        >
          Code kopieren
        </button>
      </div>
      <pre className="max-w-full overflow-x-auto p-3 text-xs leading-relaxed">
        <code>{text}</code>
      </pre>
      <p role="status" aria-live="polite" className="px-3 pb-2 text-[11px] text-muted-foreground">
        {status}
      </p>
    </div>
  );
}
