import type { MarketplacePublishedVersion } from "@/lib/marketplace-authoring";

export type MarketplaceChatAuthoringIntent = "create" | "edit-draft" | "edit-published";

const APP_WORD = /\b(?:alo\s*[- ]?\s*)?apps?\b/i;
const CREATE_REQUEST =
  /\b(?:bau(?:e|en)?|erstell(?:e|en)?|entwerf(?:e|en)?|entwickl(?:e|en)?|gestalt(?:e|en)?|mach(?:e|en)?|create|build|design)\b/i;
const EDIT_REQUEST =
  /\b(?:änder(?:e|n)?|aender(?:e|n)?|bearbeit(?:e|en)|aktualisier(?:e|en)|verbesser(?:e|n)|überarbeit(?:e|en)|ueberarbeit(?:e|en)|pass(?:e|t)?\s+an|anpass(?:e|en)|mach(?:e|en)?|füge|fuege|ergänz(?:e|en)|ergaenz(?:e|en)|entfern(?:e|en)|ersetz(?:e|en)|benenn(?:e|en)|setz(?:e|en)|kürz(?:e|n)|kuerz(?:e|n)|verlänger(?:e|n)|verlaenger(?:e|n)|gestalt(?:e|en)|edit|update|change|redesign|add|remove|replace)\b/i;
const DIRECT_DRAFT_EDIT =
  /^(?:mira[,:\s]+)?(?:bitte\s+)?(?:änder(?:e|n)?|aender(?:e|n)?|bearbeit(?:e|en)|aktualisier(?:e|en)|verbesser(?:e|n)|überarbeit(?:e|n)|ueberarbeit(?:e|en)|pass(?:e|t)?\s+an|mach(?:e|en)?|füge|fuege|ergänz(?:e|en)|ergaenz(?:e|en)|entfern(?:e|en)|ersetz(?:e|en)|benenn(?:e|en)|setz(?:e|en)|kürz(?:e|n)|kuerz(?:e|n)|verlänger(?:e|en)|verlaenger(?:e|en)|gestalt(?:e|en)|edit|update|change|redesign|add|remove|replace)\b/i;
const DRAFT_OBJECT =
  /\b(?:app|entwurf|vorschau|button|schaltfläche|schaltflaeche|text|farbe|liste|überschrift|ueberschrift|aktion|layout|seite|block|absatz)\b/i;
const EXPLICITLY_NEW = /\b(?:neue|weiter(?:e|en)?|ander(?:e|en))\s+(?:alo\s*[- ]?\s*)?apps?\b/i;
const WANTS_APP =
  /\b(?:ich\s+(?:möchte|moechte|will|brauche|hätte\s+gern|haette\s+gern|wünsche\s+mir|wuensche\s+mir)|wir\s+(?:möchten|moechten|wollen|brauchen))\b/i;
const NEGATED_APP_REQUEST =
  /\b(?:kein(?:e[nr]?)?|ohne)\s+(?:(?:neu(?:e|en|er)|weitere[nr]?|eigene[nr]?|alo)\s+)*apps?\b/i;
const INFORMATION_QUESTION =
  /^(?:mira[,:]\s*)?(?:wie|warum|wo|wann|wer|was)\b|^(?:mira[,:]\s*)?(?:erklär(?:e|en)?|erklaer(?:e|en)?)\b/i;
const APP_OVERVIEW_REQUEST =
  /\bapps?\s*[- ]\s*(?:übersicht|uebersicht|liste|tipps|vergleich|ratgeber|erklärung|erklaerung)\b|\b(?:übersicht|uebersicht|liste|tipps|vergleich|ratgeber|erklärung|erklaerung)\s+(?:zu|über|ueber|von)\s+apps?\b/i;

/** Recognize explicit app-building requests in a single ordinary Mira message only. */
export function classifyMarketplaceChatIntent(
  text: string,
  hasActiveDraft = false,
  activeDraftName?: string,
): MarketplaceChatAuthoringIntent | null {
  const message = text.normalize("NFKC").trim();
  if (!message) return null;
  if (
    INFORMATION_QUESTION.test(message) ||
    NEGATED_APP_REQUEST.test(message) ||
    APP_OVERVIEW_REQUEST.test(message)
  ) {
    return null;
  }

  if (APP_WORD.test(message) && EXPLICITLY_NEW.test(message) && CREATE_REQUEST.test(message)) {
    return "create";
  }

  if (hasActiveDraft && EDIT_REQUEST.test(message)) {
    const normalizedMessage = normalizeAppName(message);
    const referencesActiveName =
      activeDraftName !== undefined &&
      normalizedMessage.includes(normalizeAppName(activeDraftName));
    const refersToCurrentDraft = /\b(?:diese[rn]?|den|dem)\s+(?:app|entwurf|vorschau)\b/i.test(
      message,
    );
    if (
      referencesActiveName ||
      refersToCurrentDraft ||
      (!APP_WORD.test(message) && (DIRECT_DRAFT_EDIT.test(message) || DRAFT_OBJECT.test(message)))
    ) {
      return "edit-draft";
    }
  }

  if (APP_WORD.test(message) && EDIT_REQUEST.test(message)) return "edit-published";
  if (APP_WORD.test(message) && (CREATE_REQUEST.test(message) || WANTS_APP.test(message))) {
    return "create";
  }
  return null;
}

function normalizeAppName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
}

export type MarketplaceAppReference =
  | { status: "matched"; app: MarketplacePublishedVersion }
  | { status: "none"; apps: readonly MarketplacePublishedVersion[] }
  | { status: "ambiguous"; apps: readonly MarketplacePublishedVersion[] };

/** Match only an exact published app name in the message and only among apps the admin can manage. */
export function findMarketplaceAppReference(
  text: string,
  apps: readonly MarketplacePublishedVersion[],
): MarketplaceAppReference {
  const message = normalizeAppName(text);
  const manageable = apps.filter((app) => app.canManage);
  const matches = manageable.filter((app) => {
    const name = normalizeAppName(app.manifest.name);
    return name.length >= 2 && message.includes(name);
  });
  if (!matches.length) return { status: "none", apps: manageable };

  const longestNameLength = Math.max(
    ...matches.map((app) => normalizeAppName(app.manifest.name).length),
  );
  const mostSpecific = matches.filter(
    (app) => normalizeAppName(app.manifest.name).length === longestNameLength,
  );
  if (mostSpecific.length !== 1) return { status: "ambiguous", apps: mostSpecific };
  return { status: "matched", app: mostSpecific[0] };
}
