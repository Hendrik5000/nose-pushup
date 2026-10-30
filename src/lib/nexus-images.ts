/** Pure helpers for chat images. Storage rules are enforced again by the database. */

export const CHAT_IMAGE_BUCKET = "chat-uploads";
export const CHAT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const CHAT_IMAGE_MAX_EDGE = 1600;
/** Files at or below this size and edge length are uploaded unchanged. */
export const CHAT_IMAGE_KEEP_BYTES = 1.5 * 1024 * 1024;

export const CHAT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type ChatImageType = (typeof CHAT_IMAGE_TYPES)[number];

const EXTENSION: Record<ChatImageType, "jpg" | "png" | "webp" | "gif"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function isChatImageType(type: string): type is ChatImageType {
  return (CHAT_IMAGE_TYPES as readonly string[]).includes(type);
}

export function chatImageExtension(type: ChatImageType): "jpg" | "png" | "webp" | "gif" {
  return EXTENSION[type];
}

export type ImageCheck = { ok: true; type: ChatImageType } | { ok: false; message: string };

export function checkChatImageInput(file: { type: string; size: number }): ImageCheck {
  if (!isChatImageType(file.type)) {
    return { ok: false, message: "Nur JPEG, PNG, WebP oder GIF sind erlaubt." };
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, message: "Die Bilddatei ist leer." };
  }
  return { ok: true, type: file.type };
}

export function checkChatImageOutput(blob: { type: string; size: number }): ImageCheck {
  const base = checkChatImageInput(blob);
  if (!base.ok) return base;
  if (blob.size > CHAT_IMAGE_MAX_BYTES) {
    return { ok: false, message: "Das Bild ist größer als 5 MB." };
  }
  return base;
}

/** Scale to fit into max x max while keeping the aspect ratio. Never upscales. */
export function fitWithin(
  width: number,
  height: number,
  max: number = CHAT_IMAGE_MAX_EDGE,
): { width: number; height: number; scaled: boolean } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0, scaled: false };
  const longest = Math.max(width, height);
  if (longest <= max)
    return { width: Math.round(width), height: Math.round(height), scaled: false };
  const factor = max / longest;
  return {
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor)),
    scaled: true,
  };
}

/** Animated GIFs are never re-encoded; everything else is resized when large. */
export function needsReencode(
  type: ChatImageType,
  size: number,
  width: number,
  height: number,
): boolean {
  if (type === "image/gif") return false;
  return size > CHAT_IMAGE_KEEP_BYTES || fitWithin(width, height).scaled;
}

export type ChatTarget = { kind: "room" | "dm"; id: string };

export function chatImagePath(
  userId: string,
  target: ChatTarget,
  fileId: string,
  type: ChatImageType,
): string {
  const scope = `${target.kind === "room" ? "room" : "conv"}-${target.id}`;
  return `${userId}/${scope}/${fileId}.${chatImageExtension(type)}`.toLowerCase();
}

const PATH_PATTERN =
  /^[0-9a-f-]{36}\/(conv|room)-[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;

export function isChatImagePath(path: unknown): path is string {
  return typeof path === "string" && PATH_PATTERN.test(path);
}

export function safeImageName(name: string): string {
  const cleaned = Array.from(name)
    .filter((char) => char.charCodeAt(0) > 31 && char !== "\\" && char !== "/")
    .join("")
    .trim();
  return (cleaned || "Bild").slice(0, 200);
}
