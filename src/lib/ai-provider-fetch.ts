/** Never follow a provider redirect: it could forward BYOK credentials or private input.
 * `error` is not implemented by the deployed worker fetch runtime; inspect manual responses.
 */
export async function fetchAiProvider(
  input: string,
  init: RequestInit,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const response = await fetcher(input, { ...init, redirect: "manual" });
  if ((response.status >= 300 && response.status < 400) || response.type === "opaqueredirect") {
    await response.body?.cancel();
    throw new Error(
      "KI-Anbieter hat eine Weiterleitung zurückgegeben. Aus Sicherheitsgründen wurde sie nicht verfolgt. Bitte die Anbieter-URL prüfen.",
    );
  }
  return response;
}
