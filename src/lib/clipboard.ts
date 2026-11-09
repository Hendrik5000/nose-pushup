type ClipboardWriter = {
  writeText: (text: string) => Promise<void>;
};

export async function copyTextToClipboard(
  text: string,
  writer?: ClipboardWriter,
): Promise<boolean> {
  const clipboard =
    writer ??
    (typeof navigator !== "undefined" && navigator.clipboard ? navigator.clipboard : undefined);
  if (!clipboard) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
