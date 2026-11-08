export function nexusMessageElementId(messageId: string) {
  return `msg-${encodeURIComponent(messageId)}`;
}

export function nexusScrollBehavior(
  accountPrefersReducedMotion: boolean,
  devicePrefersReducedMotion: boolean,
): ScrollBehavior {
  return accountPrefersReducedMotion || devicePrefersReducedMotion ? "auto" : "smooth";
}
