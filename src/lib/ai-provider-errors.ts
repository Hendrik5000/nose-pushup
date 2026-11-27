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
  const candidate = error as {
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
    response?: { status?: unknown };
    cause?: { status?: unknown; statusCode?: unknown; code?: unknown };
  };
  const values = [
    candidate.status,
    candidate.statusCode,
    candidate.response?.status,
    candidate.cause?.status,
    candidate.cause?.statusCode,
    candidate.code,
    candidate.cause?.code,
  ];
  const namedStatuses: Record<string, number> = {
    UNAUTHENTICATED: 401,
    PERMISSION_DENIED: 403,
    INVALID_ARGUMENT: 400,
    NOT_FOUND: 404,
    RESOURCE_EXHAUSTED: 429,
    UNAVAILABLE: 503,
    INTERNAL: 500,
  };
  for (const value of values) {
    if (typeof value === "string" && namedStatuses[value.toUpperCase()]) {
      return namedStatuses[value.toUpperCase()];
    }
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
  if (status === 400) {
    return new Error(
      "Google Gemini hat die Anfrage abgelehnt. Prüfe das ausgewählte Modell und die Anhänge.",
    );
  }
  if (status === 404) {
    return new Error(
      "Das gewählte Gemini-Modell ist aktuell nicht erreichbar oder für deinen API-Key nicht freigeschaltet.",
    );
  }
  if (status === 503 || status === 500) {
    return new Error(
      "Der Google-Gemini-Dienst ist gerade nicht verfügbar. Bitte später erneut versuchen.",
    );
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
