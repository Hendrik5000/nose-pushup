import { useState } from "react";
import { getMarketplaceAuthorAction, type MarketplaceHostAction } from "@/lib/marketplace";
import type { MarketplaceAuthoredManifest, MarketplaceQuizGame } from "@/lib/marketplace-authoring";

type MarketplaceManifestViewProps = {
  manifest: MarketplaceAuthoredManifest;
  preview?: boolean;
  canRunActions?: boolean;
  allowedActionIds?: readonly string[];
  pendingActionId?: string | null;
  onAction?: (actionId: string) => void;
  onRequestPermission?: (actionId: string) => void;
};

export function MarketplaceManifestView({
  manifest,
  preview = false,
  canRunActions = false,
  allowedActionIds,
  pendingActionId = null,
  onAction,
  onRequestPermission,
}: MarketplaceManifestViewProps) {
  return (
    <section
      aria-label={preview ? `Vorschau: ${manifest.name}` : `App-Inhalt: ${manifest.name}`}
      className="mt-5 space-y-3 rounded-2xl border border-border/60 bg-card/60 p-3 sm:p-4"
    >
      {manifest.blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h3 key={`heading-${index}`} className="text-sm font-bold leading-snug">
              {block.text}
            </h3>
          );
        }
        if (block.type === "paragraph") {
          return (
            <p key={`paragraph-${index}`} className="whitespace-pre-wrap text-sm leading-relaxed">
              {block.text}
            </p>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={`list-${index}`} className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
              {block.items.map((item, itemIndex) => (
                <li key={`list-${index}-item-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          );
        }
        const registered = getMarketplaceAuthorAction(block.actionId);
        const hostAction: MarketplaceHostAction | null = registered?.action ?? null;
        const needsPermission =
          allowedActionIds !== undefined && !allowedActionIds.includes(block.actionId);
        return (
          <div key={`action-${index}`}>
            <button
              type="button"
              disabled={
                preview ||
                !canRunActions ||
                !hostAction ||
                !onAction ||
                (needsPermission && !onRequestPermission) ||
                pendingActionId !== null
              }
              onClick={() =>
                needsPermission ? onRequestPermission?.(block.actionId) : onAction?.(block.actionId)
              }
              className="flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="min-w-0">
                <span className="block break-words text-sm font-semibold">
                  {pendingActionId === block.actionId ? "Wird geöffnet …" : block.label}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {preview
                    ? "Vorschau · nach Installation nutzbar"
                    : needsPermission
                      ? "Nicht freigegeben · Zugriff auswählen"
                      : registered?.label}
                </span>
              </span>
              <span aria-hidden="true" className="shrink-0 text-lg text-primary">
                {needsPermission ? "+" : "↗"}
              </span>
            </button>
          </div>
        );
      })}
      {manifest.game && (
        <MarketplaceQuizGameView key={JSON.stringify(manifest.game)} game={manifest.game} />
      )}
    </section>
  );
}

function MarketplaceQuizGameView({ game }: { game: MarketplaceQuizGame }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const answeredCount = Object.keys(answers).length;
  const finished = answeredCount === game.questions.length;
  const score = game.questions.reduce(
    (total, question, index) => total + Number(answers[index] === question.correctIndex),
    0,
  );

  return (
    <section
      aria-label={`Spiel: ${game.title}`}
      className="space-y-4 rounded-xl border border-primary/25 bg-primary/5 p-4"
    >
      <header>
        <h3 className="text-base font-bold">{game.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{game.instructions}</p>
      </header>
      <div className="space-y-4">
        {game.questions.map((question, questionIndex) => {
          const selectedIndex = answers[questionIndex];
          const answered = selectedIndex !== undefined;
          return (
            <fieldset
              key={`question-${questionIndex}`}
              className="space-y-2 rounded-lg border border-border/70 bg-background/70 p-3"
            >
              <legend className="px-1 text-sm font-semibold leading-relaxed">
                {questionIndex + 1}. {question.prompt}
              </legend>
              <div className="grid gap-2">
                {question.choices.map((choice, choiceIndex) => {
                  const isCorrect = answered && choiceIndex === question.correctIndex;
                  const isSelectedWrong = answered && choiceIndex === selectedIndex && !isCorrect;
                  return (
                    <button
                      key={`choice-${choiceIndex}`}
                      type="button"
                      aria-disabled={answered}
                      aria-pressed={selectedIndex === choiceIndex}
                      onClick={() =>
                        setAnswers((current) =>
                          current[questionIndex] !== undefined
                            ? current
                            : { ...current, [questionIndex]: choiceIndex },
                        )
                      }
                      className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${isCorrect ? "border-primary bg-primary/10 text-foreground" : isSelectedWrong ? "border-destructive bg-destructive/5 text-foreground" : answered ? "border-border bg-background cursor-default" : "border-border bg-background hover:border-primary/50"}`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
              <p
                className="text-xs leading-relaxed text-muted-foreground"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {answered && (
                  <>
                    {selectedIndex === question.correctIndex ? "Richtig." : "Nicht ganz."}{" "}
                    {question.explanation}
                  </>
                )}
              </p>
            </fieldset>
          );
        })}
      </div>
      <p className="text-xs font-semibold text-muted-foreground" role="status" aria-live="polite">
        {finished
          ? `Ergebnis: ${score} von ${game.questions.length} richtig.`
          : `Beantwortet: ${answeredCount} von ${game.questions.length}`}
      </p>
      {finished && (
        <section className="space-y-2 rounded-lg border border-primary/25 bg-background/70 p-3">
          <h4 className="text-sm font-bold">Runde beendet</h4>
          <p className="text-sm leading-relaxed">{game.completionMessage}</p>
          <button
            type="button"
            onClick={() => setAnswers({})}
            className="min-h-11 rounded-lg border border-border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Noch einmal spielen
          </button>
        </section>
      )}
    </section>
  );
}
