const MAX_TITLE_CHARS = 32;
const MAX_TITLE_WORDS = 3;

const TITLE_STOP_WORDS = new Set([
  "aber",
  "am",
  "an",
  "auf",
  "aus",
  "bei",
  "bitte",
  "das",
  "dass",
  "dein",
  "deine",
  "dem",
  "den",
  "der",
  "des",
  "die",
  "du",
  "ein",
  "eine",
  "einem",
  "einen",
  "einer",
  "eines",
  "erklären",
  "erkläre",
  "erklär",
  "erläutern",
  "erläutere",
  "helfen",
  "helfe",
  "hilf",
  "für",
  "ich",
  "im",
  "in",
  "ist",
  "kann",
  "kannst",
  "können",
  "könntest",
  "man",
  "mein",
  "meine",
  "meinem",
  "meinen",
  "meiner",
  "mit",
  "mir",
  "mich",
  "nach",
  "oder",
  "sag",
  "sage",
  "schreib",
  "schreiben",
  "über",
  "und",
  "vom",
  "von",
  "was",
  "wie",
  "zeigen",
  "zeig",
  "zu",
]);

const REQUEST_PREFIXES = [
  /^(?:hey\s+)?mira\s*[,!:–—-]?\s*/iu,
  /^(?:(?:kannst|könntest|würdest)\s+du(?:\s+mir)?(?:\s+bitte)?(?:\s+kurz)?|bitte)\s+/iu,
  /^(?:(?:erkläre|erklär|erläutere|erläuter|zeige|zeig|sage|sag|schreibe|schreib|helfe|hilf|nenne|nenn|fasse|fass)\s+mir(?:\s+bitte)?|ich\s+(?:möchte|will|würde\s+gern)\s+wissen)\s+/iu,
  /^(?:(?:kurz|mal)\s+)?(?:erklären|erkläre|erklär|erläutern|erläutere|zeigen|sagen|schreiben|helfen|nennen|zusammenfassen)\b\s*[,;:]?\s*/iu,
  /^(?:was\s+(?:ist|bedeutet)|wie\s+(?:funktioniert|kann\s+ich|bekomme\s+ich)|wo\s+finde\s+ich|warum\s+ist)\s+/iu,
];

/** Create a short, word-boundary-safe label from a Mira conversation's first message. */
export function createMiraChatTitle(input: string): string {
  const normalized = input.replace(/\s+/gu, " ").trim();
  if (!normalized) return "Neuer Chat";

  const firstSentence = normalized.split(/(?<=[!?])\s+|(?<=\.)\s+(?=\p{Lu})/u, 1)[0] ?? normalized;
  let candidate = firstSentence.replace(/[.!?]+$/u, "").trim();

  for (const prefix of REQUEST_PREFIXES) candidate = candidate.replace(prefix, "");
  candidate = candidate.replace(/^[,;:–—-]+\s*/u, "").trim();
  if (!candidate) candidate = firstSentence.replace(/[.!?]+$/u, "").trim();

  const words = candidate.match(/[\p{L}\p{N}]+(?:[’'/-][\p{L}\p{N}]+)*/gu) ?? [];
  const meaningfulWords = words.filter(
    (word) => !TITLE_STOP_WORDS.has(word.toLocaleLowerCase("de-DE")),
  );
  if (!meaningfulWords.length) return "Neuer Chat";

  const titleWords: string[] = [];
  for (const word of meaningfulWords) {
    if (titleWords.length >= MAX_TITLE_WORDS) break;
    const next = [...titleWords, word].join(" ");
    if (next.length > MAX_TITLE_CHARS) break;
    titleWords.push(word);
  }

  const title = titleWords.join(" ").replace(/[\s,;:–—-]+$/u, "");
  if (!title) return "Neuer Chat";
  return title[0].toLocaleUpperCase("de-DE") + title.slice(1);
}
