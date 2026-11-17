import { MousePointer2 } from "lucide-react";

import { describePointerStep, type MiraPointerStep } from "@/lib/mira-computer-use";

export function MiraPointerActivityCard({ steps }: { steps: MiraPointerStep[] }) {
  if (steps.length === 0) return null;
  return (
    <section
      data-mira-pointer-activity
      aria-label="Mira bedient die Website"
      className="mx-auto mt-2 w-[92%] rounded-2xl border border-border bg-card/80 p-3 text-xs"
    >
      <div className="mb-1.5 flex items-center gap-1.5 font-semibold uppercase tracking-wide text-muted-foreground">
        <MousePointer2 className="h-3.5 w-3.5" aria-hidden="true" /> Mira bedient die Website
      </div>
      <ul className="space-y-1 text-foreground">
        {steps.map((step, index) => (
          <li key={index} className="truncate">
            · {describePointerStep(step)}
          </li>
        ))}
      </ul>
    </section>
  );
}
