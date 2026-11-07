import { MarketplaceIcon } from "@/components/marketplace/MarketplaceIcon";
import { MarketplaceManifestView } from "@/components/marketplace/MarketplaceManifestView";
import {
  describeMarketplaceAuthoredPermissions,
  type MarketplaceAuthoredManifest,
} from "@/lib/marketplace-authoring";

export type MarketplaceMiraDraftTarget = Readonly<{
  appId: string;
  expectedVersion: number;
  appName: string;
}>;

export type MarketplaceMiraDraft = Readonly<{
  manifest: MarketplaceAuthoredManifest;
  target: MarketplaceMiraDraftTarget | null;
  providerLabel: string;
}>;

type MiraMarketplaceDraftPreviewProps = {
  draft: MarketplaceMiraDraft;
  confirming: boolean;
  publishing: boolean;
  onAskPublish: () => void;
  onConfirmPublish: () => void;
  onCancelPublish: () => void;
  onDiscard: () => void;
};

export function MiraMarketplaceDraftPreview({
  draft,
  confirming,
  publishing,
  onAskPublish,
  onConfirmPublish,
  onCancelPublish,
  onDiscard,
}: MiraMarketplaceDraftPreviewProps) {
  const { manifest, target } = draft;
  const nextVersion = target ? target.expectedVersion + 1 : 1;

  return (
    <section
      aria-label={`Lokaler App-Entwurf: ${manifest.name}`}
      className="w-full max-w-xl rounded-2xl border border-primary/25 bg-card/80 p-4 shadow-sm sm:p-5"
    >
      <header className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MarketplaceIcon icon={manifest.icon} className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
            Lokale Vorschau · noch nicht veröffentlicht
          </p>
          <h3 className="mt-1 text-base font-bold">{manifest.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">Entwurf mit {draft.providerLabel}</p>
        </div>
        <button
          type="button"
          onClick={onDiscard}
          disabled={publishing}
          className="min-h-10 rounded-lg px-2 text-xs font-semibold underline underline-offset-4 disabled:opacity-50"
        >
          Verwerfen
        </button>
      </header>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{manifest.description}</p>
      <MarketplaceManifestView manifest={manifest} preview />
      <section
        className="mt-3 rounded-xl border border-border/60 bg-background/50 p-3"
        aria-label={`Berechtigungen für ${manifest.name}`}
      >
        <h4 className="text-xs font-bold uppercase tracking-wide">Feste Aktionen</h4>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
          {describeMarketplaceAuthoredPermissions(manifest).map((permission, index) => (
            <li key={`${index}-${permission}`}>{permission}</li>
          ))}
        </ul>
      </section>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Du kannst Mira im Chat einfach sagen, was sie an diesem Entwurf ändern soll. Die Vorschau
        bleibt lokal, bis du die Veröffentlichung bestätigst.
      </p>
      {!confirming ? (
        <button
          type="button"
          onClick={onAskPublish}
          disabled={publishing}
          className="mt-4 min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {target ? `Version ${nextVersion} veröffentlichen …` : "Für Alo-Admins veröffentlichen …"}
        </button>
      ) : (
        <section
          role="group"
          aria-label="Veröffentlichung ausdrücklich bestätigen"
          className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3"
        >
          <p className="text-sm leading-relaxed">
            {target
              ? `„${manifest.name}“ wird als neue Version ${nextVersion} im gemeinsamen Admin-Marketplace gespeichert.`
              : `„${manifest.name}“ wird als Version 1 im gemeinsamen Admin-Marketplace gespeichert.`}{" "}
            Alle Alo-Admins können die deklarative App sehen. Veröffentlicht wird nur dieses
            geprüfte Manifest – keine Chatverläufe, Anhänge oder Gesundheits-/Trainingsdaten.
            Veröffentlichte Versionen sind unveränderlich.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onConfirmPublish}
              disabled={publishing}
              className="min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {publishing ? "Veröffentliche …" : "Ja, veröffentlichen"}
            </button>
            <button
              type="button"
              onClick={onCancelPublish}
              disabled={publishing}
              className="min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Abbrechen
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
