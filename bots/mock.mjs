// A fake backend for one bot: an in-memory Supabase (auth + the three tables
// the app uses), plus canned answers for Open Food Facts, /api/foods,
// /api/food-photo and /api/coach. Nothing leaves the machine.

const SUPABASE = "https://joygtqcjjaaalgxmdqjo.supabase.co";
const STORAGE_KEY = "sb-joygtqcjjaaalgxmdqjo-auth-token";
const DAY = 86400000;

import { readFileSync } from "node:fs";

// Bots have already agreed to the current privacy policy unless a journey says otherwise.
const PRIVACY_VERSION = /PRIVACY_VERSION = "([^"]+)"/.exec(readFileSync(new URL("../src/consent.js", import.meta.url), "utf8"))[1];

const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");

export function fakeSession(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24 * 30;
  const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", exp })}.sig`;
  return {
    access_token: token,
    token_type: "bearer",
    expires_in: 3600 * 24 * 30,
    expires_at: exp,
    refresh_token: "fake-refresh",
    user,
  };
}

/* ---------- food fixtures ---------- */

const usda = (name, brand, kcal, p, c, f, servingG, servingText) => ({
  code: "", src: "usda", name, brand, per100: { kcal, protein: p, carbs: c, fat: f }, perServing: null,
  serving: null, servingG, servingText, liquid: false, generic: !brand,
});
const fatsecret = (name, brand, serving, kcal, p, c, f) => ({
  code: "", src: "fatsecret", name, brand, per100: null, perServing: { kcal, protein: p, carbs: c, fat: f },
  serving, servingG: null, servingText: "", liquid: false, generic: false,
});

const API_FOODS = {
  chicken: [
    fatsecret("Grilled Chicken Sandwich", "Chick-fil-A", "1 sandwich", 390, 28, 44, 12),
    usda("Chicken breast, roasted", "", 165, 31, 0, 3.6, 140, "1 breast"),
    usda("Chicken thigh, cooked", "", 209, 26, 0, 10.9, 116, "1 thigh"),
    fatsecret("Chicken Nuggets (8 pc)", "Chick-fil-A", "8 nuggets", 250, 27, 11, 11),
  ],
  dominos: [
    fatsecret("Hand Tossed Pepperoni Pizza (Large)", "Domino's", "1 slice", 300, 12, 34, 13),
    fatsecret("Thin Crust Cheese Pizza (Medium)", "Domino's", "1 slice", 200, 8, 19, 10),
  ],
  oat: [usda("Rolled oats", "Quaker", 379, 13, 68, 6.5, 40, "1/2 cup")],
  banana: [usda("Banana, raw", "", 89, 1.1, 23, 0.3, 118, "1 medium")],
  "greek yogurt": [usda("Greek yogurt, plain nonfat", "Fage", 59, 10, 3.6, 0.4, 170, "1 container")],
  rice: [usda("White rice, cooked", "", 130, 2.7, 28, 0.3, 158, "1 cup")],
  "big mac": [fatsecret("Big Mac", "McDonald's", "1 burger", 590, 25, 46, 34)],
};

const OFF_PRODUCTS = {
  "3017620422003": { product_name: "Nutella", brands: "Ferrero", serving_quantity: 15, serving_size: "15 g", nutriments: { "energy-kcal_100g": 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 } },
  "0049000028911": { product_name: "Coca-Cola", brands: "Coca-Cola", serving_quantity: 355, serving_size: "355 ml", product_quantity_unit: "ml", nutriments: { "energy-kcal_100g": 42, proteins_100g: 0, carbohydrates_100g: 10.6, fat_100g: 0 } },
  // Found, but no nutrition facts.
  "0000000012345": { product_name: "Mystery granola", brands: "Local bakery" },
};

const PHOTO_ITEMS = [
  { name: "Grilled salmon", portion: "1 fillet", grams: 150, kcal: 310, protein: 34, carbs: 0, fat: 18 },
  { name: "White rice", portion: "1 cup", grams: 160, kcal: 210, protein: 4, carbs: 45, fat: 0.5 },
  { name: "Steamed broccoli", portion: "1 cup", grams: 90, kcal: 30, protein: 2.5, carbs: 6, fat: 0.3 },
];

/* ---------- seed data for returning users ---------- */

const LIFTS = [
  ["Push", [["Bench press", 135, 8], ["Overhead press", 85, 8], ["Triceps pushdown", 50, 12]]],
  ["Pull", [["Pull-up", 0, 8], ["Barbell row", 115, 8], ["Barbell curl", 60, 10]]],
  ["Legs", [["Back squat", 185, 5], ["Romanian deadlift", 155, 8], ["Calf raise", 90, 15]]],
];

export function seedData(userId, { weeks = 6, food = true, climbs = true, lifts = true } = {}) {
  const rows = { workouts: [], food_logs: [], climbs: [] };
  let id = 1;
  const now = Date.now();
  if (lifts) {
    for (let d = weeks * 7; d >= 1; d -= 2) {
      const [title, ex] = LIFTS[d % 3];
      const bump = Math.floor((weeks * 7 - d) / 7) * 5;
      rows.workouts.push({
        id: `w${id++}`, user_id: userId, title, duration_min: 55 + (d % 4) * 5,
        performed_at: new Date(now - d * DAY).toISOString(), created_at: new Date(now - d * DAY).toISOString(),
        exercises: ex.map(([name, w, r]) => ({ name, sets: [0, 1, 2].map(() => ({ reps: r, weight: w ? w + bump : 0 })) })),
      });
    }
  }
  if (food) {
    for (let d = 10; d >= 1; d--) {
      for (const [meal, hour, name, kcal, p, c, f] of [
        ["breakfast", 8, "Rolled oats", 150, 5, 27, 3],
        ["lunch", 12, "Chicken breast, roasted", 231, 43, 0, 5],
        ["dinner", 19, "White rice, cooked", 205, 4, 45, 0.5],
      ]) {
        const t = new Date(now - d * DAY);
        t.setHours(hour, 0, 0, 0);
        rows.food_logs.push({
          id: `f${id++}`, user_id: userId, meal, name, brand: "", barcode: "", source: "usda", unit: "g", amount: 100,
          kcal, protein_g: p, carbs_g: c, fat_g: f, eaten_at: t.toISOString(), created_at: t.toISOString(),
          food: { per100: { kcal, protein: p, carbs: c, fat: f }, units: [{ id: "g", label: "g", g: 1 }] },
        });
      }
    }
  }
  if (climbs) {
    const grades = ["V2", "V3", "V4", "V3", "V5", "V4", "V6", "V3"];
    grades.forEach((g, i) => {
      const t = new Date(now - (grades.length - i) * 2 * DAY).toISOString();
      rows.climbs.push({ id: `c${id++}`, user_id: userId, grade: g, style: "boulder", wall_angle: ["overhang"], hold_type: ["crimp"], attempts: 3, sent: i !== 6, notes: "", created_at: t });
    });
  }
  return rows;
}

/* ---------- a tiny PostgREST ---------- */

function parseFilters(url) {
  const filters = [];
  let order = null;
  let limit = null;
  let select = "*";
  for (const [k, v] of url.searchParams) {
    if (k === "select") select = v;
    else if (k === "order") order = v;
    else if (k === "limit") limit = Number(v);
    else {
      const m = /^(eq|gte|lt|lte|gt|neq)\.(.*)$/s.exec(v);
      if (m) filters.push([k, m[1], m[2]]);
    }
  }
  return { filters, order, limit, select };
}

function matchRow(row, filters) {
  return filters.every(([col, op, val]) => {
    const a = row[col];
    if (op === "eq") return String(a) === val;
    if (op === "neq") return String(a) !== val;
    const x = Date.parse(a);
    const y = Date.parse(val);
    const [l, r] = Number.isNaN(x) || Number.isNaN(y) ? [Number(a), Number(val)] : [x, y];
    if (op === "gte") return l >= r;
    if (op === "gt") return l > r;
    if (op === "lt") return l < r;
    if (op === "lte") return l <= r;
    return true;
  });
}

function project(row, select) {
  if (!select || select === "*") return row;
  const cols = select.split(",").map(s => s.trim());
  return Object.fromEntries(cols.map(c => [c, row[c]]));
}

/**
 * Wire one browser context to a fake backend.
 * opts.latency: ms added to every API answer
 * opts.failWrites: probability (0-1) that a write fails with a 503
 * opts.failAll: every Supabase call fails (database paused)
 * opts.missingTable: a table name that answers "table doesn't exist"
 * opts.photoNoFood: the photo AI finds nothing
 */
export async function installMocks(context, { user, rows, latency = 0, failWrites = 0, failAll = false, missingTable = null, photoNoFood = false, signedOut = false, analytics = false, rng = Math.random, log }) {
  const db = rows;
  if (user) user.user_metadata = { privacy_version: PRIVACY_VERSION, ...user.user_metadata };
  let nextId = 1000;
  let photosUsed = 0;
  const stats = { reads: 0, writes: 0, failedWrites: 0, photoCalls: 0, foodSearches: 0, unmocked: [] };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const json = (route, status, body, headers = {}) =>
    route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", ...headers }, body: body === undefined ? "" : JSON.stringify(body) });

  if (analytics) await context.addInitScript(() => { try { localStorage.setItem("send.analytics", "on"); } catch { /* ignore */ } });
  if (!signedOut) await context.addInitScript(([key, session]) => {
    try { if (!localStorage.getItem("__bot_seeded")) { localStorage.setItem(key, JSON.stringify(session)); localStorage.setItem("__bot_seeded", "1"); } } catch { /* ignore */ }
  }, [STORAGE_KEY, fakeSession(user)]);

  await context.route(`${SUPABASE}/**`, async route => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    if (latency) await wait(latency);

    if (url.pathname.startsWith("/auth/v1/")) {
      if (url.pathname.endsWith("/user")) {
        if (method === "PUT") user.user_metadata = { ...user.user_metadata, ...(req.postDataJSON()?.data || {}) };
        return json(route, 200, user);
      }
      if (url.pathname.endsWith("/logout")) return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
      if (url.pathname.endsWith("/token")) return json(route, 200, fakeSession(user));
      return json(route, 200, {});
    }

    const m = /^\/rest\/v1\/(\w+)/.exec(url.pathname);
    if (!m) return json(route, 404, { message: "not found" });
    const table = m[1];
    if (failAll) return json(route, 503, { message: "Service Unavailable", code: "503" });
    if (table === missingTable) return json(route, 404, { code: "PGRST205", message: `Could not find the table 'public.${table}' in the schema cache` });
    db[table] ||= [];
    const { filters, order, limit, select } = parseFilters(url);
    const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object");

    if (method === "GET" || method === "HEAD") {
      stats.reads++;
      let list = db[table].filter(r => matchRow(r, filters));
      if (order) {
        const [col, dir] = order.split(".");
        list = [...list].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (dir === "desc" ? -1 : 1));
      }
      if (limit) list = list.slice(0, limit);
      list = list.map(r => project(r, select));
      return json(route, 200, single ? list[0] ?? null : list, { "content-range": `0-${list.length - 1}/${list.length}` });
    }

    stats.writes++;
    if (failWrites && rng() < failWrites) {
      stats.failedWrites++;
      log?.(`backend: ${method} ${table} failed on purpose (503)`);
      return json(route, 503, { message: "upstream connect error or disconnect/reset before headers", code: "503" });
    }
    const wantRows = (req.headers()["prefer"] || "").includes("return=representation");

    if (method === "POST") {
      const body = req.postDataJSON();
      const items = (Array.isArray(body) ? body : [body]).map(b => ({ id: `n${nextId++}`, created_at: new Date().toISOString(), ...b }));
      db[table].push(...items);
      const out = items.map(r => project(r, select));
      if (!wantRows) return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*" }, body: "" });
      return json(route, 201, single ? out[0] : out);
    }
    if (method === "PATCH") {
      const body = req.postDataJSON();
      const hit = db[table].filter(r => matchRow(r, filters));
      hit.forEach(r => Object.assign(r, body));
      if (!wantRows) return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" }, body: "" });
      return json(route, 200, single ? hit[0] : hit);
    }
    if (method === "DELETE") {
      db[table] = db[table].filter(r => !matchRow(r, filters));
      return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" }, body: "" });
    }
    return json(route, 405, { message: "method" });
  });

  // Our own Vercel API routes.
  await context.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (latency) await wait(latency);
    if (url.pathname === "/api/foods") {
      stats.foodSearches++;
      const q = (url.searchParams.get("q") || "").toLowerCase();
      const upc = url.searchParams.get("upc");
      if (upc) return json(route, 200, { foods: [] });
      const key = Object.keys(API_FOODS).find(k => q.includes(k) || k.includes(q));
      return json(route, 200, { foods: key ? API_FOODS[key] : [] });
    }
    if (url.pathname === "/api/food-photo") {
      stats.photoCalls++;
      if (photoNoFood) return json(route, 200, { items: [], remaining: 3 - photosUsed });
      if (photosUsed >= 3) return json(route, 429, { error: "You've used your 3 photos for today. Search or scan a barcode instead, or try again tomorrow.", remaining: 0 });
      photosUsed++;
      return json(route, 200, { items: PHOTO_ITEMS, remaining: 3 - photosUsed });
    }
    if (url.pathname === "/api/coach") return json(route, 401, { error: "Sign in to use the coach." });
    if (url.pathname === "/api/news" || url.pathname === "/api/youtube") return json(route, 200, { articles: [], videos: [] });
    return json(route, 404, { error: "no mock" });
  });

  // Open Food Facts (called straight from the browser).
  await context.route(/openfoodfacts\.org/, async route => {
    const url = new URL(route.request().url());
    if (latency) await wait(latency);
    const prod = /\/product\/(\d+)\.json/.exec(url.pathname);
    if (prod) {
      const p = OFF_PRODUCTS[prod[1]];
      if (!p) return json(route, 404, { status: 0 });
      return json(route, 200, { status: 1, product: { code: prod[1], ...p } });
    }
    return json(route, 200, { hits: [], products: [] });
  });

  // Anything else on the internet: note it and block it.
  await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, async route => {
    const u = route.request().url();
    if (u.startsWith(SUPABASE) || /openfoodfacts/.test(u)) return route.fallback();
    if (analytics && /^https:\/\/[a-z-]+\.i\.posthog\.com\//.test(u)) return route.continue();
    stats.unmocked.push(u.slice(0, 120));
    return route.abort();
  });

  return { db, stats };
}
