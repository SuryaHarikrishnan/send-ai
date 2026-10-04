/* global process */
// Food search and barcode lookup against USDA FoodData Central.
// Keeps the API key on the server. GET /api/foods?q=greek+yogurt or /api/foods?upc=0123456789012
// Results are cached at the edge for a day, since food labels rarely change.

const KCAL = [1008, 2047, 2048]; // Energy (kcal), then the Atwater variants some foods use instead
const PROTEIN = 1003;
const FAT = 1004;
const CARBS = 1005;

const SMALL = new Set(["and", "or", "with", "in", "of", "the", "a", "to", "for"]);
function titleCase(s) {
  if (!s) return "";
  // Branded names arrive in ALL CAPS; leave mixed-case names alone.
  if (s !== s.toUpperCase()) return s.trim();
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
    .trim();
}

function nutrient(food, ids) {
  for (const id of [].concat(ids)) {
    const n = (food.foodNutrients || []).find(x => x.nutrientId === id);
    if (n && n.value != null) return Number(n.value);
  }
  return null;
}

// Nutrients in search results are per 100 g (or 100 ml) for every data type.
function normalize(f) {
  const kcal = nutrient(f, KCAL);
  if (kcal == null) return null;
  const unit = (f.servingSizeUnit || "").toLowerCase();
  const servingG = f.servingSize && (unit === "g" || unit === "grm" || unit === "ml" || unit === "mlt") ? Number(f.servingSize) : null;
  return {
    code: f.gtinUpc || "",
    fdcId: f.fdcId,
    name: titleCase(f.description),
    brand: titleCase(f.brandName || f.brandOwner || ""),
    per100: {
      kcal,
      protein: nutrient(f, PROTEIN) || 0,
      carbs: nutrient(f, CARBS) || 0,
      fat: nutrient(f, FAT) || 0,
    },
    servingG,
    servingText: (f.householdServingFullText || "").trim(),
    liquid: unit === "ml" || unit === "mlt",
    generic: f.dataType !== "Branded",
  };
}

async function search(params) {
  const key = process.env.USDA_API_KEY || "DEMO_KEY";
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}&${params}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`USDA ${r.status}`);
  const j = await r.json();
  return (j.foods || []).map(normalize).filter(Boolean);
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const q = String(req.query.q || "").trim().slice(0, 80);
  const upc = String(req.query.upc || "").replace(/\D/g, "").slice(0, 14);
  if (!q && !upc) return res.status(400).json({ error: "Give q or upc." });

  try {
    let foods;
    if (upc) {
      const found = await search(`query=${upc}&dataType=Branded&pageSize=10`);
      const want = upc.replace(/^0+/, "");
      foods = found.filter(f => f.code.replace(/^0+/, "") === want).slice(0, 1);
    } else {
      foods = await search(
        `query=${encodeURIComponent(q)}&dataType=${encodeURIComponent("Branded,Survey (FNDDS)")}&pageSize=30&sortBy=score`
      );
    }
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json({ foods });
  } catch (e) {
    return res.status(502).json({ error: e.message || "USDA lookup failed." });
  }
}
