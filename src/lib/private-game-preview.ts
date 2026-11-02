export function isPrivateGamePreviewOpen(isDevelopment: boolean, search: string): boolean {
  if (!isDevelopment) return false;
  return new URLSearchParams(search).get("preview") === "local";
}
