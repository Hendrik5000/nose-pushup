export type AloAttachment = { name: string; type: string; data: string };
/** Shared room payloads are untrusted. Never render arbitrary URLs or active documents as downloads. */
export function readAttachment(value: unknown): AloAttachment | null {
  if (!value || typeof value !== "object") return null;
  const a = value as Partial<AloAttachment>;
  if (typeof a.name !== "string" || typeof a.type !== "string" || typeof a.data !== "string")
    return null;
  if (
    !/^(image\/(png|jpeg|webp|gif)|audio\/(webm|ogg|mp4|mpeg|wav)|application\/pdf|text\/plain)(;codecs=[a-zA-Z0-9, .-]+)?$/.test(
      a.type,
    )
  )
    return null;
  const prefix = `data:${a.type};base64,`;
  if (
    !a.data.startsWith(prefix) ||
    a.data.length > 1500000 ||
    !/^[A-Za-z0-9+/=\r\n]*$/.test(a.data.slice(prefix.length))
  )
    return null;
  return { name: a.name.slice(0, 240).replace(/[\r\n/\\]/g, "_"), type: a.type, data: a.data };
}
