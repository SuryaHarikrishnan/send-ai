/* global process */
// Sends the day's reminders. Called every hour by .github/workflows/reminders.yml with
// CRON_SECRET as a Bearer header. Each run picks out the people whose reminder hour it is
// (in their own time zone), checks what they've logged, and sends at most one reminder a day.
// Needs CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY (reads everyone's settings and workout dates),
// VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.
import { SUPABASE_URL, pushReady, sendPush } from "./_push.js";
import { isDue, localParts, pickReminder } from "./_reminders.js";

const DAY = 86400000;

function admin(path, options = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Older service_role keys are JWTs and go in Authorization too; newer sb_secret_ keys only in apikey.
  const auth = key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {};
  return fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: { apikey: key, ...auth, "Content-Type": "application/json", ...options.headers },
  }).then(async r => {
    if (!r.ok) throw new Error(`Supabase ${r.status} on ${path.split("?")[0]}: ${(await r.text()).slice(0, 200)}`);
    return r.status === 204 ? null : r.json();
  });
}

// Times of what someone logged, or [] when that table doesn't exist yet.
const times = (table, column, userId, since) =>
  admin(`/rest/v1/${table}?select=${column}&user_id=eq.${userId}&${column}=gte.${since}&order=${column}.desc&limit=1000`)
    .then(rows => rows.map(r => r[column]), () => []);

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).end();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !pushReady()) {
    return res.status(503).json({ error: "Set SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel." });
  }

  const now = new Date();
  const out = { checked: 0, due: 0, sent: 0, removed: 0, kinds: {} };
  try {
    const settings = await admin("/rest/v1/notify_settings?select=*");
    out.checked = settings.length;
    const due = settings.filter(s => isDue(s, now));
    out.due = due.length;
    if (!due.length) return res.status(200).json(out);

    const ids = due.map(s => s.user_id).join(",");
    const subs = await admin(`/rest/v1/push_subscriptions?select=id,user_id,endpoint,p256dh,auth&user_id=in.(${ids})`);

    for (const s of due) {
      const mine = subs.filter(x => x.user_id === s.user_id);
      if (!mine.length) continue;
      const [workouts, climbs] = await Promise.all([
        times("workouts", "performed_at", s.user_id, new Date(now - 400 * DAY).toISOString()),
        times("climbs", "created_at", s.user_id, new Date(now - 40 * DAY).toISOString()),
      ]);
      const reminder = pickReminder(s, { workouts, other: climbs }, now);
      if (!reminder) continue;

      const results = await Promise.all(mine.map(async sub => {
        const result = await sendPush(sub, { title: reminder.title, body: reminder.body, tag: "reminder" });
        if (result === "gone") {
          await admin(`/rest/v1/push_subscriptions?id=eq.${sub.id}`, { method: "DELETE" }).catch(() => {});
          out.removed++;
        }
        return result;
      }));
      if (results.includes("sent")) {
        out.sent++;
        out.kinds[reminder.kind] = (out.kinds[reminder.kind] || 0) + 1;
        await admin(`/rest/v1/notify_settings?user_id=eq.${s.user_id}`, {
          method: "PATCH",
          body: JSON.stringify({ last_sent: localParts(now, s.tz || "UTC").date }),
        }).catch(err => console.error(err));
      }
    }
    return res.status(200).json(out);
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: err.message, ...out });
  }
}
