// Run 40 bot users through SendIt on a local build with a fake backend.
//
//   npm run build && npm run bots            all 40
//   npm run bots -- --only "Maya,Zoe"        just some of them
//   npm run bots -- --headed                 watch them
//
// Results land in bots/report/ (report.md, report.json, screenshots).
// Add --save-to <dir> (or BOT_LOG_DIR) to keep every bot's session log and
// timings in <dir>/run-<time>/, with one line per run added to <dir>/runs.csv.

import { chromium } from "playwright";
import { preview } from "vite";
import { appendFile, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { DEVICES, PERSONAS } from "./personas.mjs";
import { journeys } from "./journeys.mjs";
import { installMocks, seedData } from "./mock.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const OUT = path.join(here, "report");
const args = process.argv.slice(2);
const flag = n => args.includes(n);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const CONCURRENCY = Number(opt("--workers") || 6);

const SEV = { high: 3, medium: 2, low: 1 };

// A seeded random number generator so a rerun does the same taps.
function rngFor(seed) {
  let s = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

// Epoch ms for today at HH:MM in a time zone.
function localTime(hhmm, timeZone) {
  const [h, m] = hhmm.split(":").map(Number);
  const now = new Date();
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map(p => [p.type, p.value]));
  const guess = Date.UTC(+parts.year, +parts.month - 1, +parts.day, h, m);
  const shown = new Date(new Date(guess).toLocaleString("en-US", { timeZone }));
  const asUTC = new Date(new Date(guess).toLocaleString("en-US", { timeZone: "UTC" }));
  return guess - (shown - asUTC);
}

class Bot {
  constructor(persona, index, browser, baseURL, photo) {
    this.persona = persona;
    this.index = index;
    this.browser = browser;
    this.baseURL = baseURL;
    this.photo = photo;
    this.slug = `${String(index + 1).padStart(2, "0")}-${persona.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")}`;
    this.rng = rngFor(persona.name);
    this.steps = [];
    this.issues = [];
    this.notes = [];
    this.passed = [];
    this.dialogs = [];
    this.consoleErrors = [];
    this.layoutSeen = new Set();
    const first = persona.name.split(/[ ,]/)[0];
    this.user = {
      id: `bot-${index + 1}`,
      aud: "authenticated",
      role: "authenticated",
      email: `${first.toLowerCase()}.bot${index + 1}@example.com`,
      user_metadata: { full_name: `${first} Bot`, name: `${first} Bot` },
      app_metadata: { provider: "google" },
      created_at: new Date().toISOString(),
    };
  }

  log(s) {
    const now = Date.now();
    this.steps.push({ at: new Date(now).toISOString(), t: now - (this.t0 ?? now), journey: this.journey || "start", action: s });
  }

  async shot(name) {
    const file = `${this.slug}/${String(this.steps.length).padStart(3, "0")}-${name.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}.png`;
    await mkdir(path.join(OUT, this.slug), { recursive: true });
    await this.page.screenshot({ path: path.join(OUT, file) }).catch(() => {});
    return file;
  }

  async issue(severity, title, detail) {
    const screenshot = await this.shot(title);
    this.issues.push({ severity, title, detail, screenshot, journey: this.journey, lastSteps: this.steps.slice(-4).map(x => x.action) });
  }

  note(s) { this.notes.push(`[${this.journey}] ${s}`); }

  check(ok, what, detail, severity = "medium") {
    if (ok) { this.passed.push(what); return true; }
    this.pending.push(this.issue(severity, `Check failed: ${what}`, detail));
    return false;
  }

  async tap(locator, name) {
    this.log(`tap ${name}`);
    try {
      await locator.click({ timeout: 6000 });
    } catch (e) {
      const why = /intercepts pointer events/.test(e.message)
        ? `something on top of it takes the tap (${(e.message.match(/<[^>]+>[^<]*<\/[^>]+> from <[^>]+>|<[^>]+>/g) || []).slice(-1)[0] || "overlay"})`
        : /not visible|Timeout/.test(e.message) ? "it never showed up or stayed hidden" : e.message.split("\n")[0];
      throw new Error(`Couldn't tap "${name}": ${why}`);
    }
    await this.page.waitForTimeout(120);
  }

  async type(locator, value, name) {
    this.log(`type "${value}" into ${name}`);
    try { await locator.fill(value, { timeout: 6000 }); }
    catch (e) { throw new Error(`Couldn't type into "${name}": ${e.message.split("\n")[0]}`); }
  }

  async expectVisible(locator, what, timeout = this.persona.faults.latency ? 15000 : 10000) {
    this.log(`expect ${what}`);
    try { await locator.first().waitFor({ state: "visible", timeout }); this.passed.push(what); }
    catch { throw new Error(`Expected: ${what}. It didn't happen within ${timeout / 1000}s.`); }
  }

  async coveredBy(locator) {
    return locator.evaluate(el => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!top || el.contains(top) || top.contains(el)) return null;
      return `${top.tagName.toLowerCase()}.${[...top.classList].join(".")}`;
    }).catch(() => null);
  }

  async uploadPhoto() {
    this.log("pick a meal photo");
    await this.page.locator('input[type="file"]').setInputFiles({ name: "meal.jpg", mimeType: "image/jpeg", buffer: this.photo });
  }

  async checkLayout(label) {
    const r = await this.page.evaluate(() => {
      const vw = window.innerWidth;
      const out = { overflow: document.documentElement.scrollWidth - vw, small: [], clipped: [], offscreen: [] };
      for (const el of document.querySelectorAll("button, a, input, select, [role=button]")) {
        const b = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (!b.width || !b.height || style.visibility === "hidden" || el.closest("[hidden]")) continue;
        const name = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
        if (b.bottom > 0 && b.top < innerHeight && (b.width < 28 || b.height < 28) && el.type !== "date" && el.type !== "file") out.small.push(`${name} (${Math.round(b.width)}x${Math.round(b.height)})`);
        let scroller = el.parentElement;
        while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowX)) scroller = scroller.parentElement;
        if (b.right > vw + 2 && b.left < vw && !scroller) out.offscreen.push(name);
        if (el.scrollWidth > el.clientWidth + 2 && style.overflow !== "visible" && el.tagName !== "INPUT" && el.tagName !== "SELECT") out.clipped.push(name);
      }
      return out;
    }).catch(() => null);
    if (!r) return;
    const dev = this.persona.device;
    const once = async (key, sev, title, detail) => {
      if (this.layoutSeen.has(key)) return;
      this.layoutSeen.add(key);
      await this.issue(sev, title, detail);
    };
    if (r.overflow > 2) await once(`ovf-${label}`, "medium", "Page scrolls sideways", `${dev}, ${label}: page is ${r.overflow}px wider than the ${dev} screen`);
    if (r.offscreen.length) await once(`off-${label}`, "medium", "Controls cut off at the right edge", `${dev}, ${label}: ${r.offscreen.slice(0, 5).join(", ")}`);
    if (r.small.length) await once(`small-${label}`, "low", "Small tap targets (under 28 px)", `${dev}, ${label}: ${r.small.slice(0, 6).join(", ")}`);
    if (r.clipped.length) await once(`clip-${label}`, "low", "Text cut off inside a button", `${dev}, ${label}: ${r.clipped.slice(0, 5).join(", ")}`);
  }

  async run() {
    const p = this.persona;
    const started = Date.now();
    this.t0 = started;
    this.flows = [];
    this.context = await this.browser.newContext({
      ...DEVICES[p.device],
      timezoneId: p.timezone,
      locale: p.locale || "en-US",
      serviceWorkers: "block",
      baseURL: this.baseURL,
    });
    const rows = p.returning ? seedData(this.user.id) : { workouts: [], food_logs: [], climbs: [] };
    const { db, stats } = await installMocks(this.context, {
      user: this.user, rows, rng: this.rng, log: s => this.log(s),
      latency: p.faults.latency || 0, failWrites: p.faults.failWrites || 0, failAll: !!p.faults.failAll, photoNoFood: !!p.faults.photoNoFood, signedOut: !!p.signedOut,
    });
    this.db = db;
    this.stats = stats;
    this.pending = [];
    await this.context.addInitScript(sport => { try { if (!localStorage.getItem("send.sport")) localStorage.setItem("send.sport", sport); } catch { /* ignore */ } }, p.sport);

    this.page = await this.context.newPage();
    if (p.clock) {
      await this.page.clock.install({ time: localTime(p.clock, p.timezone) });
      await this.page.clock.resume();
    }
    this.page.on("pageerror", e => this.consoleErrors.push(`crash: ${e.message.split("\n")[0]}`));
    this.page.on("console", m => {
      if (m.type() !== "error") return;
      const t = m.text();
      if (/ERR_FAILED|net::|Failed to load resource|ERR_BLOCKED/i.test(t)) return; // our own blocking of outside hosts
      this.consoleErrors.push(t.slice(0, 200));
    });
    this.page.on("dialog", d => { this.dialogs.push(d.message()); this.log(`pop-up: "${d.message()}"`); d.accept().catch(() => {}); });

    const t0 = Date.now();
    await this.page.goto(this.baseURL);
    await this.page.locator("nav.tabbar, .start-google").first().waitFor({ timeout: 15000 }).catch(() => {});
    this.loadMs = Date.now() - t0;

    for (const j of p.journeys) {
      this.journey = j;
      this.log(`--- ${j}`);
      const flow = { flow: j, startedAt: new Date().toISOString(), firstStep: this.steps.length - 1, outcome: "finished" };
      const before = this.issues.length;
      const fs = Date.now();
      try {
        await journeys[j](this);
        await Promise.all(this.pending.splice(0));
      } catch (e) {
        flow.outcome = "stuck";
        flow.stuckAt = e.message.split("\n")[0];
        await Promise.all(this.pending.splice(0));
        await this.issue("high", `Stuck during ${j}`, e.message.split("\n")[0]);
        await this.page.goto(this.baseURL).catch(() => {});
        await this.page.waitForTimeout(800);
      }
      flow.ms = Date.now() - fs;
      flow.steps = this.steps.length - flow.firstStep;
      delete flow.firstStep;
      flow.findings = this.issues.slice(before).filter(i => !/^Stuck/.test(i.title)).length;
      if (flow.outcome === "finished" && flow.findings) flow.outcome = "finished with findings";
      this.flows.push(flow);
      await this.checkLayout(`after ${j}`);
    }
    for (const e of [...new Set(this.consoleErrors)]) {
      this.journey = "console";
      await this.issue("medium", "Error in the browser console", e);
    }
    await this.context.close();
    // Time spent on each step = gap until the next step.
    this.steps.forEach((x, i) => { x.ms = (this.steps[i + 1]?.t ?? Date.now() - started) - x.t; });
    return {
      user: { id: this.user.id, email: this.user.email, name: this.user.user_metadata.full_name },
      startedAt: new Date(started).toISOString(), endedAt: new Date().toISOString(), viewport: DEVICES[p.device].viewport,
      flows: this.flows, timeline: this.steps,
      bot: this.slug, persona: p.name, device: p.device, sport: p.sport, timezone: p.timezone, returning: p.returning,
      faults: p.faults, journeys: p.journeys, seconds: Math.round((Date.now() - started) / 100) / 10, loadMs: this.loadMs,
      passed: this.passed.length, issues: this.issues, notes: this.notes, stepCount: this.steps.length, stats: { ...stats, unmocked: [...new Set(stats.unmocked)] },
    };
  }
}

/* ---------- report ---------- */

function groupIssues(results) {
  const groups = new Map();
  for (const r of results) {
    for (const i of r.issues) {
      const key = i.title;
      const g = groups.get(key) || { title: i.title, severity: i.severity, bots: [], details: new Set(), screenshots: [] };
      if (!g.bots.includes(`${r.persona} (${r.device})`)) g.bots.push(`${r.persona} (${r.device})`);
      g.details.add(i.detail);
      if (g.screenshots.length < 2) g.screenshots.push(i.screenshot);
      if (SEV[i.severity] > SEV[g.severity]) g.severity = i.severity;
      groups.set(key, g);
    }
  }
  return [...groups.values()].sort((a, b) => SEV[b.severity] - SEV[a.severity] || b.bots.length - a.bots.length);
}

function markdown(results, groups, secs) {
  const L = [];
  const total = results.reduce((a, r) => a + r.passed, 0);
  L.push("# SendIt bot test run", "");
  L.push(`${results.length} bots · ${total} checks passed · ${groups.length} distinct findings · ${Math.round(secs)} s`, "");
  L.push("Local production build, fake Supabase and fake food/photo APIs. No real accounts or data.", "");
  L.push("## Findings", "");
  for (const g of groups) {
    L.push(`### [${g.severity}] ${g.title}`, "");
    L.push(`Hit by ${g.bots.length} bot${g.bots.length === 1 ? "" : "s"}: ${[...new Set(g.bots)].slice(0, 8).join("; ")}${g.bots.length > 8 ? "; …" : ""}`, "");
    for (const d of [...g.details].slice(0, 6)) L.push(`- ${d}`);
    L.push("", ...g.screenshots.map(s => `![](${s})`), "");
  }
  L.push("## Bots", "", "| Bot | Device | Sport | Checks passed | Findings | Time |", "|---|---|---|---|---|---|");
  for (const r of results) L.push(`| ${r.persona} | ${r.device} | ${r.sport} | ${r.passed} | ${r.issues.length} | ${r.seconds}s |`);
  L.push("", "## Notes", "");
  for (const r of results) for (const n of r.notes) L.push(`- ${r.persona}: ${n}`);
  return L.join("\n");
}

/* ---------- session logs kept between runs ---------- */

const csv = rows => rows.map(r => r.map(v => {
  const t = v == null ? "" : String(v);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}).join(",")).join("\n") + "\n";

// One folder per run (sessions/<bot>.json, steps.csv, flows.csv, bots.csv,
// the report and screenshots) plus runs.csv, one line per run, that grows.
async function saveSessions(dir, results, groups, secs) {
  const id = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const run = path.join(dir, `run-${id}`);
  await mkdir(path.join(run, "sessions"), { recursive: true });
  for (const r of results) await writeFile(path.join(run, "sessions", `${r.bot}.json`), JSON.stringify(r, null, 2));
  await writeFile(path.join(run, "bots.csv"), csv([
    ["bot", "persona", "device", "width", "height", "sport", "timezone", "returning_user", "network", "started_at", "ended_at", "seconds", "first_load_ms", "flows", "steps", "checks_passed", "findings", "reads", "writes", "failed_writes", "food_searches", "photo_calls"],
    ...results.map(r => [r.bot, r.persona, r.device, r.viewport?.width, r.viewport?.height, r.sport, r.timezone, r.returning, r.faults?.latency ? `slow ${r.faults.latency}ms` : r.faults?.failWrites ? "saves fail" : r.faults?.failAll ? "database down" : "normal", r.startedAt, r.endedAt, r.seconds, r.loadMs, r.flows?.length, r.stepCount, r.passed, r.issues.length, r.stats?.reads, r.stats?.writes, r.stats?.failedWrites, r.stats?.foodSearches, r.stats?.photoCalls]),
  ]));
  await writeFile(path.join(run, "flows.csv"), csv([
    ["bot", "persona", "device", "flow", "started_at", "ms", "steps", "outcome", "findings", "stuck_at"],
    ...results.flatMap(r => (r.flows || []).map(f => [r.bot, r.persona, r.device, f.flow, f.startedAt, f.ms, f.steps, f.outcome, f.findings, f.stuckAt])),
  ]));
  await writeFile(path.join(run, "steps.csv"), csv([
    ["bot", "persona", "flow", "at", "t_ms", "ms", "action"],
    ...results.flatMap(r => (r.timeline || []).map(x => [r.bot, r.persona, x.journey, x.at, x.t, x.ms, x.action])),
  ]));
  await cp(OUT, path.join(run, "report"), { recursive: true });
  const runs = path.join(dir, "runs.csv");
  const line = [id, results.length, results.reduce((a, r) => a + r.passed, 0), groups.length, groups.filter(g => g.severity === "high").length, Math.round(secs),
    Math.round(results.reduce((a, r) => a + (r.loadMs || 0), 0) / results.length)];
  if (!existsSync(runs)) await writeFile(runs, csv([["run", "bots", "checks_passed", "distinct_findings", "high_findings", "seconds", "avg_first_load_ms"]]));
  await appendFile(runs, csv([line]));
  console.log(`Session logs saved to ${run}`);
}

/* ---------- main ---------- */

async function main() {
  if (!existsSync(path.join(root, "dist", "index.html"))) {
    console.error("No build found. Run `npm run build` first.");
    process.exit(1);
  }
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const server = await preview({ root, preview: { port: 4173, strictPort: false, host: "127.0.0.1" }, logLevel: "silent" });
  const baseURL = server.resolvedUrls.local[0].replace(/\/$/, "");
  const browser = await chromium.launch({
    headless: !flag("--headed"),
    executablePath: process.env.CHROMIUM_PATH || (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined),
  });

  // A small "meal photo" for the photo bots.
  const pg = await browser.newPage();
  const photo = Buffer.from(await pg.evaluate(() => {
    const c = Object.assign(document.createElement("canvas"), { width: 640, height: 480 });
    const x = c.getContext("2d");
    x.fillStyle = "#f4efe6"; x.fillRect(0, 0, 640, 480);
    x.fillStyle = "#e9805a"; x.fillRect(120, 140, 220, 120);
    x.fillStyle = "#fff"; x.beginPath(); x.arc(440, 260, 90, 0, 7); x.fill();
    return c.toDataURL("image/jpeg").split(",")[1];
  }), "base64");
  await pg.close();

  const only = opt("--only")?.split(",").map(s => s.trim().toLowerCase());
  const list = PERSONAS.map((p, i) => [p, i]).filter(([p]) => !only || only.some(o => p.name.toLowerCase().includes(o)));
  const started = Date.now();
  const results = [];
  let next = 0;
  async function worker() {
    while (next < list.length) {
      const [p, i] = list[next++];
      const bot = new Bot(p, i, browser, baseURL, photo);
      try {
        const r = await bot.run();
        results.push(r);
        console.log(`${r.issues.length ? "✗" : "✓"} ${r.persona.padEnd(32)} ${r.device.padEnd(22)} ${String(r.passed).padStart(3)} ok  ${r.issues.length} findings  ${r.seconds}s`);
      } catch (e) {
        console.log(`! ${p.name}: ${e.message}`);
        results.push({ bot: bot.slug, persona: p.name, device: p.device, sport: p.sport, passed: 0, issues: [{ severity: "high", title: "Bot crashed", detail: e.message, screenshot: "" }], notes: [], seconds: 0 });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker));
  results.sort((a, b) => a.bot.localeCompare(b.bot));
  const groups = groupIssues(results);
  const secs = (Date.now() - started) / 1000;
  await writeFile(path.join(OUT, "report.json"), JSON.stringify({ when: new Date().toISOString(), results, groups: groups.map(g => ({ ...g, details: [...g.details] })) }, null, 2));
  await writeFile(path.join(OUT, "report.md"), markdown(results, groups, secs));
  const saveTo = opt("--save-to") || process.env.BOT_LOG_DIR;
  if (saveTo) await saveSessions(saveTo, results, groups, secs);
  console.log(`\n${results.length} bots, ${groups.length} distinct findings. Report: bots/report/report.md`);
  await browser.close();
  await new Promise(r => server.httpServer.close(r));
}

main().catch(e => { console.error(e); process.exit(1); });
