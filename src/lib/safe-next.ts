const REDIRECT_BASE = "https://alo.invalid";

export function safeNext(raw: unknown): string {
  if (
    typeof raw !== "string" ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("\\") ||
    [...raw].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 0x1f || code === 0x7f;
    })
  ) {
    return "/";
  }

  try {
    const destination = new URL(raw, REDIRECT_BASE);
    if (destination.origin !== REDIRECT_BASE || destination.pathname.startsWith("//")) return "/";
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/";
  }
}
