/* global process */
// GET: the public VAPID key the app needs to turn notifications on ({ publicKey: null } until it's set up).
// POST with the Supabase access token as a Bearer header: sends a test notification to the
// signed-in person's own phones and browsers.
import { SUPABASE_URL, SUPABASE_ANON_KEY, pushReady, sendPush } from "./_push.js";

function supabaseFetch(path, token, options = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers },
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") return res.status(200).json({ publicKey: pushReady() ? process.env.VAPID_PUBLIC_KEY : null });
  if (req.method !== "POST") return res.status(405).end();

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Sign in first." });
  if (!pushReady()) return res.status(503).json({ error: "Notifications aren't set up on the server yet." });

  try {
    const who = await supabaseFetch("/auth/v1/user", token);
    if (!who.ok) return res.status(401).json({ error: "Sign in again, then try once more." });

    // Row level security limits this to the person's own rows.
    const r = await supabaseFetch("/rest/v1/push_subscriptions?select=id,endpoint,p256dh,auth", token);
    if (!r.ok) return res.status(502).json({ error: "Couldn't load your devices right now." });
    const subs = await r.json();
    if (!subs.length) return res.status(404).json({ error: "Turn notifications on first." });

    const results = await Promise.all(subs.map(async sub => {
      const result = await sendPush(sub, { title: "Notifications are on", body: "This is how SendIt reminders will look.", tag: "test" });
      if (result === "gone") await supabaseFetch(`/rest/v1/push_subscriptions?id=eq.${sub.id}`, token, { method: "DELETE" });
      return result;
    }));
    const sent = results.filter(x => x === "sent").length;
    if (!sent) return res.status(502).json({ error: "Couldn't reach this device. Turn notifications off and on again." });
    return res.status(200).json({ sent });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: "Couldn't send a test right now." });
  }
}
