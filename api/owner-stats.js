/* global process */
// Visitor numbers from PostHog for the owner's Stats screen.
// GET with the Supabase access token as a Bearer header. Only owners (public.app_owners, see
// supabase/owner.sql) get an answer; everyone else gets 403.
// Needs POSTHOG_PERSONAL_API_KEY (a PostHog personal API key with the query:read scope).
// Without it, answers { posthog: null } and the Stats screen just shows the Supabase numbers.
// POSTHOG_EXCLUDE_DEMO=1 leaves out the seeded demo data (events with a demo_seed property and
// distinct IDs starting with "bot-"), for once real people are using the app.
const SUPABASE_URL = process.env.SUPABASE_URL || "https://joygtqcjjaaalgxmdqjo.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_SNYogg2ckBJLfnD4tlqZVg_fVkoRvOg";
const POSTHOG_HOST = process.env.POSTHOG_HOST || "https://us.posthog.com";
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID || "645901";

async function isOwner(token) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_owner`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  return r.ok && (await r.json()) === true;
}

const REAL_ONLY = process.env.POSTHOG_EXCLUDE_DEMO === "1"
  ? "and isNull(properties.demo_seed) and not startsWith(distinct_id, 'bot-')"
  : "";

async function hogql(query) {
  const r = await fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`PostHog ${r.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data.results || [];
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Sign in first." });

  try {
    if (!(await isOwner(token))) return res.status(403).json({ error: "Only the app owner can see these stats." });
    res.setHeader("Cache-Control", "no-store");
    if (!process.env.POSTHOG_PERSONAL_API_KEY) return res.status(200).json({ posthog: null });

    const [totals, daily, events] = await Promise.all([
      hogql(`select uniqIf(person_id, timestamp > now() - interval 1 day), uniqIf(person_id, timestamp > now() - interval 7 day),
                    uniq(person_id), countIf(event = '$pageview'), uniqIf($session_id, $session_id != '')
             from events where timestamp > now() - interval 30 day ${REAL_ONLY}`),
      hogql(`select toDate(timestamp) as d, uniq(person_id), countIf(event = '$pageview')
             from events where timestamp > now() - interval 30 day ${REAL_ONLY} group by d order by d`),
      hogql(`select event, count() as c from events
             where timestamp > now() - interval 30 day and not startsWith(event, '$') ${REAL_ONLY}
             group by event order by c desc limit 8`),
    ]);
    const [d1, d7, d30, pageviews, sessions] = totals[0] || [];
    return res.status(200).json({
      posthog: {
        visitors: { d1: d1 || 0, d7: d7 || 0, d30: d30 || 0 },
        pageviews_30d: pageviews || 0,
        sessions_30d: sessions || 0,
        daily: daily.map(([day, visitors, views]) => ({ day, visitors, pageviews: views })),
        events: events.map(([name, count]) => ({ name, count })),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: "Couldn't reach PostHog right now." });
  }
}
