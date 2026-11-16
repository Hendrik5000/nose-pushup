import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
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
  const [collection, setCollection] = useState<"recommended" | "new" | "official" | "friends">("recommended");
  const selected = plugins.find((plugin) => plugin.id === selectedId) ?? null;
  const collectionIds = collection === "new"
    ? ["alo-sports", "alo-neon-starfighter"]
    : collection === "recommended"
      ? ["alo-sports", "alo-health-app", "alo-training"]
      : collection === "friends"
        ? []
        : plugins.map((plugin) => plugin.id);
  const visiblePlugins = plugins.filter((plugin) => collectionIds.includes(plugin.id));
  const CompactCard = ({ plugin }: { plugin: MarketplacePluginManifest }) => {
    const Icon = MARKETPLACE_ICON_COMPONENTS[plugin.icon];
    return <button type="button" onClick={() => setSelectedId(plugin.id)} className="flex min-w-44 flex-1 items-center gap-3 rounded-2xl border border-border/70 bg-card/75 p-3 text-left transition hover:border-primary/45 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" aria-hidden="true" /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{plugin.name}</span><span className="mt-1 block text-xs text-muted-foreground">Alo · App</span></span></button>;
  };
  const installed = selected ? installState.installedPluginIds.includes(selected.id) : false;
  const enabled = selected ? installState.enabledPluginIds.includes(selected.id) : false;

  return (
    <>
      <section className="space-y-4 rounded-3xl border border-border/70 bg-card/40 p-4 sm:p-6" aria-label="Marketplace-Startseite">
        <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Marketplace-Kategorien">
          {([["recommended", "Empfohlen"], ["new", "Neu"], ["official", "Offiziell"], ["friends", "Von Freunden"]] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setCollection(id)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${collection === id ? "bg-primary text-primary-foreground" : "border border-border/70 bg-background/60 text-muted-foreground hover:text-foreground"}`}>{label}</button>)}
        </nav>
        <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#153a37,#182346)] p-5 text-white sm:p-7"><div className="relative z-10 max-w-md"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300"><Sparkles className="h-4 w-4" /> Neu im Marketplace</p><h2 className="mt-3 text-2xl font-bold sm:text-3xl">Deine nächsten Lieblings-Apps</h2><p className="mt-2 text-sm leading-relaxed text-white/75">Entdecke kuratierte Alo-Apps und Spiele. Installieren und Aktivieren bleiben getrennt von deinem Startbildschirm.</p><button type="button" onClick={() => setCollection("new")} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900">Neu entdecken <ArrowRight className="h-4 w-4" /></button></div><div className="absolute -right-8 -top-12 h-48 w-48 rounded-full border-[22px] border-emerald-300/20" /></div>
        <div><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Vorschläge für dich</h2><button type="button" onClick={() => setCollection("recommended")} className="rounded-full p-2 text-muted-foreground hover:bg-background hover:text-foreground" aria-label="Empfehlungen anzeigen"><ArrowRight className="h-5 w-5" /></button></div><div className="flex gap-3 overflow-x-auto pb-1">{plugins.filter((plugin) => ["alo-sports", "alo-health-app", "alo-training"].includes(plugin.id)).map((plugin) => <CompactCard key={plugin.id} plugin={plugin} />)}</div></div>
        <div><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Beliebte Apps</h2><span className="text-xs text-muted-foreground">{plugins.length} Angebote</span></div><div className="flex gap-3 overflow-x-auto pb-1">{plugins.filter((plugin) => ["alo-sports", "alo-neon-starfighter"].includes(plugin.id)).map((plugin) => <CompactCard key={plugin.id} plugin={plugin} />)}</div></div>
      </section>
      {collection === "friends" && <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">Noch keine Apps von Freunden veröffentlicht. Hier erscheinen nur ausdrücklich freigegebene Apps.</p>}
      <section
        className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6"
        aria-label="Kuratierte Alo-Apps, Bereiche und Werkzeuge"
      >
        {visiblePlugins.map((plugin) => {
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
