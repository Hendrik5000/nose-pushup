import type { RunwareResult } from "@/lib/runware";
import { runwareCostLabel, safeRunwareMediaUrl } from "@/lib/runware-client";

export function MiraRunwareResult({ result }: { result: RunwareResult }) {
  const url = safeRunwareMediaUrl(result.url);
  return (
    <section
      aria-label="Mira-Medienergebnis"
      className="mt-3 min-w-0 space-y-2 rounded-xl border border-border p-3"
    >
      <p className="break-all text-xs text-muted-foreground">
        Runware · {result.model} · {runwareCostLabel(result.cost)}
      </p>
      {url && result.kind === "image" && (
        <img
          src={url}
          alt="Mira-Medienergebnis"
          className="max-h-80 w-full rounded-lg object-contain"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      )}
      {url && result.kind === "audio" && (
        <audio src={url} controls preload="none" className="w-full max-w-full" />
      )}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center text-xs font-semibold text-primary"
        >
          {result.kind === "model"
            ? "3D-Datei öffnen / speichern"
            : "Datei öffnen / auf Gerät speichern"}
        </a>
      )}
      {url && (
        <p className="text-xs text-muted-foreground">
          Medienlinks laufen ab (standardmäßig nach 7 Tagen). Für dauerhafte Aufbewahrung die Datei
          herunterladen. Geteilte Links sind für Empfänger abrufbar.
        </p>
      )}
    </section>
  );
}
