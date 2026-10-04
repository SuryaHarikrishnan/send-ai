// The coach only answers signed-in users, builds its prompt from their own
// climbs, and allows DAILY_LIMIT questions per user per day.
const SUPABASE_URL = process.env.SUPABASE_URL || "https://joygtqcjjaaalgxmdqjo.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_SNYogg2ckBJLfnD4tlqZVg_fVkoRvOg";
const DAILY_LIMIT = 10;

function supabaseFetch(path, token, options = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

function buildPrompt(mode, climbs, goalGrade) {
  const summary = {
    totalClimbs: climbs.length,
    sends: climbs.filter(c => c.sent).length,
    grades: climbs.map(c => c.grade),
    holdTypes: climbs.map(c => c.hold_type),
    angles: climbs.map(c => c.wall_angle),
    styles: climbs.map(c => c.style),
    recentClimbs: climbs.slice(-10),
  };

  if (mode === "diagnosis") {
    return `You are a concise expert climbing coach. Analyze this climber's data and give a plateau diagnosis.

Climber data: ${JSON.stringify(summary)}

Respond in exactly this format, no markdown symbols, no hashtags, no asterisks:

WHY YOU'RE PLATEAUING
2-3 sentences max. Be direct and specific to their data.

TOP 3 WEAKNESSES
1. [weakness] - one sentence
2. [weakness] - one sentence
3. [weakness] - one sentence

NEXT 4 WEEKS
Focus on: [specific thing]
Drill: [specific exercise]
Volume: [specific recommendation]

Keep it short, sharp, and actionable. No fluff.`;
  }

  return `You are a concise expert climbing coach. Create a training plan for this climber.

Climber data: ${JSON.stringify(summary)}
Goal grade: ${goalGrade || "one grade above current top send"}

Respond in exactly this format, no markdown symbols, no hashtags, no asterisks:

WEEK 1 - [focus area]
[2-3 specific exercises with sets/reps]

WEEK 2 - [focus area]
[2-3 specific exercises with sets/reps]

WEEK 3 - [focus area]
[2-3 specific exercises with sets/reps]

WEEK 4 - [focus area]
[2-3 specific exercises with sets/reps]

Keep each week concise. No fluff. Climbing terminology only.`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Please sign in to use the coach." });

  try {
    const userRes = await supabaseFetch("/auth/v1/user", token);
    if (!userRes.ok) return res.status(401).json({ error: "Please sign in to use the coach." });
    const user = await userRes.json();

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const countRes = await supabaseFetch(
      `/rest/v1/coach_requests?select=id&user_id=eq.${user.id}&created_at=gte.${startOfDay.toISOString()}`,
      token,
      { method: "HEAD", headers: { Prefer: "count=exact" } }
    );
    if (!countRes.ok) throw new Error(`coach_requests count failed: ${countRes.status}`);
    const used = Number((countRes.headers.get("content-range") || "").split("/")[1] || 0);
    if (used >= DAILY_LIMIT) {
      return res.status(429).json({ error: `You've used all ${DAILY_LIMIT} coach questions for today. Try again tomorrow.` });
    }

    const climbsRes = await supabaseFetch(
      `/rest/v1/climbs?select=grade,style,wall_angle,hold_type,attempts,sent,notes,created_at&user_id=eq.${user.id}&order=created_at.asc`,
      token
    );
    if (!climbsRes.ok) throw new Error(`climbs fetch failed: ${climbsRes.status}`);
    const climbs = await climbsRes.json();
    if (climbs.length < 3) return res.status(400).json({ error: "Log at least 3 climbs to unlock AI coaching." });

    const { mode, goalGrade } = req.body || {};
    const prompt = buildPrompt(
      mode === "plan" ? "plan" : "diagnosis",
      climbs,
      typeof goalGrade === "string" ? goalGrade.slice(0, 20) : ""
    );

    const logRes = await supabaseFetch("/rest/v1/coach_requests", token, {
      method: "POST",
      body: JSON.stringify({ user_id: user.id }),
    });
    if (!logRes.ok) throw new Error(`coach_requests insert failed: ${logRes.status}`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error(`Gemini returned no text: ${JSON.stringify(data).slice(0, 500)}`);

    res.status(200).json({ text });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "The coach couldn't answer right now. Try again in a minute." });
  }
}
