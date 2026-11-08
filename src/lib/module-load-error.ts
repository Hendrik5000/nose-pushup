const MODULE_RECOVERY_STORAGE_KEY = "alo-module-load-recovery";
const MODULE_RECOVERY_WINDOW_MS = 60_000;

export type ModuleRecoveryAttempt = {
  identity: string;
  attemptedAt: number;
};

function errorMessage(error: unknown): string {
  return typeof error === "string"
    ? error
    : error !== null &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string"
      ? error.message
      : "";
}

/**
 * Recognize browser module-fetch failures, not errors inside a loaded module.
 * The message alone does not prove a stale deployment: an offline request can
 * fail in the same way. Recovery is therefore online-only and attempted once.
 */
export function isDynamicImportFetchError(error: unknown): boolean {
  return /^(?:Failed to fetch dynamically imported module(?::|$)|error loading dynamically imported module(?::|$)|Importing a module script failed(?:[.:]|$))/i.test(
    errorMessage(error).trim(),
  );
}

export function shouldAutomaticallyRetryModuleLoad(
  error: unknown,
  options: {
    online: boolean;
    pathname: string;
    previousAttempt: ModuleRecoveryAttempt | null;
    now: number;
  },
): boolean {
  if (!options.online || !isDynamicImportFetchError(error)) return false;

  const identity = `${options.pathname}\n${errorMessage(error).trim()}`;
  const previous = options.previousAttempt;
  if (!previous || previous.identity !== identity) return true;
  return options.now - previous.attemptedAt >= MODULE_RECOVERY_WINDOW_MS;
}

/**
 * Retry one failed Vite route-module load with a full document refresh. If the
 * same chunk still fails within a minute, leave the root error screen in place
 * instead of creating a reload loop. If sessionStorage is unavailable, the
 * existing manual recovery screen remains the safe fallback.
 */
export function installModuleLoadRecovery(target: Window): () => void {
  const onPreloadError = (event: Event) => {
    const payload = (event as CustomEvent<{ payload?: unknown }>).detail?.payload;
    let previousAttempt: ModuleRecoveryAttempt | null = null;

    try {
      const stored = target.sessionStorage.getItem(MODULE_RECOVERY_STORAGE_KEY);
      previousAttempt = stored ? (JSON.parse(stored) as ModuleRecoveryAttempt) : null;
    } catch {
      return;
    }

    if (
      !shouldAutomaticallyRetryModuleLoad(payload, {
        online: target.navigator.onLine,
        pathname: target.location.pathname,
        previousAttempt,
        now: Date.now(),
      })
    ) {
      return;
    }

    const nextAttempt: ModuleRecoveryAttempt = {
      identity: `${target.location.pathname}\n${errorMessage(payload).trim()}`,
      attemptedAt: Date.now(),
    };
    try {
      target.sessionStorage.setItem(MODULE_RECOVERY_STORAGE_KEY, JSON.stringify(nextAttempt));
    } catch {
      return;
    }

    event.preventDefault();
    target.location.reload();
  };

  target.addEventListener("vite:preloadError", onPreloadError);
  return () => target.removeEventListener("vite:preloadError", onPreloadError);
}
