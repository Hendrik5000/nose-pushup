import { listAlo, removeAlo } from "@/lib/alo-store";
import { validateMarketplaceAuthoredManifest } from "@/lib/marketplace-authoring";
import type { MarketplaceIconId } from "@/lib/marketplace";

export type MiraMarketplaceDraftSummary = Readonly<{
  sessionId: string;
  name: string;
  icon: MarketplaceIconId;
  updatedAt: string;
  providerLabel: string;
}>;

export function miraMarketplaceDraftRecordId(sessionId: string): string {
  return `mira-marketplace-draft:${sessionId}`;
}

export function listMiraMarketplaceDrafts(userId: string): MiraMarketplaceDraftSummary[] {
  if (!userId) return [];
  return listAlo("draft", userId)
    .filter(
      (row) =>
        !row.deleted &&
        row.body.target === "mira-marketplace" &&
        typeof row.body.sessionId === "string",
    )
    .map((row) => {
      try {
        const manifest = validateMarketplaceAuthoredManifest(row.body.manifest);
        return {
          sessionId: String(row.body.sessionId),
          name: manifest.name,
          icon: manifest.icon,
          updatedAt: row.updatedAt,
          providerLabel: typeof row.body.providerLabel === "string" ? row.body.providerLabel : "",
        } satisfies MiraMarketplaceDraftSummary;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is MiraMarketplaceDraftSummary => entry !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function removeMiraMarketplaceDraft(userId: string, sessionId: string): void {
  if (!userId || !sessionId.trim()) return;
  removeAlo(miraMarketplaceDraftRecordId(sessionId), userId);
}
