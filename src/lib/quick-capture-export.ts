export type QuickCaptureTextFields = {
  title?: unknown;
  text?: unknown;
  url?: unknown;
};

/** Exports only visible text fields; attachments, account IDs and collection metadata stay out. */
export function serializeQuickCaptureText(fields: QuickCaptureTextFields): string {
  const title = typeof fields.title === "string" ? fields.title.trim() : "";
  const text = typeof fields.text === "string" ? fields.text.trim() : "";
  const url = typeof fields.url === "string" ? fields.url.trim() : "";
  return [title, text, url ? `Link: ${url}` : ""].filter(Boolean).join("\n\n");
}
