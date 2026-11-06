import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { MARKETPLACE_ICON_COMPONENTS } from "@/components/marketplace/MarketplaceIcon";
import {
  describeMarketplacePermissions,
  type MarketplaceCategory,
  type MarketplaceInstallState,
  type MarketplacePluginManifest,
} from "@/lib/marketplace";

const CATEGORY_LABELS = {
  app: "Alo-App",
  area: "Bereich",
  tool: "Werkzeug",
} satisfies Record<MarketplaceCategory, string>;

type Props = Readonly<{
  plugins: readonly MarketplacePluginManifest[];
  installState: MarketplaceInstallState;
  ready: boolean;
  onInstall: (pluginId: string, name: string) => void;
  onToggle: (pluginId: string, name: string, enabled: boolean) => void;
  onRemove: (pluginId: string, name: string) => void;
  onOpen: (pluginId: string) => void;
}>;

export function MarketplaceAppCatalog({
  plugins,
  installState,
  ready,
  onInstall,
  onToggle,
  onRemove,
  onOpen,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = plugins.find((plugin) => plugin.id === selectedId) ?? null;
  const installed = selected ? installState.installedPluginIds.includes(selected.id) : false;
  const enabled = selected ? installState.enabledPluginIds.includes(selected.id) : false;

  return (
    <>
      <section
        className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6"
        aria-label="Kuratierte Alo-Apps, Bereiche und Werkzeuge"
      >
        {plugins.map((plugin) => {
          const Icon = MARKETPLACE_ICON_COMPONENTS[plugin.icon];
          const isInstalled = installState.installedPluginIds.includes(plugin.id);
          return (
            <button
              key={plugin.id}
              type="button"
              aria-label={`${plugin.name}${isInstalled ? ", auf diesem Gerät installiert" : ""}. Details öffnen`}
              onClick={() => setSelectedId(plugin.id)}
              className="flex min-h-32 min-w-0 flex-col items-center justify-center gap-3 rounded-2xl border border-border/70 bg-card/75 p-3 text-center shadow-sm transition hover:border-primary/45 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:min-h-36 sm:p-4"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:h-14 sm:w-14">
                <Icon className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
              </span>
              <span className="line-clamp-2 text-xs font-semibold leading-tight sm:text-sm">
                {plugin.name}
              </span>
              {isInstalled && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  Installiert
                </span>
              )}
            </button>
          );
        })}
      </section>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <DialogContent className="!fixed !left-0 !top-0 !z-50 !m-0 !flex !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 !flex-col !gap-0 !overflow-y-auto !rounded-none !border-0 !p-0 !shadow-none">
          {selected &&
            (() => {
              const Icon = MARKETPLACE_ICON_COMPONENTS[selected.icon];
              return (
                <section
                  key={selected.id}
                  className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-5 pb-8 pt-16 sm:px-8 sm:pt-20"
                >
                  <header className="flex items-start gap-4">
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:h-20 sm:w-20">
                      <Icon className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                        {CATEGORY_LABELS[selected.category]} · {selected.publisher} · Version{" "}
                        {selected.version}
                      </p>
                      <DialogTitle className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
                        {selected.name}
                      </DialogTitle>
                    </div>
                  </header>
                  <DialogDescription className="mt-6 text-base leading-relaxed text-foreground">
                    {selected.description}
                  </DialogDescription>
                  <section
                    className="mt-7 rounded-2xl border border-border/70 bg-card/60 p-4"
                    aria-label={`Berechtigungen für ${selected.name}`}
                  >
                    <h3 className="text-sm font-bold">Was diese App verwendet</h3>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                      {describeMarketplacePermissions(selected).map((permission) => (
                        <li key={permission}>{permission}</li>
                      ))}
                    </ul>
                  </section>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    Alo-Apps sind fest registrierte Funktionen. Installieren speichert deine Auswahl
                    lokal auf diesem Gerät; es wird kein ausführbarer Plugin-Code geladen.
                  </p>
                  <div className="mt-auto flex flex-wrap gap-3 pt-8">
                    {!installed ? (
                      <button
                        type="button"
                        disabled={!ready}
                        onClick={() => onInstall(selected.id, selected.name)}
                        className="min-h-11 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Auf diesem Gerät installieren
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          aria-pressed={enabled}
                          disabled={!ready}
                          onClick={() => onToggle(selected.id, selected.name, enabled)}
                          className="min-h-11 rounded-xl border border-border bg-background px-5 py-2 text-sm font-semibold disabled:opacity-50"
                        >
                          {enabled ? "Deaktivieren" : "Aktivieren"}
                        </button>
                        <button
                          type="button"
                          disabled={!ready}
                          onClick={() => onRemove(selected.id, selected.name)}
                          className="min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground disabled:opacity-50"
                        >
                          Entfernen
                        </button>
                      </>
                    )}
                    {installed && enabled && (
                      <button
                        type="button"
                        onClick={() => onOpen(selected.id)}
                        className="min-h-11 rounded-xl border border-primary/30 bg-primary/5 px-5 py-2 text-sm font-semibold text-primary"
                      >
                        App öffnen
                      </button>
                    )}
                  </div>
                </section>
              );
            })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
