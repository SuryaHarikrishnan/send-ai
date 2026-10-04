/* global process, Buffer */
// Food search and barcode lookup against USDA FoodData Central, plus restaurant
// and brand foods from FatSecret when its keys are set. Keeps the keys on the server.
// GET /api/foods?q=greek+yogurt or /api/foods?upc=0123456789012
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

/* ---------- FatSecret (restaurant chains and brands) ---------- */

let fsToken = null; // { value, expires } reused while this server instance stays warm

async function fatsecretToken() {
  const id = process.env.FATSECRET_CLIENT_ID;
  const secret = process.env.FATSECRET_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (fsToken && fsToken.expires > Date.now() + 60000) return fsToken.value;
  const r = await fetch("https://oauth.fatsecret.com/connect/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=basic",
  });
  if (!r.ok) throw new Error(`FatSecret token ${r.status}`);
  const j = await r.json();
  fsToken = { value: j.access_token, expires: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return fsToken.value;
}

// "Per 1 sandwich - Calories: 440kcal | Fat: 19.00g | Carbs: 41.00g | Protein: 28.00g"
const FS_DESC = /^Per\s+(.+?)\s+-\s+Calories:\s*([\d.]+)kcal\s*\|\s*Fat:\s*([\d.]+)g\s*\|\s*Carbs:\s*([\d.]+)g\s*\|\s*Protein:\s*([\d.]+)g/i;

function fromFatSecret(f) {
  const m = FS_DESC.exec(f.food_description || "");
  if (!m) return null;
  const [, per, kcal, fat, carbs, protein] = m;
  const nums = { kcal: Number(kcal), protein: Number(protein), carbs: Number(carbs), fat: Number(fat) };
  const hundred = /^100\s*(g|ml)$/i.exec(per.trim());
  return {
    code: "",
    src: "fatsecret",
    name: f.food_name,
    brand: f.brand_name || "",
    per100: hundred ? nums : null,
    perServing: hundred ? null : nums,
    serving: hundred ? null : per.trim(),
    servingG: null,
    servingText: "",
    liquid: hundred ? hundred[1].toLowerCase() === "ml" : false,
    generic: f.food_type !== "Brand",
  };
}

async function searchFatSecret(q) {
  const token = await fatsecretToken();
  if (!token) return [];
  const url = `https://platform.fatsecret.com/rest/server.api?method=foods.search&format=json&max_results=20&search_expression=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`FatSecret ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(`FatSecret: ${j.error.message || j.error.code}`);
  const list = j.foods?.food ? [].concat(j.foods.food) : [];
  return list.map(fromFatSecret).filter(Boolean);
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
      const [usda, fs] = await Promise.allSettled([
        search(`query=${encodeURIComponent(q)}&dataType=${encodeURIComponent("Branded,Survey (FNDDS)")}&pageSize=30&sortBy=score`),
        searchFatSecret(q),
      ]);
      if (usda.status === "rejected" && fs.status === "rejected") throw usda.reason;
      const a = fs.status === "fulfilled" ? fs.value : [];
      const b = usda.status === "fulfilled" ? usda.value : [];
      // FatSecret first: it has the restaurant chains people search for by name.
      foods = [];
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i]) foods.push(a[i]);
        if (b[i]) foods.push(b[i]);
      }
    }
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json({ foods });
  } catch (e) {
    return res.status(502).json({ error: e.message || "USDA lookup failed." });
  }
}
