import { getMarketplaceAuthorAction, type MarketplaceHostAction } from "@/lib/marketplace";
import type { MarketplaceAuthoredManifest } from "@/lib/marketplace-authoring";

type MarketplaceManifestViewProps = {
  manifest: MarketplaceAuthoredManifest;
  preview?: boolean;
  canRunActions?: boolean;
  onAction?: (actionId: string) => void;
};

export function MarketplaceManifestView({
  manifest,
  preview = false,
  canRunActions = false,
  onAction,
}: MarketplaceManifestViewProps) {
  return (
    <section
      aria-label={preview ? `Vorschau: ${manifest.name}` : `App-Inhalt: ${manifest.name}`}
      className="mt-4 space-y-3 rounded-xl border border-border/60 bg-background/50 p-3"
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
        return (
          <div key={`action-${index}`} className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={preview || !canRunActions || !hostAction || !onAction}
              onClick={() => onAction?.(block.actionId)}
              className="min-h-11 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {block.label}
            </button>
            {registered && (
              <span className="text-xs text-muted-foreground">
                {registered.permission === "alo.open-existing-tool"
                  ? `Öffnet ${registered.label} nach deinem Tippen`
                  : `Öffnet ${registered.label} nach deinem Tippen`}
              </span>
            )}
          </div>
        );
      })}
    </section>
  );
}
