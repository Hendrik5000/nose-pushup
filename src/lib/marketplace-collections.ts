export type MarketplaceCollectionId = "official" | "recommended" | "new" | "friends";

export const MARKETPLACE_COLLECTIONS = [
  { id: "official", label: "Offiziell" },
  { id: "recommended", label: "Empfohlen" },
  { id: "new", label: "Neu" },
  { id: "friends", label: "Von Freunden" },
] as const satisfies readonly { id: MarketplaceCollectionId; label: string }[];

// Curated presentation only: these IDs point to existing, statically registered Alo entries.
// No friend-published apps or publication dates are invented by this local catalogue view.
const RECOMMENDED_MARKETPLACE_IDS = new Set([
  "alo-mira",
  "alo-nexus-chat",
  "alo-health-app",
  "alo-training",
  "alo-smart-coach",
]);

const NEW_MARKETPLACE_IDS = new Set([
  "alo-grid-defense",
  "alo-kupferkern",
  "alo-sports",
  "alo-neon-starfighter",
]);

type MarketplaceCollectionEntry = Readonly<{ id: string; publisher: string }>;

export function getMarketplaceCollectionPlugins<T extends MarketplaceCollectionEntry>(
  plugins: readonly T[],
  collection: MarketplaceCollectionId,
): T[] {
  switch (collection) {
    case "official":
      return plugins.filter((plugin) => plugin.publisher === "Alo");
    case "recommended":
      return plugins.filter((plugin) => RECOMMENDED_MARKETPLACE_IDS.has(plugin.id));
    case "new":
      return plugins.filter((plugin) => NEW_MARKETPLACE_IDS.has(plugin.id));
    case "friends":
      return [];
  }
}
