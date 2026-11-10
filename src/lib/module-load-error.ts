/**
 * Recognize browser module-fetch failures, not errors inside a loaded module.
 * The message alone does not prove a stale deployment: an offline request can
 * fail in the same way. Recovery must remain an explicit user action.
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
