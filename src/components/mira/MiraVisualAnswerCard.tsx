import {
  validateMiraVisualAnswer,
  type MiraVisualAnswer,
  type MiraVisualBarChart,
} from "@/lib/mira-visual-answer";

type MiraVisualAnswerCardProps = { visual: unknown };

/** Renders only the two fixed visual types after validating stored or provider data. */
export function MiraVisualAnswerCard({ visual }: MiraVisualAnswerCardProps) {
  const answer = validateMiraVisualAnswer(visual);
  if (!answer) return null;

  return (
    <section
      className="mt-3 min-w-0 overflow-hidden rounded-2xl border border-primary/25 bg-card/80 p-3 text-foreground sm:p-4"
      aria-label={`Visualisierte Antwort: ${answer.title}`}
    >
      <h3 className="text-sm font-semibold">{answer.title}</h3>
      {answer.type === "metricGrid" ? <MetricGrid visual={answer} /> : <BarChart visual={answer} />}
      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
        Nur eine Darstellung der Antwort – keine Live-Abfrage.
      </p>
    </section>
  );
}

function MetricGrid({ visual }: { visual: Extract<MiraVisualAnswer, { type: "metricGrid" }> }) {
  return (
    <dl className="mt-3 grid min-w-0 grid-cols-2 gap-2">
      {visual.items.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          className="min-w-0 rounded-xl border border-border/70 bg-background/70 p-3"
        >
          <dt className="break-words text-[11px] text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 break-words text-base font-semibold">{item.value}</dd>
          {item.detail && (
            <dd className="mt-1 break-words text-[10px] text-muted-foreground">{item.detail}</dd>
          )}
        </div>
      ))}
    </dl>
  );
}

function BarChart({ visual }: { visual: MiraVisualBarChart }) {
  const maxValue = Math.max(...visual.items.map((item) => item.value));
  return (
    <ul className="mt-3 grid min-w-0 gap-3" aria-label="Vergleichswerte">
      {visual.items.map((item, index) => {
        const width = Math.max(0, Math.min(100, (item.value / maxValue) * 100));
        return (
          <li key={`${item.label}-${index}`} className="grid min-w-0 gap-1">
            <div className="flex min-w-0 items-baseline justify-between gap-2 text-xs">
              <span className="break-words">{item.label}</span>
              <span className="shrink-0 font-semibold">
                {item.value.toLocaleString("de-DE", { maximumFractionDigits: 2 })}
                {visual.unit ? ` ${visual.unit}` : ""}
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${item.label}: ${item.value.toLocaleString("de-DE")}${visual.unit ? ` ${visual.unit}` : ""}`}
            >
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${width}%` }}
                aria-hidden="true"
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
