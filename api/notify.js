/* global process */
// Sends the day's reminders. Called every hour by .github/workflows/reminders.yml with
// CRON_SECRET as a Bearer header. Each run picks out the people whose reminder hour it is
// (in their own time zone), checks what they've logged, and sends at most one workout reminder
// a day, plus food reminders (each meal check and the evening calorie check at most once a day).
// Needs CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY (reads everyone's settings, workout dates and food totals),
// VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.
import { SUPABASE_URL, pushReady, sendPush } from "./_push.js";
import { isDue, isFoodDue, localParts, markFoodSent, pickFoodReminders, pickReminder } from "./_reminders.js";

const DAY = 86400000;

// Either name works: SUPABASE_SECRET_KEY is what Supabase's own Vercel integration sets.
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

function admin(path, options = {}) {
  const key = serviceKey();
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
  if (!serviceKey() || !pushReady()) {
    return res.status(503).json({ error: "Set SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel." });
  }

  const now = new Date();
  const out = { checked: 0, due: 0, sent: 0, removed: 0, kinds: {} };
  try {
    const settings = await admin("/rest/v1/notify_settings?select=*");
    out.checked = settings.length;
    const due = settings
      .map(s => ({ s, workout: isDue(s, now), food: isFoodDue(s, now) }))
      .filter(d => d.workout || d.food);
    out.due = due.length;
    if (!due.length) return res.status(200).json(out);

    const ids = due.map(d => d.s.user_id).join(",");
    const subs = await admin(`/rest/v1/push_subscriptions?select=id,user_id,endpoint,p256dh,auth&user_id=in.(${ids})`);

    // Sends one reminder to all of someone's devices; true if at least one got it.
    const deliver = async (mine, reminder) => {
      const results = await Promise.all(mine.map(async sub => {
        const result = await sendPush(sub, { title: reminder.title, body: reminder.body, tag: reminder.kind });
        if (result === "gone") {
          await admin(`/rest/v1/push_subscriptions?id=eq.${sub.id}`, { method: "DELETE" }).catch(() => {});
          out.removed++;
        }
        return result;
      }));
      if (!results.includes("sent")) return false;
      out.sent++;
      out.kinds[reminder.kind] = (out.kinds[reminder.kind] || 0) + 1;
      return true;
    };

    for (const { s, workout, food } of due) {
      const mine = subs.filter(x => x.user_id === s.user_id);
      if (!mine.length) continue;
      const patch = {};

      if (workout) {
        const [workouts, climbs] = await Promise.all([
          times("workouts", "performed_at", s.user_id, new Date(now - 400 * DAY).toISOString()),
          times("climbs", "created_at", s.user_id, new Date(now - 40 * DAY).toISOString()),
        ]);
        const reminder = pickReminder(s, { workouts, other: climbs }, now);
        if (reminder && (await deliver(mine, reminder))) patch.last_sent = localParts(now, s.tz || "UTC").date;
      }

      if (food) {
        const since = new Date(now - 15 * DAY).toISOString();
        const logs = await admin(`/rest/v1/food_logs?select=eaten_at,meal,kcal&user_id=eq.${s.user_id}&eaten_at=gte.${since}&limit=1000`).catch(() => null);
        const sentKeys = [];
        for (const reminder of pickFoodReminders(s, logs || [], now)) {
          if (await deliver(mine, reminder)) sentKeys.push(reminder.key);
        }
        if (sentKeys.length) patch.food_sent = markFoodSent(s, sentKeys, now);
      }

      if (Object.keys(patch).length) {
        await admin(`/rest/v1/notify_settings?user_id=eq.${s.user_id}`, { method: "PATCH", body: JSON.stringify(patch) })
          .catch(err => console.error(err));
      }
    }
    return res.status(200).json(out);
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: err.message, ...out });
  }
}
