import type { ReactNode } from "react";
import { Bookmark, Copy, Info, Volume2, VolumeX } from "lucide-react";
import { ContentActionButton, CONTENT_ICON_ACTION_CLASS } from "../alo/ContentActionButton";
import { providerLabel } from "../../lib/ai-providers";

export type MiraAnswerMeta = {
  provider?: string;
  task?: string;
  model?: string;
  routingReason?: string;
};

export function MiraAnswerActions({
  meta,
  speaking,
  onSpeak,
  onCopy,
  onBookmark,
  children,
}: {
  meta?: MiraAnswerMeta;
  speaking: boolean;
  onSpeak: () => void;
  onCopy: () => void;
  onBookmark: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      className="mira-answer-actions mt-2 flex flex-wrap items-center gap-1"
      role="group"
      aria-label="Aktionen für Miras Antwort"
    >
      {children}
      {meta && (
        <details className="mira-answer-details rounded-lg text-xs text-muted-foreground open:basis-full">
          <summary
            className={`${CONTENT_ICON_ACTION_CLASS} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
            aria-label="Technische Details"
            title="Technische Details"
          >
            <Info className="h-4 w-4" aria-hidden="true" />
          </summary>
          <div className="mira-answer-diagnostics space-y-1 break-words rounded-lg bg-secondary/40 p-3">
            <p>Anbieter für diese Antwort: {providerLabel(meta.provider ?? "unbekannt")}</p>
            {meta.routingReason && <p>Auswahlregel: {meta.routingReason}</p>}
            {meta.provider === "lovable" && (
              <p>Lovable Gateway; das interne Backend ist nicht ausgewiesen.</p>
            )}
            <p>
              {meta.task} · {meta.provider} · Modellkennung: {meta.model}
            </p>
          </div>
        </details>
      )}
      <ContentActionButton
        iconOnly
        icon={speaking ? VolumeX : Volume2}
        label={speaking ? "Miras Antwort stoppen" : "Miras Antwort vorlesen"}
        pressed={speaking}
        onClick={onSpeak}
      />
      <ContentActionButton iconOnly icon={Copy} label="Kopieren" onClick={onCopy} />
      <ContentActionButton iconOnly icon={Bookmark} label="Merken" onClick={onBookmark} />
    </div>
  );
}
