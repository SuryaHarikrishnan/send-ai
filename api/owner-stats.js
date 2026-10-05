/* global process */
// Visitor numbers from PostHog for the owner's Stats screen.
// GET with the Supabase access token as a Bearer header. Only owners (public.app_owners, see
// supabase/owner.sql) get an answer; everyone else gets 403.
// Needs POSTHOG_PERSONAL_API_KEY (a PostHog personal API key with the query:read scope).
// Without it, answers { posthog: null } and the Stats screen just shows the Supabase numbers.
// POSTHOG_EXCLUDE_DEMO=1 leaves out the seeded demo data (events with a demo_seed property and
// distinct IDs starting with "bot-"), for once real people are using the app. Until then the
// demo people are added to the user, activity and sports numbers on the Stats screen.
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

// Events that mean someone logged something, and the sport each one belongs to.
const LOGGED = { workout_logged: "lifting", climb_logged: "climbing", food_logged: "food" };
const LOGGED_SQL = `(${Object.keys(LOGGED).map(e => `'${e}'`).join(", ")})`;

const DEMO = "(isNotNull(properties.demo_seed) or startsWith(distinct_id, 'bot-'))";
const REAL_ONLY = process.env.POSTHOG_EXCLUDE_DEMO === "1" ? `and not ${DEMO}` : "";

async function hogql(query) {
  const r = await fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    signal: AbortSignal.timeout(20000),
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

    const queries = [
      hogql(`select uniqIf(person_id, timestamp > now() - interval 1 day), uniqIf(person_id, timestamp > now() - interval 7 day),
                    uniq(person_id), countIf(event = '$pageview'), uniqIf($session_id, $session_id != '')
             from events where timestamp > now() - interval 30 day ${REAL_ONLY}`),
      hogql(`select toDate(timestamp) as d, uniq(person_id), countIf(event = '$pageview')
             from events where timestamp > now() - interval 30 day ${REAL_ONLY} group by d order by d`),
      hogql(`select event, count() as c from events
             where timestamp > now() - interval 30 day and not startsWith(event, '$') ${REAL_ONLY}
             group by event order by c desc limit 8`),
    ];
    // The demo people never touched the database, so their numbers come from PostHog and the
    // Stats screen adds them on top of the real accounts. Left out with POSTHOG_EXCLUDE_DEMO=1.
    if (!REAL_ONLY) queries.push(
      hogql(`select uniq(person_id),
                    uniqIf(person_id, timestamp > now() - interval 1 day), uniqIf(person_id, timestamp > now() - interval 7 day),
                    uniqIf(person_id, timestamp > now() - interval 30 day),
                    countIf(event in ${LOGGED_SQL}), countIf(event in ${LOGGED_SQL} and timestamp > now() - interval 7 day),
                    ${Object.keys(LOGGED).map(e => `uniqIf(person_id, event = '${e}'), countIf(event = '${e}'), countIf(event = '${e}' and timestamp > now() - interval 7 day)`).join(", ")}
             from events where ${DEMO}`),
      hogql(`select toDate(timestamp) as d, uniq(person_id), countIf(event in ${LOGGED_SQL})
             from events where ${DEMO} and timestamp > now() - interval 30 day group by d order by d`),
      hogql(`select toDate(first) as d, count() from (
               select person_id, min(timestamp) as first from events where ${DEMO} group by person_id
             ) group by d order by d`),
    );
    // A failed demo query just leaves the demo numbers out instead of breaking the whole screen.
    const [totals, daily, events, ...demoParts] = await Promise.all(queries.map((q, i) => (i < 3 ? q : q.catch(err => { console.error(err); return null; }))));
    const [demoAll, demoDaily, demoJoined] = demoParts.some(x => x == null) ? [] : demoParts;

    let demo = null;
    if (demoAll) {
      const [people, a1, a7, a30, entries, entries7, ...perSport] = demoAll[0] || [];
      const weekAgo = Date.now() - 7 * 86400000, monthAgo = Date.now() - 30 * 86400000;
      const joinedSince = t => demoJoined.filter(([day]) => new Date(day).getTime() > t).reduce((a, [, n]) => a + n, 0);
      const joined = new Map(demoJoined.map(([day, n]) => [day, n]));
      demo = {
        users: { total: people || 0, new_7d: joinedSince(weekAgo), new_30d: joinedSince(monthAgo) },
        active: { d1: a1 || 0, d7: a7 || 0, d30: a30 || 0 },
        entries: { total: entries || 0, d7: entries7 || 0 },
        sports: Object.values(LOGGED).map((sport, i) => ({
          sport, users: perSport[i * 3] || 0, entries: perSport[i * 3 + 1] || 0, entries_7d: perSport[i * 3 + 2] || 0,
        })),
        daily: demoDaily.map(([day, active, logged]) => ({ day, active, entries: logged, signups: joined.get(day) || 0 })),
      };
    }

    const [d1, d7, d30, pageviews, sessions] = totals[0] || [];
    return res.status(200).json({
      posthog: {
        visitors: { d1: d1 || 0, d7: d7 || 0, d30: d30 || 0 },
        pageviews_30d: pageviews || 0,
        sessions_30d: sessions || 0,
        daily: daily.map(([day, visitors, views]) => ({ day, visitors, pageviews: views })),
        events: events.map(([name, count]) => ({ name, count })),
        demo,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: "Couldn't reach PostHog right now." });
  }
}
