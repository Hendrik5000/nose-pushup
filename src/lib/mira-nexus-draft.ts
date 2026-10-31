import { getAloOwner, signalAlo } from "@/lib/alo-store";
import { getDraft, saveDraft } from "@/lib/chat-extras";

export type MiraNexusDraftChoice = "append" | "replace";
export type NexusHandoffValidation =
  | { status: "valid"; target: { kind: "room"; id: string; messageId?: string } }
  | { status: "account-changed" | "stale-target" | "invalid" };

export function previewMiraNexusDraft(
  existing: string,
  incoming: string,
  choice: MiraNexusDraftChoice | null,
): string {
  if (!existing.trim() || choice === "replace") return incoming;
  return choice === "append" ? `${existing}\n\n${incoming}` : existing;
}

export function handoffMiraTextToNexus(options: {
  userId: string;
  roomId: string;
  availableRoomIds: readonly string[];
  text: string;
  expectedDraft: string;
  choice: MiraNexusDraftChoice | null;
}): string {
  const { userId, roomId, availableRoomIds, text, expectedDraft, choice } = options;
  if (!userId || getAloOwner() !== userId)
    throw new Error("Konto geändert. Bitte die Aktion erneut öffnen.");
  if (!roomId || !availableRoomIds.includes(roomId))
    throw new Error(
      "Der ausgewählte Nexus-Raum ist nicht mehr verfügbar. Der Entwurf blieb unverändert.",
    );
  if (!text.trim()) throw new Error("Der ausgewählte Mira-Text ist leer.");

  const currentDraft = getDraft(userId, "room", roomId);
  if (currentDraft !== expectedDraft)
    throw new Error("Der Nexus-Entwurf wurde inzwischen geändert. Bitte erneut prüfen.");
  if (currentDraft.trim() && !choice) throw new Error("Bitte wähle Anhängen oder Ersetzen.");

  const nextDraft = previewMiraNexusDraft(currentDraft, text, choice);
  const navigation = JSON.stringify({ kind: "room", id: roomId, userId });
  window.sessionStorage.setItem("alo-open-nexus", navigation);
  try {
    saveDraft(userId, "room", roomId, nextDraft);
  } catch (error) {
    window.sessionStorage.removeItem("alo-open-nexus");
    throw error;
  }
  signalAlo(true);
  return nextDraft;
}

export function validateNexusHandoffTarget(
  raw: string,
  userId: string,
  roomIds: readonly string[],
): NexusHandoffValidation {
  let target: unknown;
  try {
    target = JSON.parse(raw);
  } catch {
    return { status: "invalid" };
  }
  if (!target || typeof target !== "object") return { status: "invalid" };
  const candidate = target as {
    kind?: unknown;
    id?: unknown;
    userId?: unknown;
    messageId?: unknown;
  };
  if (candidate.kind !== "room" || typeof candidate.id !== "string" || !userId)
    return { status: "invalid" };
  if (candidate.userId !== undefined && candidate.userId !== userId)
    return { status: "account-changed" };
  if (!roomIds.includes(candidate.id)) return { status: "stale-target" };
  return {
    status: "valid",
    target: {
      kind: "room",
      id: candidate.id,
      ...(typeof candidate.messageId === "string" ? { messageId: candidate.messageId } : {}),
    },
  };
}
