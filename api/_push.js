/* global process */
// Sending web push notifications. Shared by /api/push (test notification) and /api/notify (reminders).
// Needs VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (make a pair with `npx web-push generate-vapid-keys`).
import webpush from "web-push";

export const SUPABASE_URL = process.env.SUPABASE_URL || "https://joygtqcjjaaalgxmdqjo.supabase.co";
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_SNYogg2ckBJLfnD4tlqZVg_fVkoRvOg";

export const pushReady = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://justsend.fit", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  configured = true;
}

// Sends one notification to one subscription row. Returns "sent", "gone" (the phone or browser
// turned notifications off or was reset, so the row should be deleted) or "failed".
export async function sendPush(sub, message) {
  configure();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ url: "/", ...message }),
      { TTL: 6 * 3600, urgency: "normal" }
    );
    return "sent";
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) return "gone";
    console.error("Push failed", err.statusCode, err.body || err.message);
    return "failed";
  }
}
