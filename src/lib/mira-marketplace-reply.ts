import {
  parseMarketplaceMiraManifestReply,
  type MarketplaceAuthoredManifest,
} from "./marketplace-authoring";
import { isExplicitMiraCodeRequest } from "./mira-response-policy";

export type MiraMarketplacePresentation = {
  reply: string;
  manifest?: MarketplaceAuthoredManifest;
};

/** Presentation only: no requests, persistence, permissions, or host actions. */
export function presentMiraMarketplaceReply(
  raw: string,
  userRequest: string,
): MiraMarketplacePresentation {
  if (isExplicitMiraCodeRequest(userRequest)) return { reply: raw };
  const source = raw.replace(/\\"/g, '"');
  const appEnvelope = /"(?:alo_app|manifest)"\s*:\s*\{/i.test(source);
  const directManifest = /"schemaVersion"\s*:/.test(source) && /"blocks"\s*:\s*\[/.test(source);
  if (!appEnvelope && !directManifest) return { reply: raw };

  try {
    const manifest = parseMarketplaceMiraManifestReply(raw);
    return {
      reply: `Lokale Vorschau für „${manifest.name}“. Nicht veröffentlicht; nur diese geprüften Alo-Aktionen sind enthalten. Externe Live-Datenquellen und nicht registrierte Aktionen wurden nicht eingerichtet.`,
      manifest,
    };
  } catch {
    return {
      reply:
        "Der App-Entwurf hat ein nicht unterstütztes Format und kann deshalb nicht sicher als App angezeigt werden. Es wurde keine App gespeichert oder veröffentlicht.",
    };
  }
}
