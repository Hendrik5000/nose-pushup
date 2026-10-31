import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createNexusNotificationPayload,
  getNexusConversationRecipients,
} from "./nexus-notifications";

export const notifyNexusMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    const messageId = String((input as { messageId?: unknown } | null)?.messageId ?? "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId)) {
      throw new Error("Ungültige Nachrichten-ID");
    }
    return { messageId };
  })
  .handler(async ({ data, context }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rawMessage, error } = await supabaseAdmin
        .from("messages" as never)
        .select("id, user_id, room_id, conversation_id, attachment_type" as never)
        .eq("id" as never, data.messageId as never)
        .maybeSingle();
      if (error || !rawMessage) return { ok: false };

      const message = rawMessage as unknown as {
        id: string;
        user_id: string;
        room_id: string | null;
        conversation_id: string | null;
        attachment_type: string | null;
      };
      if (message.user_id !== context.userId || !message.conversation_id || message.room_id) {
        return { ok: false };
      }

      const { data: memberRows, error: memberError } = await supabaseAdmin
        .from("conversation_members" as never)
        .select("user_id" as never)
        .eq("conversation_id" as never, message.conversation_id as never);
      if (memberError || !memberRows) return { ok: false };

      const memberIds = (memberRows as unknown as Array<{ user_id: string }>).map(
        (row) => row.user_id,
      );
      if (!memberIds.includes(context.userId)) return { ok: false };

      const recipients = getNexusConversationRecipients(memberIds, context.userId);
      if (recipients.length === 0) return { ok: true };
      const payload = createNexusNotificationPayload(message);
      if (!payload) return { ok: false };

      const { sendPushNotification } = await import("./push-notifications.server");
      await Promise.all(recipients.map((userId) => sendPushNotification(userId, payload)));
      return { ok: true };
    } catch {
      // Message delivery must not fail just because a push provider is unavailable.
      return { ok: false };
    }
  });
