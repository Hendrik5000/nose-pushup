import { shouldAutoRetryDynamicImport } from "./module-load-error";

const RETRY_KEY = "alo:dynamic-import-recovery-attempted";
const RETRY_RESET_DELAY_MS = 15_000;

/**
 * Vite emits this event when a lazy route chunk cannot be fetched. A single
 * online reload can recover clients holding an older document after a deploy.
 * Offline failures and a second failure stay on the normal error-boundary UI.
 */
export function installDynamicImportRecovery(): void {
  if (typeof window === "undefined") return;

  const onPreloadError = (event: Event) => {
    const error = (event as Event & { payload?: unknown }).payload;
    let alreadyRetried = false;

    try {
      alreadyRetried = window.sessionStorage.getItem(RETRY_KEY) === "1";
    } catch {
      return;
    }

    if (!shouldAutoRetryDynamicImport(error, window.navigator.onLine, alreadyRetried)) {
      return;
    }

    try {
      window.sessionStorage.setItem(RETRY_KEY, "1");
    } catch {
      return;
    }

    event.preventDefault();
    window.location.reload();
  };

  window.addEventListener("vite:preloadError", onPreloadError);
  window.addEventListener(
    "load",
    () => {
      window.setTimeout(() => {
        try {
          window.sessionStorage.removeItem(RETRY_KEY);
        } catch {
          // Storage may be disabled; the manual fallback remains available.
        }
      }, RETRY_RESET_DELAY_MS);
    },
    { once: true },
  );
}
