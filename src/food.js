// Food logging: built-in common foods, Open Food Facts lookups and the math
// behind the food home screen.

export const DAY_MS = 86400000;

export const MEALS = [
  ["breakfast", "Breakfast"],
  ["lunch", "Lunch"],
  ["dinner", "Dinner"],
  ["snack", "Snacks"],
];
export const MEAL_NAMES = Object.fromEntries(MEALS);
// Share of the day's budget suggested for each meal.
export const MEAL_SPLIT = { breakfast: 0.2, lunch: 0.25, dinner: 0.35, snack: 0.2 };
export const mealSingular = m => (m === "snack" ? "Snack" : MEAL_NAMES[m]);

// The meal you are most likely logging right now.
export function mealForNow(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 4 && h < 10.5) return "breakfast";
  if (h >= 11 && h < 14.5) return "lunch";
  if (h >= 17 && h < 21.5) return "dinner";
  return "snack";
}
// When logging for an earlier day, the entry is stamped at a typical time for its meal.
const MEAL_HOUR = { breakfast: 8, lunch: 12.5, dinner: 19, snack: 15 };

export function eatenAt(day, meal) {
  const d = new Date(day);
  if (d.toDateString() === new Date().toDateString()) return new Date();
  const h = MEAL_HOUR[meal];
  d.setHours(Math.floor(h), (h % 1) * 60, 0, 0);
  return d;
}

export const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const dayKey = d => startOfDay(d).toDateString();
export function weekStart(d) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function dayLabel(d) {
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / DAY_MS);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7 && days > 0) return new Date(d).toLocaleDateString(undefined, { weekday: "long" });
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Days in a row with something logged, ending today (or yesterday if today is still empty).
export function logStreak(dates) {
  const days = new Set(dates.map(dayKey));
  const d = startOfDay(new Date());
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/* ---------- goals (kept on this device, like the weekly lifting goal) ---------- */

export const DEFAULT_GOALS = { kcal: 2000, protein: 150, carbs: 200, fat: 65 };

export function readGoals() {
  try {
    const g = JSON.parse(localStorage.getItem("send.foodGoals") || "{}");
    const out = { ...DEFAULT_GOALS };
    for (const k of Object.keys(out)) if (Number(g[k]) > 0) out[k] = Math.round(Number(g[k]));
    return out;
  } catch {
    return { ...DEFAULT_GOALS };
  }
}
export function saveGoals(g) {
  try { localStorage.setItem("send.foodGoals", JSON.stringify(g)); } catch { /* storage blocked */ }
}

/* ---------- units and nutrition math ---------- */

const G = { id: "g", label: "g", g: 1 };
const OZ = { id: "oz", label: "oz", g: 28.35 };
const ML = { id: "ml", label: "ml", g: 1 };
const FLOZ = { id: "floz", label: "fl oz", g: 29.57 };
const isWeight = u => ["g", "oz", "ml", "floz"].includes(u.id);

const FRACTIONS = { 0.25: "¼", 0.5: "½", 0.75: "¾", 0.33: "⅓", 0.67: "⅔" };
export function fmtQty(n) {
  const v = Math.round(Number(n) * 100) / 100;
  const whole = Math.floor(v);
  const frac = FRACTIONS[Math.round((v - whole) * 100) / 100];
  if (frac) return `${whole || ""}${frac}`;
  return String(Math.round(v * 10) / 10);
}

// "150 g", "2 slices", "½ cup", "1 serving"
export function amountText(food, unitId, amount) {
  const u = (food.units || []).find(x => x.id === unitId) || { label: unitId };
  if (isWeight(u)) return `${Math.round(Number(amount) * 10) / 10} ${u.label}`;
  const n = Number(amount);
  if (!u.plural && n !== 1) return `${fmtQty(n)} × ${u.label}`;
  return `${fmtQty(n)} ${n > 1 ? u.plural : u.label}`;
}

const r1 = n => Math.round(n * 10) / 10;

// Calories and macros for an amount of a food in a unit.
export function nutrition(food, unitId, amount) {
  const u = (food.units || []).find(x => x.id === unitId);
  const n = Number(amount) || 0;
  let base = null;
  let grams = null;
  if (u && u.g != null && food.per100) {
    grams = u.g * n;
    const f = grams / 100;
    base = { kcal: food.per100.kcal * f, protein: food.per100.protein * f, carbs: food.per100.carbs * f, fat: food.per100.fat * f };
  } else if (food.perServing) {
    const s = food.perServing;
    base = { kcal: s.kcal * n, protein: s.protein * n, carbs: s.carbs * n, fat: s.fat * n };
  }
  if (!base) return { kcal: 0, protein: 0, carbs: 0, fat: 0, grams };
  return { kcal: Math.round(base.kcal), protein: r1(base.protein), carbs: r1(base.carbs), fat: r1(base.fat), grams: grams == null ? null : r1(grams) };
}

export function totals(logs) {
  return logs.reduce(
    (t, l) => ({ kcal: t.kcal + Number(l.kcal || 0), protein: t.protein + Number(l.protein_g || 0), carbs: t.carbs + Number(l.carbs_g || 0), fat: t.fat + Number(l.fat_g || 0) }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

// A food as stored on a log row, ready to log again.
export function foodFromLog(l) {
  const f = l.food || {};
  return {
    name: l.name,
    brand: l.brand || "",
    barcode: l.barcode || "",
    source: l.source,
    image: f.image || "",
    per100: f.per100 || null,
    perServing: f.perServing || null,
    units: f.units && f.units.length ? f.units : [{ id: l.unit, label: l.unit, g: null }],
    defaultUnit: l.unit,
    defaultAmount: Number(l.amount) || 1,
  };
}

export function logRow(food, unitId, amount, meal, when) {
  const n = nutrition(food, unitId, amount);
  return {
    eaten_at: when.toISOString(),
    meal,
    name: food.name.trim(),
    brand: food.brand?.trim() || null,
    barcode: food.barcode || null,
    source: food.source || "custom",
    amount: Number(amount),
    unit: unitId,
    grams: n.grams,
    kcal: n.kcal,
    protein_g: n.protein,
    carbs_g: n.carbs,
    fat_g: n.fat,
    food: { per100: food.per100 || null, perServing: food.perServing || null, units: food.units, image: food.image || null },
  };
}

const foodKey = l => `${l.name}|${l.brand || ""}`.toLowerCase();

// Foods logged before, newest first, each with the amount used last time.
export function recentFoods(logs, limit = 20) {
  const seen = new Map();
  for (const l of logs) {
    const k = foodKey(l);
    if (seen.has(k)) seen.get(k).count++;
    else seen.set(k, { key: k, food: foodFromLog(l), count: 1, last: l });
  }
  return [...seen.values()].slice(0, limit);
}

export function foodsError(err) {
  if (!err) return null;
  if (err.code === "42P01" || err.code === "PGRST205")
    return { title: "Food logging isn't switched on yet.", detail: "The food_logs table doesn't exist. Run supabase/food.sql once in the Supabase SQL Editor, then reload." };
  if (err.code === "42501")
    return { title: "Food logging is blocked by database permissions.", detail: "Run supabase/food.sql again in the Supabase SQL Editor (it grants access), then reload." };
  return { title: "Couldn't load your food log.", detail: err.message || "Unknown error. Try reloading." };
}

/* ---------- built-in common foods (per 100 g, USDA-style averages) ---------- */

// [name, category, kcal, protein, carbs, fat, unit label, grams per unit, plural, default amount]
const COMMON = [
  ["Banana", "Fruit", 89, 1.1, 22.8, 0.3, "medium", 118, "medium"],
  ["Apple", "Fruit", 52, 0.3, 13.8, 0.2, "medium", 182, "medium"],
  ["Orange", "Fruit", 47, 0.9, 11.8, 0.1, "medium", 131, "medium"],
  ["Strawberries", "Fruit", 32, 0.7, 7.7, 0.3, "cup", 152, "cups"],
  ["Blueberries", "Fruit", 57, 0.7, 14.5, 0.3, "cup", 148, "cups"],
  ["Grapes", "Fruit", 69, 0.7, 18.1, 0.2, "cup", 151, "cups"],
  ["Mango", "Fruit", 60, 0.8, 15, 0.4, "cup", 165, "cups"],
  ["Watermelon", "Fruit", 30, 0.6, 7.6, 0.2, "cup", 152, "cups"],
  ["Avocado", "Fruit", 160, 2, 8.5, 14.7, "avocado", 150, "avocados", 0.5],
  ["Broccoli", "Veg", 35, 2.4, 7.2, 0.4, "cup", 91, "cups"],
  ["Spinach", "Veg", 23, 2.9, 3.6, 0.4, "cup", 30, "cups"],
  ["Mixed salad greens", "Veg", 17, 1.4, 3.3, 0.2, "cup", 36, "cups", 2],
  ["Carrot", "Veg", 41, 0.9, 9.6, 0.2, "medium", 61, "medium"],
  ["Tomato", "Veg", 18, 0.9, 3.9, 0.2, "medium", 123, "medium"],
  ["Cucumber", "Veg", 15, 0.7, 3.6, 0.1, "cup", 104, "cups"],
  ["Baked potato", "Veg", 93, 2.5, 21, 0.1, "medium", 173, "medium"],
  ["Sweet potato", "Veg", 90, 2, 20.7, 0.2, "medium", 114, "medium"],
  ["Chicken breast, cooked", "Protein", 165, 31, 0, 3.6, "breast", 172, "breasts"],
  ["Egg", "Protein", 143, 12.6, 0.7, 9.5, "large", 50, "large", 2],
  ["Egg whites", "Protein", 52, 10.9, 0.7, 0.2, "large white", 33, "large whites", 3],
  ["Ground beef 90% lean, cooked", "Protein", 217, 26, 0, 11.7, "patty", 113, "patties"],
  ["Sirloin steak, cooked", "Protein", 244, 27, 0, 14, "steak", 170, "steaks"],
  ["Salmon, cooked", "Protein", 206, 22, 0, 12.4, "fillet", 154, "fillets"],
  ["Tuna, canned in water", "Protein", 116, 25.5, 0, 0.8, "can", 142, "cans"],
  ["Shrimp, cooked", "Protein", 99, 24, 0.2, 0.3, "shrimp", 6, "shrimp", 10],
  ["Turkey breast, deli", "Protein", 104, 17, 3.5, 2, "slice", 28, "slices", 2],
  ["Tofu, firm", "Protein", 144, 17.3, 2.8, 8.7, "cup", 252, "cups", 0.5],
  ["Bacon", "Protein", 541, 37, 1.4, 42, "slice", 8, "slices", 2],
  ["Whey protein", "Protein", 400, 80, 10, 5, "scoop", 30, "scoops"],
  ["White rice, cooked", "Grains", 130, 2.7, 28, 0.3, "cup", 158, "cups"],
  ["Brown rice, cooked", "Grains", 123, 2.7, 25.6, 1, "cup", 195, "cups"],
  ["Pasta, cooked", "Grains", 158, 5.8, 30.9, 0.9, "cup", 140, "cups"],
  ["Quinoa, cooked", "Grains", 120, 4.4, 21.3, 1.9, "cup", 185, "cups"],
  ["Oats, dry", "Grains", 379, 13.2, 67.7, 6.5, "cup", 80, "cups", 0.5],
  ["Whole wheat bread", "Grains", 252, 12.4, 42.7, 3.5, "slice", 32, "slices", 2],
  ["White bread", "Grains", 266, 7.6, 50.6, 3.3, "slice", 28, "slices", 2],
  ["Bagel", "Grains", 257, 10, 50.5, 1.7, "bagel", 105, "bagels"],
  ["Flour tortilla", "Grains", 306, 8.2, 50.6, 7.8, "medium", 45, "medium"],
  ["Granola", "Grains", 471, 10, 64, 20, "cup", 120, "cups", 0.5],
  ["Milk, 2%", "Dairy", 50, 3.3, 4.8, 2, "cup", 244, "cups"],
  ["Milk, whole", "Dairy", 61, 3.2, 4.8, 3.3, "cup", 244, "cups"],
  ["Greek yogurt, plain nonfat", "Dairy", 59, 10.2, 3.6, 0.4, "container", 170, "containers"],
  ["Cottage cheese, 2%", "Dairy", 81, 10.5, 4.8, 2.3, "cup", 226, "cups", 0.5],
  ["Cheddar cheese", "Dairy", 403, 24.9, 1.3, 33.1, "slice", 28, "slices"],
  ["Butter", "Dairy", 717, 0.9, 0.1, 81, "tbsp", 14, "tbsp"],
  ["Peanut butter", "Fats & nuts", 588, 25, 20, 50, "tbsp", 16, "tbsp", 2],
  ["Almonds", "Fats & nuts", 579, 21.2, 21.6, 49.9, "cup", 143, "cups", 0.25],
  ["Walnuts", "Fats & nuts", 654, 15.2, 13.7, 65.2, "cup", 117, "cups", 0.25],
  ["Olive oil", "Fats & nuts", 884, 0, 0, 100, "tbsp", 13.5, "tbsp"],
  ["Hummus", "Fats & nuts", 166, 7.9, 14.3, 9.6, "tbsp", 15, "tbsp", 2],
  ["Protein bar", "Snacks", 333, 33, 37, 12, "bar", 60, "bars"],
  ["Dark chocolate", "Snacks", 598, 7.8, 45.9, 42.6, "square", 10, "squares", 2],
  ["Potato chips", "Snacks", 536, 7, 53, 35, "small bag", 28, "small bags"],
  ["Popcorn, air-popped", "Snacks", 387, 13, 78, 4.5, "cup", 8, "cups", 3],
  ["Cheese pizza", "Snacks", 266, 11.4, 33, 9.7, "slice", 107, "slices"],
  ["Honey", "Snacks", 304, 0.3, 82.4, 0, "tbsp", 21, "tbsp"],
  ["Coffee, black", "Drinks", 1, 0.1, 0, 0, "cup", 240, "cups"],
  ["Latte, 2% milk", "Drinks", 40, 2.7, 4, 1.5, "grande", 473, "grandes"],
  ["Orange juice", "Drinks", 45, 0.7, 10.4, 0.2, "cup", 248, "cups"],
  ["Cola", "Drinks", 42, 0, 10.6, 0, "can", 368, "cans"],
  ["Beer", "Drinks", 43, 0.5, 3.6, 0, "can", 356, "cans"],
  ["Red wine", "Drinks", 85, 0.1, 2.6, 0, "glass", 147, "glasses"],
];

export const COMMON_GROUPS = ["Fruit", "Veg", "Protein", "Grains", "Dairy", "Fats & nuts", "Snacks", "Drinks"];

export const COMMON_FOODS = COMMON.map(([name, group, kcal, protein, carbs, fat, label, g, plural, q]) => {
  const liquid = group === "Drinks";
  return {
    name,
    brand: "",
    barcode: "",
    source: "common",
    group,
    per100: { kcal, protein, carbs, fat },
    perServing: null,
    units: [{ id: "unit", label, plural, g }, liquid ? ML : G, liquid ? FLOZ : OZ],
    defaultUnit: "unit",
    defaultAmount: q || 1,
  };
});

/* ---------- Open Food Facts ---------- */

const OFF_FIELDS = [
  "code", "product_name", "product_name_en", "brands", "nutriments", "serving_size",
  "serving_quantity", "product_quantity_unit", "image_front_small_url", "image_small_url",
].join(",");

const num = v => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v));

// Turn an Open Food Facts product into a food. Returns null without a name.
export function fromOFF(p) {
  if (!p) return null;
  const name = (p.product_name_en || p.product_name || "").trim();
  if (!name) return null;
  const n = p.nutriments || {};
  let kcal = num(n["energy-kcal_100g"]);
  if (kcal == null && num(n["energy-kj_100g"]) != null) kcal = num(n["energy-kj_100g"]) / 4.184;
  if (kcal == null && num(n.energy_100g) != null) kcal = num(n.energy_100g) / 4.184;
  const per100 = kcal == null ? null : {
    kcal: r1(kcal),
    protein: r1(num(n.proteins_100g) || 0),
    carbs: r1(num(n.carbohydrates_100g) || 0),
    fat: r1(num(n.fat_100g) || 0),
  };
  const brand = (Array.isArray(p.brands) ? p.brands[0] : (p.brands || "").split(",")[0] || "").trim();
  const liquid = /ml|cl|l\b/i.test(p.product_quantity_unit || "") || /\d\s*ml/i.test(p.serving_size || "");
  const units = [];
  const sq = num(p.serving_quantity);
  if (sq && sq > 0) {
    const hint = (p.serving_size || "").replace(/\s+/g, " ").trim();
    units.push({ id: "serving", label: "serving", plural: "servings", g: sq, hint: hint || `${r1(sq)} ${liquid ? "ml" : "g"}` });
  }
  units.push(liquid ? ML : G, liquid ? FLOZ : OZ);
  return {
    name,
    brand,
    barcode: String(p.code || ""),
    source: "off",
    image: p.image_front_small_url || p.image_small_url || "",
    per100,
    perServing: null,
    units,
    defaultUnit: units[0].id,
    defaultAmount: units[0].id === "serving" ? 1 : 100,
  };
}

export async function lookupBarcode(code, signal) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`, { signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts didn't answer (${res.status}).`);
  const j = await res.json();
  if (!j.product || j.status === 0) return null;
  const food = fromOFF({ code, ...j.product });
  return food;
}

const usable = list => (list || []).map(fromOFF).filter(f => f && f.per100);

// Search Open Food Facts by name or brand. Tries the fast search service
// first and falls back to the classic search if it fails or finds nothing.
export async function searchFoods(q, signal) {
  const enc = encodeURIComponent(q);
  try {
    const res = await fetch(`https://search.openfoodfacts.org/search?q=${enc}&langs=en&page_size=24&fields=${OFF_FIELDS}`, { signal });
    if (res.ok) {
      const found = usable((await res.json()).hits);
      if (found.length) return found;
    }
  } catch (e) {
    if (e.name === "AbortError") throw e;
  }
  const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${enc}&search_simple=1&action=process&json=1&page_size=24&fields=${OFF_FIELDS}`, { signal });
  if (res.status === 429) throw new Error("Too many searches in a row. Wait a few seconds and try again.");
  if (!res.ok) throw new Error(`Open Food Facts didn't answer (${res.status}).`);
  return usable((await res.json()).products);
}

// A food you type in yourself, with calories and macros per serving.
export function customFood({ name, brand, barcode, serving, kcal, protein, carbs, fat }) {
  return {
    name: name.trim(),
    brand: (brand || "").trim(),
    barcode: barcode || "",
    source: "custom",
    image: "",
    per100: null,
    perServing: { kcal: Number(kcal) || 0, protein: Number(protein) || 0, carbs: Number(carbs) || 0, fat: Number(fat) || 0 },
    units: [{ id: "serving", label: (serving || "").trim() || "serving", plural: (serving || "").trim() ? undefined : "servings", g: null }],
    defaultUnit: "serving",
    defaultAmount: 1,
  };
}
