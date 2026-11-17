import { ExternalLink, Globe } from "lucide-react";

import type { MiraWebStep } from "@/lib/mira-browser";

export interface MiraWebActivity {
  steps: MiraWebStep[];
  targetUrl: string | null;
}

function stepLabel(step: MiraWebStep): string {
  if (step.kind === "search")
    return `Im Web gesucht: „${step.query}“ · ${step.resultCount} Treffer`;
  if (step.kind === "read") return `Seite gelesen: ${step.title}`;
  return `Nicht erreichbar: ${step.detail}`;
}

export function MiraWebActivityCard({
  activity,
  onOpenInBrowser,
}: {
  activity: MiraWebActivity;
  onOpenInBrowser: (url: string) => void;
}) {
  if (activity.steps.length === 0) return null;
  return (
    <section
      data-mira-web-activity
      aria-label="Mira nutzt den Alo-Browser"
      className="mx-auto mt-2 w-[92%] rounded-2xl border border-border bg-card/80 p-3 text-xs"
    >
      <div className="mb-1.5 flex items-center gap-1.5 font-semibold uppercase tracking-wide text-muted-foreground">
        <Globe className="h-3.5 w-3.5" aria-hidden="true" /> Mira nutzt den Alo-Browser
      </div>
      <ul className="space-y-1 text-foreground">
        {activity.steps.map((step, index) => (
          <li key={index} className="truncate">
            · {stepLabel(step)}
          </li>
        ))}
      </ul>
      {activity.targetUrl && (
        <button
          type="button"
          onClick={() => onOpenInBrowser(activity.targetUrl as string)}
          className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 font-semibold text-primary-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Im Alo-Browser öffnen
        </button>
      )}
    </section>
  );
}
