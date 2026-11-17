/**
 * Zentrale Berechtigungs-Prüfschicht für sensible Aktionen im Alo-Ökosystem.
 * Eine Quelle der Wahrheit dafür, welche Oberflächen-Aktionen als sensibel gelten
 * (Löschen, Abmelden, Bezahlen, Passwort, Admin, Freigaben entziehen, Zurücksetzen).
 * Genutzt von Miras Computer-Use-Navigation: sensible Klicks brauchen eine Bestätigung.
 * Der Marketplace behält zusätzlich sein eigenes, strengeres Freigabesystem
 * (permissionsReviewVersion + grantedActionIds) für App-Aktionen.
 */

export type AloSensitiveActionPattern = Readonly<{
  pattern: RegExp;
  label: string;
}>;

export const ALO_SENSITIVE_ACTION_PATTERNS: readonly AloSensitiveActionPattern[] = Object.freeze([
  { pattern: /l\u00f6sch|loesch/i, label: "L\u00f6schen" },
  { pattern: /entfern/i, label: "Entfernen" },
  { pattern: /abmeld|ausloggen|logout|abmelden/i, label: "Abmelden" },
  { pattern: /zur\u00fccksetzen|zuruecksetzen|reset/i, label: "Zur\u00fccksetzen" },
  { pattern: /bezahlen|zahlung|kasse|checkout|kaufen/i, label: "Bezahlen" },
  { pattern: /passwort/i, label: "Passwort" },
  { pattern: /widerrufen|entziehen/i, label: "Freigabe entziehen" },
  { pattern: /admin/i, label: "Admin" },
  {
    pattern: /konto (?:l\u00f6schen|schlie\u00dfen)|account (?:delete|close)/i,
    label: "Konto ver\u00e4ndern",
  },
]);

export function findSensitiveActionLabel(label: string): string | null {
  if (!label.trim()) return null;
  for (const entry of ALO_SENSITIVE_ACTION_PATTERNS) {
    if (entry.pattern.test(label)) return entry.label;
  }
  return null;
}

export function isSensitiveActionLabel(label: string): boolean {
  return findSensitiveActionLabel(label) !== null;
}
