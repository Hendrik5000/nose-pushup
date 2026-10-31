import webpush from "web-push";
import { supabaseAdmin as supabase } from "@/integrations/supabase/client.server";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
const GCM_API_KEY = process.env.GCM_API_KEY || "";

let vapidConfigured = false;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails("mailto:support@nosy-pushup.app", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidConfigured = true;
  } catch {
    // Keep Cloud Push disabled when the configured key pair is malformed.
  }
}

export async function sendPushNotification(
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string },
) {
  if (!vapidConfigured) return;

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);

  if (error || !subscriptions || subscriptions.length === 0) {
    return;
  }

  const pushPromises = subscriptions.map(async (sub) => {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };

    try {
      await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
    } catch (err: unknown) {
      const status = err && typeof err === "object" && "statusCode" in err ? err.statusCode : null;
      if (status === 404 || status === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  });

  await Promise.all(pushPromises);
}
