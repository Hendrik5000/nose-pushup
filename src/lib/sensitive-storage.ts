/**
 * Account-scoped secrets and device health caches.
 * Clear on logout / account switch so the next user on a shared device
 * does not inherit API keys or health snapshots.
 */

const GLOBAL_SECRET_KEYS = [
  "super-ai-providers-v1",
  "np-watch-devices",
  "np-watch-snapshot",
  "np-hc-last-sync",
  "np-hc-auto-sync",
  "np-hc-cache",
  "alo-mira-memory-enabled-v1",
  "alo-mira-memory-notes-v1",
] as const;

const PREFIX_KEYS = [
  "super-ai-providers-v1:",
  "np-watch-devices:",
  "np-watch-snapshot:",
  "np-hc-cache:",
  "alo-mira-memory-enabled-v1:",
  "alo-mira-memory-notes-v1:",
] as const;

/** Remove BYOK keys and wearable/health caches from this browser. */
export function clearSensitiveClientStorage(): void {
  if (typeof window === "undefined") return;
  try {
    for (const k of GLOBAL_SECRET_KEYS) {
      window.localStorage.removeItem(k);
    }
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (PREFIX_KEYS.some((p) => key.startsWith(p))) toRemove.push(key);
    }
    for (const k of toRemove) window.localStorage.removeItem(k);
  } catch {
    // ignore quota / private mode
  }
}

export function providersStorageKey(userId: string | null | undefined): string {
  return userId ? `super-ai-providers-v1:${userId}` : "super-ai-providers-v1";
}
