/**
 * Sichtbare Alo-Version (Einstellungen).
 *
 * Einzige Stelle, an der die Versionsnummer gepflegt wird. Bei jedem Release hier
 * ALO_VERSION und ALO_VERSION_DATE anpassen und die Änderung in
 * docs/AI-TEAM.md eintragen. Die Nummer ist ein Vorschlag und kann jederzeit geändert werden.
 */
export const ALO_VERSION = "0.1.0";

/** Datum der Version im Format JJJJ-MM-TT. */
export const ALO_VERSION_DATE = "2026-11-16";

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Formatiert ein Datum JJJJ-MM-TT als TT.MM.JJJJ; ungültige Werte werden unverändert zurückgegeben. */
export function formatAloVersionDate(date: string): string {
  const match = DATE_PATTERN.exec(date);
  if (!match) return date;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

/** Lesbare Versionsangabe, z. B. "Alo 0.1.0 · Stand 16.11.2026". */
export function formatAloVersionLabel(
  version: string = ALO_VERSION,
  date: string = ALO_VERSION_DATE,
): string {
  const safeVersion = VERSION_PATTERN.test(version) ? version : "unbekannt";
  return `Alo ${safeVersion} · Stand ${formatAloVersionDate(date)}`;
}
