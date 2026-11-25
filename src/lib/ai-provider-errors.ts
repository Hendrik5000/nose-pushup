export function normalizeProviderApiKey(value: unknown): string {
  if (typeof value !== "string") return "";
  const key = value.trim();
  const hasControlCharacters = Array.from(key).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
  if (key.length > 500 || hasControlCharacters) {
    throw new Error("API-Key ungültig oder zu lang.");
  }
  return key;
}

function statusFrom(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { status?: unknown; code?: unknown };
  for (const value of [candidate.status, candidate.code]) {
    const status = typeof value === "number" ? value : Number(value);
    if (Number.isInteger(status) && status >= 400 && status < 600) return status;
  }
  return null;
}

export function safeGeminiError(error: unknown): Error {
  const status = statusFrom(error);
  if (status === 401 || status === 403) {
    return new Error("Google Gemini hat den API-Key abgelehnt oder der Key ist nicht berechtigt.");
  }
  if (status === 429) {
    return new Error(
      "Das Google-Gemini-Anfragelimit oder Kontingent ist erreicht. Bitte später erneut versuchen.",
    );
  }
  if (status === 404) {
    return new Error("Das gewählte Gemini-Modell ist aktuell nicht erreichbar.");
  }
  return new Error(
    "Die Gemini-Anfrage ist fehlgeschlagen. Providerdetails wurden zum Schutz deiner Daten ausgeblendet.",
  );
}

export function safeOpenRouterErrorMessage(status: number): string {
  if (status === 401 || status === 403) {
    return "OpenRouter hat den API-Key abgelehnt oder der Key ist nicht berechtigt.";
  }
  if (status === 429) {
    return "Das OpenRouter-Anfragelimit ist erreicht. Bitte später erneut versuchen.";
  }
  return `Die OpenRouter-Anfrage ist fehlgeschlagen (HTTP ${status}). Providerdetails wurden zum Schutz deiner Daten ausgeblendet.`;
}
