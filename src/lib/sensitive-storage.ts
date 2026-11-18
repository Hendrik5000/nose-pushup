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
  "alo-mira-persona-mix-v1",
] as const;

const PREFIX_KEYS = [
  "super-ai-providers-v1:",
  "np-watch-devices:",
  "np-watch-snapshot:",
  "np-hc-cache:",
  "alo-mira-memory-enabled-v1:",
  "alo-mira-memory-notes-v1:",
  "alo-mira-persona-mix-v1:",
] as const;

/** Remove BYOK keys and wearable/health caches from this browser. */
export function clearSensitiveClientStorage(): void {
  if (typeof window === "undefined") return;
  for (const storageName of ["sessionStorage", "localStorage"] as const) {
    try {
      const storage = window[storageName];
      for (const k of GLOBAL_SECRET_KEYS) storage.removeItem(k);
      const toRemove: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key) continue;
        if (PREFIX_KEYS.some((prefix) => key.startsWith(prefix))) toRemove.push(key);
      }
      for (const k of toRemove) storage.removeItem(k);
    } catch {
      // One storage API may be unavailable (e.g. private browsing); still clear the other.
    }
  }
    // ignore quota / private mode
  }
}

export function providersStorageKey(userId: string | null | undefined): string {
  return userId ? `super-ai-providers-v1:${userId}` : "super-ai-providers-v1";
}
