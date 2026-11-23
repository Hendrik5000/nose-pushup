import { useState } from "react";
import { ArrowRight, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import {
  getMarketplaceCollectionPlugins,
  MARKETPLACE_COLLECTIONS,
  type MarketplaceCollectionId,
} from "@/lib/marketplace-collections";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { MARKETPLACE_ICON_COMPONENTS } from "@/components/marketplace/MarketplaceIcon";
import { FriendAppSharesSection } from "@/components/marketplace/FriendAppSharesSection";
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
  activeCollection: MarketplaceCollectionId;
  onCollectionChange: (collection: MarketplaceCollectionId) => void;
  userId?: string | null;
}>;

export function MarketplaceCollectionSidebar({
  activeCollection,
  onSelect,
}: {
  activeCollection: MarketplaceCollectionId;
  onSelect: (collection: MarketplaceCollectionId) => void;
}) {
  return (
    <nav aria-label="Marketplace-Kategorien" className="space-y-2">
      <p className="px-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Entdecken
      </p>
      <div className="space-y-1">
        {MARKETPLACE_COLLECTIONS.map((collection) => {
          const selected = activeCollection === collection.id;
          return (
            <button
              key={collection.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(collection.id)}
              className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${selected ? "border-primary/30 bg-primary/10 text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:bg-card/70 hover:text-foreground"}`}
            >
              <span>{collection.label}</span>
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${selected ? "bg-primary" : "bg-muted-foreground/30"}`}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function MarketplaceAppCatalog({
  plugins,
  installState,
  ready,
  onInstall,
  onToggle,
  onRemove,
  onOpen,
  activeCollection,
  onCollectionChange,
  userId = null,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const isInstalled = (pluginId: string) => installState.installedPluginIds.includes(pluginId);
  const availablePlugins = plugins.filter((plugin) => !isInstalled(plugin.id));
  const visiblePlugins = getMarketplaceCollectionPlugins(availablePlugins, activeCollection);
  const suggestions = availablePlugins.filter((plugin) =>
    ["alo-sports", "alo-health-app", "alo-training"].includes(plugin.id),
  );
  const popular = availablePlugins.filter((plugin) =>
    ["alo-sports", "alo-neon-starfighter"].includes(plugin.id),
  );
  const selected = plugins.find((plugin) => plugin.id === selectedId) ?? null;
  const similarApps = selected
    ? plugins
        .filter((plugin) => plugin.category === selected.category && plugin.id !== selected.id)
        .slice(0, 6)
    : [];
  const normalizedQuery = query.trim().toLowerCase();
  const searchResults =
    normalizedQuery.length > 0
      ? availablePlugins.filter(
          (plugin) =>
            plugin.name.toLowerCase().includes(normalizedQuery) ||
            plugin.description.toLowerCase().includes(normalizedQuery),
        )
      : null;

  const AppIcon = ({ plugin, size }: { plugin: MarketplacePluginManifest; size: "md" | "lg" }) => {
    const Icon = MARKETPLACE_ICON_COMPONENTS[plugin.icon];
    const box = size === "lg" ? "h-16 w-16 rounded-2xl sm:h-20 sm:w-20" : "h-14 w-14 rounded-2xl";
    const glyph = size === "lg" ? "h-8 w-8 sm:h-10 sm:w-10" : "h-7 w-7";
    return (
      <span
        className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/15 ${box}`}
      >
        <Icon className={glyph} aria-hidden="true" />
      </span>
    );
  };

  const CarouselCard = ({ plugin }: { plugin: MarketplacePluginManifest }) => (
    <button
      type="button"
      onClick={() => setSelectedId(plugin.id)}
      className="flex w-36 shrink-0 flex-col items-start gap-2.5 rounded-2xl p-1 text-left transition hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:w-40"
    >
      <AppIcon plugin={plugin} size="md" />
      <span className="w-full min-w-0">
        <span className="block truncate text-sm font-semibold">{plugin.name}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {CATEGORY_LABELS[plugin.category]} · {plugin.publisher}
        </span>
      </span>
    </button>
  );

  const ListRow = ({ plugin }: { plugin: MarketplacePluginManifest }) => (
    <div className="flex items-center gap-3 rounded-2xl px-1 py-2 transition hover:bg-card/70 sm:gap-4 sm:px-2">
      <button
        type="button"
        aria-label={`${plugin.name}. Details öffnen`}
        onClick={() => setSelectedId(plugin.id)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:gap-4"
      >
        <AppIcon plugin={plugin} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{plugin.name}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {CATEGORY_LABELS[plugin.category]} · {plugin.publisher} · Version {plugin.version}
          </span>
        </span>
      </button>
      <button
        type="button"
        disabled={!ready}
        onClick={() => onInstall(plugin.id, plugin.name)}
        className="min-h-11 shrink-0 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        Installieren
      </button>
    </div>
  );

  return (
    <>
      <form
        role="search"
        onSubmit={(event) => event.preventDefault()}
        className="alo-marketplace-search flex items-center gap-3 rounded-full border border-border bg-card px-4 shadow-sm"
      >
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Apps und Spiele suchen"
          aria-label="Apps und Spiele suchen"
          className="min-h-12 w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Suche zurücksetzen"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </form>
      <nav
        className="alo-marketplace-categories -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden"
        aria-label="Marketplace-Kategorien"
      >
        {MARKETPLACE_COLLECTIONS.map((collection) => (
          <button
            key={collection.id}
            type="button"
            aria-pressed={activeCollection === collection.id}
            onClick={() => {
              onCollectionChange(collection.id);
              setQuery("");
            }}
            className={`min-h-10 shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${activeCollection === collection.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}
          >
            {collection.label}
          </button>
        ))}
      </nav>

      {searchResults ? (
        <section className="space-y-1" aria-label="Suchergebnisse" aria-live="polite">
          <h2 className="px-1 pb-1 text-base font-bold">
            {searchResults.length > 0 ? `${searchResults.length} Treffer` : "Keine Treffer"}
          </h2>
          {searchResults.map((plugin) => (
            <ListRow key={plugin.id} plugin={plugin} />
          ))}
          {searchResults.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border bg-card/40 px-5 py-8 text-center text-sm text-muted-foreground">
              Keine Alo-App passt zu „{query}“. Versuche einen anderen Begriff.
            </p>
          )}
        </section>
      ) : (
        <>
          <section
            className="alo-marketplace-section space-y-6 rounded-3xl border border-border/70 bg-card/40 p-4 sm:p-6"
            aria-label="Marketplace-Startseite"
          >
            <div className="alo-marketplace-feature relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card p-6 sm:p-8">
              <div className="relative z-10 max-w-md">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                  <Sparkles className="h-4 w-4" /> Neu im Marketplace
                </p>
                <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
                  Deine nächsten Lieblings-Apps
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Entdecke kuratierte Alo-Apps und Spiele. Installieren und Aktivieren bleiben
                  getrennt von deinem Startbildschirm.
                </p>
                <button
                  type="button"
                  onClick={() => onCollectionChange("new")}
                  className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
                >
                  Neu entdecken <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            {suggestions.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-lg font-bold">Vorschläge für dich</h2>
                  <button
                    type="button"
                    onClick={() => onCollectionChange("recommended")}
                    className="rounded-full p-2 text-muted-foreground hover:bg-background hover:text-foreground"
                    aria-label="Empfehlungen anzeigen"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </div>
                <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                  {suggestions.map((plugin) => (
                    <CarouselCard key={plugin.id} plugin={plugin} />
                  ))}
                </div>
              </div>
            )}
            {popular.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-lg font-bold">Beliebte Apps</h2>
                  <span className="text-xs text-muted-foreground">
                    {availablePlugins.length} Angebote
                  </span>
                </div>
                <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                  {popular.map((plugin) => (
                    <CarouselCard key={plugin.id} plugin={plugin} />
                  ))}
                </div>
              </div>
            )}
          </section>

          {visiblePlugins.length > 0 ? (
            <section className="space-y-1" aria-label="Kuratierte Alo-Apps, Bereiche und Werkzeuge">
              <h2 className="px-1 pb-1 text-lg font-bold">
                {activeCollection === "official" && "Alle offiziellen Alo-Apps"}
                {activeCollection === "recommended" && "Empfohlene Apps"}
                {activeCollection === "new" && "Neu im Marketplace"}
                {activeCollection === "friends" && "Von Freunden"}
              </h2>
              {visiblePlugins.map((plugin) => (
                <ListRow key={plugin.id} plugin={plugin} />
              ))}
            </section>
          ) : (
            <section
              className="rounded-2xl border border-dashed border-border bg-card/40 px-5 py-10 text-center"
              aria-live="polite"
            >
              {activeCollection === "friends" ? (
                userId ? (
                  <FriendAppSharesSection userId={userId} />
                ) : (
                  <>
                    <p className="text-base font-semibold">Noch keine Apps von Freunden</p>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                      Melde dich an, um Apps zu sehen, die deine Freunde geteilt haben.
                    </p>
                  </>
                )
              ) : (
                <>
                  <p className="text-base font-semibold">Alles installiert</p>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    Alle Apps dieser Kollektion sind bereits auf diesem Gerät installiert und
                    erscheinen dadurch nicht mehr im Marketplace.
                  </p>
                </>
              )}
            </section>
          )}
        </>
      )}

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <DialogContent className="!fixed !left-0 !top-0 !z-50 !m-0 !flex !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 !flex-col !gap-0 !overflow-y-auto !rounded-none !border-0 !p-0 !shadow-none">
          {selected &&
            (() => {
              const installed = isInstalled(selected.id);
              const enabled = installState.enabledPluginIds.includes(selected.id);
              return (
                <section
                  key={selected.id}
                  className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-5 pb-8 pt-16 sm:px-8 sm:pt-20"
                >
                  <div className="flex flex-col items-center text-center">
                    <AppIcon plugin={selected} size="lg" />
                    <DialogTitle className="mt-4 text-2xl font-bold leading-tight sm:text-3xl">
                      {selected.name}
                    </DialogTitle>
                    <p className="mt-1 text-sm font-semibold text-primary">{selected.publisher}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {CATEGORY_LABELS[selected.category]} · Version {selected.version}
                    </p>
                  </div>
                  <div className="mt-6 flex justify-center">
                    {!installed ? (
                      <button
                        type="button"
                        disabled={!ready}
                        onClick={() => onInstall(selected.id, selected.name)}
                        className="min-h-12 rounded-full bg-primary px-8 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Installieren
                      </button>
                    ) : (
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        <button
                          type="button"
                          aria-pressed={enabled}
                          disabled={!ready}
                          onClick={() => onToggle(selected.id, selected.name, enabled)}
                          className="min-h-12 rounded-full bg-primary px-8 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {enabled ? "Deaktivieren" : "Aktivieren"}
                        </button>
                        {installed && enabled && (
                          <button
                            type="button"
                            onClick={() => onOpen(selected.id)}
                            className="min-h-12 rounded-full border border-primary/40 px-6 text-sm font-bold text-primary"
                          >
                            App öffnen
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={!ready}
                          onClick={() => onRemove(selected.id, selected.name)}
                          className="min-h-12 rounded-full border border-border px-6 text-sm font-semibold text-muted-foreground disabled:opacity-50"
                        >
                          Deinstallieren
                        </button>
                      </div>
                    )}
                  </div>
                  <DialogDescription className="mt-8 text-base leading-relaxed text-foreground">
                    {selected.description}
                  </DialogDescription>
                  <section
                    className="alo-marketplace-preview mt-7"
                    aria-label={`Stilisierte Vorschau von ${selected.name} — keine echten Screenshots`}
                  >
                    <h3 className="text-sm font-bold">Vorschau</h3>
                    <div className="-mx-1 mt-3 flex gap-3 overflow-x-auto px-1 pb-1">
                      <div
                        aria-hidden="true"
                        className="flex h-44 w-32 shrink-0 flex-col items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-primary/25 via-primary/10 to-transparent p-3 text-center ring-1 ring-primary/15"
                      >
                        <AppIcon plugin={selected} size="lg" />
                        <span className="text-xs font-semibold leading-snug">{selected.name}</span>
                      </div>
                      {describeMarketplacePermissions(selected)
                        .slice(0, 3)
                        .map((permission) => (
                          <div
                            key={permission}
                            className="flex h-44 w-32 shrink-0 items-end rounded-2xl bg-gradient-to-t from-primary/20 via-primary/5 to-transparent p-3 ring-1 ring-primary/10"
                          >
                            <span className="text-xs font-medium leading-snug text-foreground">
                              {permission}
                            </span>
                          </div>
                        ))}
                    </div>
                    <p className="mt-2 px-1 text-[10px] text-muted-foreground">
                      Stilisierte Darstellung — Alo-Apps nutzen keine externen Screenshots.
                    </p>
                  </section>
                  {similarApps.length > 0 && (
                    <section className="mt-7" aria-label={`Ähnliche Apps wie ${selected.name}`}>
                      <h3 className="text-sm font-bold">Ähnliche Apps</h3>
                      <div className="-mx-1 mt-3 flex gap-3 overflow-x-auto px-1 pb-1">
                        {similarApps.map((plugin) => (
                          <CarouselCard key={plugin.id} plugin={plugin} />
                        ))}
                      </div>
                    </section>
                  )}
                  <section
                    className="mt-7 rounded-2xl border border-border/70 bg-card/60 p-4"
                    aria-label={`Berechtigungen für ${selected.name}`}
                  >
                    <h3 className="flex items-center gap-2 text-sm font-bold">
                      <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" /> Was diese
                      App verwendet
                    </h3>
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
                </section>
              );
            })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
