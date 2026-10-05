/* global process */
// Photo of a meal in, a list of foods with estimated portions, calories and macros out.
// Signed-in users only, DAILY_LIMIT photos per user per day (counted in food_photo_requests).
// POST { image: base64 JPEG } with the Supabase access token as a Bearer header.
const SUPABASE_URL = process.env.SUPABASE_URL || "https://joygtqcjjaaalgxmdqjo.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_SNYogg2ckBJLfnD4tlqZVg_fVkoRvOg";
const DAILY_LIMIT = 3;
// Tried in order; a model the key can't use or has run out of free quota for falls through to the next.
const MODELS = [process.env.GEMINI_PHOTO_MODEL, "gemini-3.8-flash", "gemini-3.5-flash-lite"].filter(Boolean);

function supabaseFetch(path, token, options = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers },
  });
}

const PROMPT = `You estimate nutrition from a photo of food.
List each distinct food or drink you can see (at most 8). Ignore plates, cutlery and packaging.
For each one give:
- name: short and plain, like "Grilled chicken breast" or "White rice"
- portion: the amount in everyday words, like "1 cup", "2 slices" or "1 medium"
- grams: your best estimate of its weight in grams (ml for drinks)
- kcal, protein, carbs, fat: for that whole portion, using typical USDA values. Count visible oil, butter and sauce.
If it looks like a known restaurant item, use that restaurant's typical values.
If there is no food in the photo, return an empty list.`;

const NUM = { type: "NUMBER" };
const SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { name: { type: "STRING" }, portion: { type: "STRING" }, grams: NUM, kcal: NUM, protein: NUM, carbs: NUM, fat: NUM },
        required: ["name", "portion", "grams", "kcal", "protein", "carbs", "fat"],
      },
    },
  },
  required: ["items"],
};

async function askGemini(image) {
  let last;
  for (const model of MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: "image/jpeg", data: image } }, { text: PROMPT }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.2 },
      }),
    });
    const data = await r.json().catch(() => ({}));
    // 404: the key can't use this model. 429: its free-tier quota is used up. Either way, try the next one.
    if (r.status === 404 || r.status === 429) { last = new Error(`${model} ${r.status}`); continue; }
    if (!r.ok) throw new Error(`${model} ${r.status}: ${data.error?.message || "no details"}`);
    const cand = data.candidates?.[0];
    // Thinking models can return several parts; the answer is the text that isn't a thought.
    const text = (cand?.content?.parts || []).filter(p => p.text && !p.thought).map(p => p.text).join("");
    if (!text) throw new Error(`${model} gave no answer (${cand?.finishReason || data.promptFeedback?.blockReason || "unknown"})`);
    return { model, items: parseItems(text) };
  }
  throw last;
}

// Accept {"items": [...]}, a bare [...] or JSON wrapped in ``` fences.
function parseItems(text) {
  const raw = text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "");
  const j = JSON.parse(raw);
  const list = Array.isArray(j) ? j : j.items || j.foods || [];
  return list.filter(i => i && i.name);
}

const clean = n => Math.max(0, Math.round((Number(n) || 0) * 10) / 10);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Sign in to use photo logging." });
  const image = typeof req.body?.image === "string" ? req.body.image : "";
  if (!image || image.length > 3_000_000) return res.status(400).json({ error: "That photo didn't come through. Try again." });

  try {
    const userRes = await supabaseFetch("/auth/v1/user", token);
    if (!userRes.ok) return res.status(401).json({ error: "Sign in to use photo logging." });
    const user = await userRes.json();

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const countRes = await supabaseFetch(
      `/rest/v1/food_photo_requests?select=id&user_id=eq.${user.id}&created_at=gte.${startOfDay.toISOString()}`,
      token,
      { method: "HEAD", headers: { Prefer: "count=exact" } }
    );
    if (!countRes.ok) throw new Error(`photo counter table missing or blocked (${countRes.status}), run supabase/photo.sql`);
    const used = Number((countRes.headers.get("content-range") || "").split("/")[1] || 0);
    if (used >= DAILY_LIMIT) {
      return res.status(429).json({ error: `You've used your ${DAILY_LIMIT} photos for today. Search or scan a barcode instead, or try again tomorrow.`, remaining: 0 });
    }

    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY isn't set in Vercel");
    const answer = await askGemini(image);
    const items = answer.items.slice(0, 8).map(i => ({
      name: String(i.name || "Food").slice(0, 80),
      portion: String(i.portion || "1 serving").slice(0, 40),
      grams: clean(i.grams),
      kcal: Math.round(clean(i.kcal)),
      protein: clean(i.protein),
      carbs: clean(i.carbs),
      fat: clean(i.fat),
    }));

    // Only photos that found food count toward the daily limit.
    if (items.length) {
      const logRes = await supabaseFetch("/rest/v1/food_photo_requests", token, { method: "POST", body: JSON.stringify({ user_id: user.id }) });
      if (!logRes.ok) throw new Error(`food_photo_requests insert failed: ${logRes.status}`);
    }
    return res.status(200).json({ items, model: answer.model, remaining: DAILY_LIMIT - used - (items.length ? 1 : 0) });
  } catch (e) {
    console.error(e);
    // The reason is shown in small print so a person can pass it on; it never includes the key.
    return res.status(500).json({ error: "Couldn't read that photo right now. Try again in a minute.", reason: String(e.message || e).slice(0, 200) });
  }
}
