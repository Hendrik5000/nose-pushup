/**
 * Recognize browser module-fetch failures, not errors inside a loaded module.
 * The message alone does not prove a stale deployment: an offline request can
 * fail in the same way. The app may retry once while online, then keeps
 * the explicit recovery action in the root error boundary.
 */
export function isDynamicImportFetchError(error: unknown): boolean {
  const message =
    typeof error === "string"
      ? error
      : error !== null &&
          typeof error === "object" &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : "";

  return /^(?:Failed to fetch dynamically imported module(?::|$)|error loading dynamically imported module(?::|$)|Importing a module script failed(?:[.:]|$))/i.test(
    message.trim(),
  );
}

/** Retry only a genuine dynamic-import fetch failure, while online and once per tab. */
export function shouldAutoRetryDynamicImport(
  error: unknown,
  isOnline: boolean,
  alreadyRetried: boolean,
): boolean {
  return isOnline && !alreadyRetried && isDynamicImportFetchError(error);
}
