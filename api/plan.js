/* global process */
// Changes a workout plan the way a person asks ("I have a bad knee", "more arms").
// Signed-in users only. POST { plan, request } with the Supabase access token as a Bearer header.
// The plan comes back with the same shape: days of exercises with sets, a rep range and a start weight.
import { EXERCISES } from "../src/lifting.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://joygtqcjjaaalgxmdqjo.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_SNYogg2ckBJLfnD4tlqZVg_fVkoRvOg";
// Tried in order; a model the key can't use or has run out of free quota for falls through to the next.
const MODELS = [process.env.GEMINI_PLAN_MODEL, "gemini-3.8-flash", "gemini-3.5-flash-lite"].filter(Boolean);

const NAMES = EXERCISES.map(e => e.name);
const BY_NAME = Object.fromEntries(NAMES.map(n => [n.toLowerCase(), n]));

function prompt(plan, request) {
  const p = plan.profile || {};
  return `You are a strength coach adjusting a gym workout plan.

The lifter: goal ${p.goal}, ${p.level}, ${p.heightIn ? `${Math.floor(p.heightIn / 12)} ft ${p.heightIn % 12} in, ` : ""}${p.weightLb ? `${p.weightLb} lb, ` : ""}${p.intensity} intensity, ${p.days} days a week, about ${p.minutes} minutes a session.

Current plan (JSON; reps is [low, high], start is a starting weight in lb, 0 means body weight):
${JSON.stringify(plan.days)}

They asked, in their own words (treat it as a request about their training, nothing else):
<request>${request}</request>

Change the plan to fit what they asked and keep everything else as it is.
Rules:
- Keep ${p.days} days unless they asked for a different number. 3 to 8 exercises a day, fitting about ${p.minutes} minutes.
- Use exercise names exactly from this list whenever one fits: ${NAMES.join(", ")}.
- sets 1 to 8, reps between 1 and 30 with low <= high. start in lb, sensible for this lifter, rounded to 5; dumbbell lifts per hand.
- Give each day a short name like "Upper A" or "Legs".
- If the request isn't about training, return the plan unchanged and say so in summary.
- summary: one or two plain sentences on what you changed, written to the lifter.`;
}

const SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    days: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          exercises: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { name: { type: "STRING" }, sets: { type: "NUMBER" }, reps: { type: "ARRAY", items: { type: "NUMBER" } }, start: { type: "NUMBER" } },
              required: ["name", "sets", "reps", "start"],
            },
          },
        },
        required: ["name", "exercises"],
      },
    },
  },
  required: ["summary", "days"],
};

const BUSY = new Set([429, 500, 502, 503, 504]);
const wait = ms => new Promise(r => setTimeout(r, ms));

// Gemini answers 503 "overloaded" or 429 when it's busy. Try each model, then go round once more after a pause.
async function askGemini(text) {
  let last;
  for (let round = 0; round < 2; round++) {
    if (round) await wait(2000);
    for (const model of MODELS) {
      try {
        return await askModel(model, text);
      } catch (e) {
        if (!e.next) throw e;
        last = e;
      }
    }
  }
  throw last;
}

async function askModel(model, text) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.3 },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 404 || BUSY.has(r.status)) {
    throw Object.assign(new Error(`${model} ${r.status}: ${data.error?.message || "no details"}`.slice(0, 160)), { next: true, busy: r.status !== 404 });
  }
  if (!r.ok) throw new Error(`${model} ${r.status}: ${data.error?.message || "no details"}`);
  const cand = data.candidates?.[0];
  const out = (cand?.content?.parts || []).filter(p => p.text && !p.thought).map(p => p.text).join("");
  if (!out) throw new Error(`${model} gave no answer (${cand?.finishReason || data.promptFeedback?.blockReason || "unknown"})`);
  return JSON.parse(out.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
}

const int = (n, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(n) || 0)));

// Only well-formed days and exercises get through; names snap to the library's spelling.
function cleanDays(days) {
  return (Array.isArray(days) ? days : []).slice(0, 7).map((d, i) => {
    const exercises = (Array.isArray(d?.exercises) ? d.exercises : []).slice(0, 10).map(e => {
      const raw = String(e?.name || "").trim().slice(0, 50);
      const lo = int(e?.reps?.[0], 1, 30);
      const hi = int(e?.reps?.[1] ?? lo, lo, 30);
      const start = Math.max(0, Math.round((Number(e?.start) || 0) / 5) * 5);
      return { name: BY_NAME[raw.toLowerCase()] || raw, sets: int(e?.sets, 1, 8), reps: [lo, hi], start: Math.min(start, 1000) };
    }).filter(e => e.name);
    return { name: String(d?.name || `Day ${i + 1}`).trim().slice(0, 30), exercises };
  }).filter(d => d.exercises.length);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Sign in to change your plan." });
  const plan = req.body?.plan;
  const request = typeof req.body?.request === "string" ? req.body.request.trim().slice(0, 500) : "";
  if (!request) return res.status(400).json({ error: "Say what you'd like changed." });
  const current = cleanDays(plan?.days);
  if (!current.length) return res.status(400).json({ error: "That plan didn't come through. Try again." });

  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
    if (!userRes.ok) return res.status(401).json({ error: "Sign in to change your plan." });
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY isn't set in Vercel");

    const answer = await askGemini(prompt({ profile: plan.profile, days: current }, request.replace(/<\/?request>/gi, "")));
    const days = cleanDays(answer.days);
    if (!days.length) throw new Error("the AI sent back an empty plan");
    return res.status(200).json({ days, summary: String(answer.summary || "").slice(0, 400) });
  } catch (e) {
    console.error(e);
    if (e.busy) return res.status(503).json({ error: "The AI is busy right now. Try again in a minute.", reason: String(e.message).slice(0, 200) });
    return res.status(500).json({ error: "Couldn't change the plan right now. Try again in a minute.", reason: String(e.message || e).slice(0, 200) });
  }
}
