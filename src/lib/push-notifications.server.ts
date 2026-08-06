import webpush from 'web-push';
import { supabase } from '@/integrations/supabase/client.server';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BEl62vp9IHZisv938A96792I37S0H479S4522409579304957930495793049579304957930495793';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const GCM_API_KEY = process.env.GCM_API_KEY || '';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:support@nosy-pushup.app',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

export async function sendPushNotification(userId: string, payload: { title: string, body: string, url?: string }) {
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId);

  if (error || !subscriptions || subscriptions.length === 0) {
    return;
  }

  const pushPromises = subscriptions.map(async (sub) => {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth
      }
    };

    try {
      await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
    } catch (err: any) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
      }
    }
  });

  await Promise.all(pushPromises);
}
