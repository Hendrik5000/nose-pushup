/** Cloud side of Nexus Chat: friend DMs, display names and image upload / signed URLs. */

import { supabase } from "@/integrations/supabase/client";
import {
  CHAT_IMAGE_BUCKET,
  CHAT_IMAGE_MAX_EDGE,
  checkChatImageInput,
  checkChatImageOutput,
  chatImagePath,
  fitWithin,
  isChatImagePath,
  needsReencode,
  safeImageName,
  type ChatImageType,
  type ChatTarget,
} from "@/lib/nexus-images";
import {
  BackendNotReadyError,
  asRecord,
  asString,
  isBackendMissing,
  isUuid,
  type RpcResult,
} from "@/lib/friends/rpc";
import type { LocalDm } from "@/lib/local-chat";

const rpc = (name: string, args?: Record<string, unknown>) =>
  (
    supabase as unknown as { rpc(n: string, a?: Record<string, unknown>): PromiseLike<RpcResult> }
  ).rpc(name, args);

export type CloudDm = LocalDm & { is_friend: boolean; other_avatar_url: string | null };

export function parseCloudDms(rows: unknown): CloudDm[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row): CloudDm[] => {
    const r = asRecord(row);
    if (!isUuid(r.conversation_id) || !isUuid(r.other_id)) return [];
    return [
      {
        id: r.conversation_id,
        other_id: r.other_id,
        other_name: asString(r.other_name) ?? "Freund",
        other_avatar_url: asString(r.other_avatar_url),
        last_message_at: asString(r.last_message_at) ?? "",
        is_friend: r.is_friend === true,
      },
    ];
  });
}

export function parseDisplayNames(rows: unknown): Map<string, string> {
  const names = new Map<string, string>();
  if (!Array.isArray(rows)) return names;
  for (const row of rows) {
    const r = asRecord(row);
    if (isUuid(r.user_id)) names.set(r.user_id, asString(r.display_name) ?? "Mitglied");
  }
  return names;
}

export async function loadCloudDms(): Promise<CloudDm[]> {
  const { data, error } = await rpc("get_my_dms");
  if (error) {
    if (isBackendMissing(error)) throw new BackendNotReadyError();
    throw new Error("Direktnachrichten konnten nicht geladen werden.");
  }
  return parseCloudDms(data);
}

/** Only works for accepted friends; the database enforces this. */
export async function openCloudDm(friendId: string): Promise<string> {
  const { data, error } = await rpc("get_or_create_dm", { p_other: friendId });
  if (error) {
    if (isBackendMissing(error)) throw new BackendNotReadyError();
    throw new Error("Nur mit Freunden können Direktnachrichten gestartet werden.");
  }
  if (!isUuid(data)) throw new Error("Die Direktnachricht konnte nicht geöffnet werden.");
  return data;
}

export async function loadDisplayNames(userIds: readonly string[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(userIds.filter(isUuid))).slice(0, 100);
  if (ids.length === 0) return new Map();
  const { data, error } = await rpc("get_chat_display_names", { p_user_ids: ids });
  if (error) return new Map();
  return parseDisplayNames(data);
}

/** Decode, optionally downscale to max 1600 px and re-encode as JPEG. GIFs and small files stay untouched. */
export async function prepareChatImage(
  file: File,
): Promise<{ blob: Blob; type: ChatImageType; name: string }> {
  const input = checkChatImageInput(file);
  if (!input.ok) throw new Error(input.message);

  let blob: Blob = file;
  let type: ChatImageType = input.type;
  if (input.type !== "image/gif") {
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) throw new Error("Das Bild konnte nicht gelesen werden.");
    try {
      if (needsReencode(input.type, file.size, bitmap.width, bitmap.height)) {
        const size = fitWithin(bitmap.width, bitmap.height, CHAT_IMAGE_MAX_EDGE);
        const canvas = document.createElement("canvas");
        canvas.width = size.width;
        canvas.height = size.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Das Bild konnte nicht verkleinert werden.");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size.width, size.height);
        ctx.drawImage(bitmap, 0, 0, size.width, size.height);
        const out = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.85),
        );
        if (!out) throw new Error("Das Bild konnte nicht verkleinert werden.");
        blob = out;
        type = "image/jpeg";
      }
    } finally {
      bitmap.close();
    }
  }
  const output = checkChatImageOutput({ type, size: blob.size });
  if (!output.ok) throw new Error(output.message);
  return { blob, type, name: safeImageName(file.name) };
}

export type UploadedChatImage = {
  path: string;
  type: ChatImageType;
  size: number;
  name: string;
};

export async function uploadChatImage(
  userId: string,
  target: ChatTarget,
  prepared: { blob: Blob; type: ChatImageType; name: string },
): Promise<UploadedChatImage> {
  const path = chatImagePath(userId, target, crypto.randomUUID(), prepared.type);
  const { error } = await supabase.storage.from(CHAT_IMAGE_BUCKET).upload(path, prepared.blob, {
    contentType: prepared.type,
    upsert: false,
    cacheControl: "3600",
  });
  if (error) throw new Error("Das Bild konnte nicht hochgeladen werden.");
  return { path, type: prepared.type, size: prepared.blob.size, name: prepared.name };
}

export async function removeChatImage(path: string): Promise<void> {
  if (!isChatImagePath(path)) return;
  await supabase.storage.from(CHAT_IMAGE_BUCKET).remove([path]);
}

const SIGNED_URL_SECONDS = 60 * 60;

export async function signChatImages(paths: readonly string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter(isChatImagePath)));
  const urls = new Map<string, string>();
  if (unique.length === 0) return urls;
  const { data, error } = await supabase.storage
    .from(CHAT_IMAGE_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_SECONDS);
  if (error || !data) return urls;
  for (const entry of data) {
    if (entry.path && entry.signedUrl && !entry.error) urls.set(entry.path, entry.signedUrl);
  }
  return urls;
}
