// Tops up the PostHog demo data (made on 5 Oct by bot-tests/posthog-backfill.py) to today:
// the same 38 demo people keep their habits (sport, device, how often, morning or evening)
// from where the backfill stopped. Events only; PostHog can't backdate replays.
// Every event carries demo_seed: true, like the backfill, so it can be filtered out.
//
//   node bots/posthog-topup.mjs            dry run: counts what it would send
//   node bots/posthog-topup.mjs --send     sends it
//   --from 2026-10-05T00:30:00Z            start (default: just after the backfill ended)
//
// Running it twice sends everything twice, so pass --from with the last run's time instead.

const KEY = "phc_mMfaKrnG5d2ffhBYFoja382FEGvV2xypDTwXThKZJHoN";
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const SEND = process.argv.includes("--send");
const START = Date.parse("2026-08-31T00:00:00Z"); // day 0 of the backfill
const FROM = Date.parse(arg("--from") || "2026-10-05T00:30:00Z");
const TO = Date.now() - 10 * 60000;

// id, name, email, time zone, sport, device, joined (day), visits a week, stopped after (day), evenings
const PEOPLE = 
[
  ["bot-1", "Maya Chen", "maya.chen7@example.com", "America/New_York", "lifting", "iPhone SE", 11, 2.16, 99, false],
  ["bot-2", "Jordan Reyes", "jordan.reyes8@example.com", "America/New_York", "lifting", "iPhone 15", 0, 4.636, 99, true],
  ["bot-3", "Priya Nair", "priya.nair9@example.com", "Asia/Kolkata", "lifting", "Pixel 7", 0, 3.071, 99, true],
  ["bot-4", "Sam Okafor", "sam.okafor10@example.com", "America/New_York", "lifting", "Galaxy A14", 15, 4.035, 99, false],
  ["bot-5", "Alex Kim", "alex.kim11@example.com", "America/New_York", "lifting", "iPhone 15", 5, 4.642, 99, true],
  ["bot-6", "Chris Walsh", "chris.walsh12@example.com", "America/New_York", "lifting", "iPhone 15 Pro Max", 24, 3.738, 99, false],
  ["bot-7", "Dee Martinez", "dee.martinez13@example.com", "America/New_York", "lifting", "Pixel 7", 19, 4.292, 99, true],
  ["bot-8", "Ravi Patel", "ravi.patel14@example.com", "America/New_York", "lifting", "iPhone SE", 0, 4.64, 99, false],
  ["bot-9", "Tom Becker", "tom.becker15@example.com", "America/New_York", "lifting", "Laptop", 0, 3.311, 99, false],
  ["bot-10", "Kim Nguyen", "kim.nguyen16@example.com", "America/New_York", "lifting", "iPhone 15", 19, 3.206, 99, true],
  ["bot-11", "Lee Park", "lee.park17@example.com", "America/New_York", "lifting", "Galaxy Fold (folded)", 0, 2.511, 99, true],
  ["bot-12", "Ana Silva", "ana.silva18@example.com", "America/New_York", "lifting", "iPhone 15", 0, 4.606, 99, true],
  ["bot-13", "Ben Carter", "ben.carter19@example.com", "America/New_York", "lifting", "Pixel 7", 0, 3.985, 99, false],
  ["bot-14", "Noah Fischer", "noah.fischer20@example.com", "America/New_York", "lifting", "iPhone 15", 0, 3.575, 99, true],
  ["bot-15", "Zoe Adams", "zoe.adams21@example.com", "America/New_York", "climbing", "iPhone 15", 0, 2.605, 99, false],
  ["bot-16", "Marco Rossi", "marco.rossi22@example.com", "America/New_York", "climbing", "Pixel 7", 0, 3.2, 99, false],
  ["bot-17", "Ivy Brooks", "ivy.brooks23@example.com", "America/New_York", "climbing", "iPhone SE", 13, 2.131, 99, true],
  ["bot-18", "Hugo Laurent", "hugo.laurent24@example.com", "America/New_York", "climbing", "Galaxy A14", 19, 2.866, 99, true],
  ["bot-19", "Nina Kowalski", "nina.kowalski25@example.com", "America/New_York", "climbing", "iPad", 0, 2.858, 99, true],
  ["bot-20", "Eli Turner", "eli.turner26@example.com", "America/New_York", "climbing", "iPhone 15", 0, 2.766, 25, true],
  ["bot-21", "Grace Lin", "grace.lin27@example.com", "America/New_York", "food", "iPhone 15", 29, 5.416, 38, true],
  ["bot-22", "Omar Haddad", "omar.haddad28@example.com", "America/New_York", "food", "Pixel 7", 27, 6.883, 39, true],
  ["bot-23", "Lena Vogel", "lena.vogel29@example.com", "America/New_York", "food", "iPhone SE", 10, 5.866, 23, false],
  ["bot-24", "Femi Adebayo", "femi.adebayo30@example.com", "America/New_York", "food", "iPhone 15 Pro Max", 20, 6.248, 99, false],
  ["bot-25", "Sara Lindqvist", "sara.lindqvist31@example.com", "America/New_York", "food", "Galaxy A14", 0, 4.976, 99, true],
  ["bot-26", "Will Hughes", "will.hughes32@example.com", "America/New_York", "food", "iPhone 15", 0, 4.534, 20, false],
  ["bot-27", "Hana Sato", "hana.sato33@example.com", "America/New_York", "food", "Pixel 7", 8, 6.186, 99, false],
  ["bot-28", "Leo Moreau", "leo.moreau34@example.com", "America/New_York", "food", "iPhone 15", 22, 5.243, 99, false],
  ["bot-29", "Aroha Ngata", "aroha.ngata35@example.com", "Pacific/Auckland", "food", "iPhone 15", 0, 4.473, 99, false],
  ["bot-30", "Dylan Price", "dylan.price36@example.com", "America/New_York", "food", "Pixel 7", 0, 6.834, 99, true],
  ["bot-31", "Lucia Gomez", "lucia.gomez37@example.com", "America/New_York", "food", "Galaxy A14", 12, 5.857, 99, false],
  ["bot-32", "Jade Murphy", "jade.murphy38@example.com", "America/New_York", "food", "iPhone SE", 0, 6.202, 99, true],
  ["bot-33", "Ryan Cooper", "ryan.cooper39@example.com", "America/New_York", "food", "Small laptop", 0, 6.156, 99, false],
  ["bot-34", "Mei Zhang", "mei.zhang40@example.com", "America/New_York", "food", "Galaxy Fold (folded)", 24, 4.243, 99, false],
  ["bot-35", "Riley Shaw", "riley.shaw41@example.com", "America/New_York", "lifting", "iPhone 15", 0, 2.609, 99, false],
  ["bot-36", "Kai Jensen", "kai.jensen42@example.com", "America/New_York", "lifting", "Pixel 7", 0, 3.595, 99, true],
  ["bot-37", "Isla Grant", "isla.grant43@example.com", "America/New_York", "food", "iPad", 0, 5.914, 99, false],
  ["bot-38", "Theo Russo", "theo.russo44@example.com", "America/New_York", "lifting", "iPhone SE", 0, 2.503, 99, true],
];

const DEV = {
  "iPhone SE": ["Mobile Safari", "iOS", "Mobile", 375, 667],
  "iPhone 15": ["Mobile Safari", "iOS", "Mobile", 393, 852],
  "iPhone 15 Pro Max": ["Mobile Safari", "iOS", "Mobile", 430, 932],
  "Pixel 7": ["Chrome", "Android", "Mobile", 412, 915],
  "Galaxy A14": ["Samsung Internet", "Android", "Mobile", 360, 640],
  "Galaxy Fold (folded)": ["Chrome", "Android", "Mobile", 280, 653],
  "iPad": ["Mobile Safari", "iOS", "Tablet", 820, 1180],
  "Laptop": ["Chrome", "Mac OS X", "Desktop", 1440, 900],
  "Small laptop": ["Chrome", "Windows", "Desktop", 1280, 720],
};
const FOOD_SRC = [..."cccc", ..."uuu", ..."oo", ..."ff", "x"].map(c => ({ c: "common", u: "usda", o: "off", f: "fatsecret", x: "custom" })[c]);
const BOULDER = ["V1", "V2", "V3", "V4", "V5", "V6"];
const SPORT = ["5.9", "5.10a", "5.10b", "5.10c", "5.10d", "5.11a", "5.11b", "5.11c"];
const WORKOUTS = ["Push", "Pull", "Legs", "Upper", "Lower", "Full body", "Workout"];

// Seeded, so a dry run and --send produce the same events.
let seed = 645902;
const random = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const uniform = (a, b) => a + random() * (b - a);
const randint = (a, b) => a + Math.floor(random() * (b - a + 1));
const choice = xs => xs[Math.floor(random() * xs.length)];
const uuid4 = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.floor(random() * 16); return (c === "x" ? r : (r & 3) | 8).toString(16); });
const uuid7 = ms => { const h = ms.toString(16).padStart(12, "0"); const u = uuid4().replace(/-/g, ""); return `${h.slice(0, 8)}-${h.slice(8, 12)}-7${u.slice(13, 16)}-${u.slice(16, 20)}-${u.slice(20, 32)}`; };

// Local calendar date in a time zone, and the UTC time of a local hour on a local date.
const local = (ms, tz) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23", weekday: "short" }).formatToParts(ms).map(x => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second, weekend: p.weekday === "Sat" || p.weekday === "Sun" };
};
const atLocal = (day, hours, tz) => {
  const guess = Date.UTC(day.y, day.m - 1, day.d) + hours * 3600000;
  const l = local(guess, tz);
  const offset = Date.UTC(l.y, l.m - 1, l.d, l.h, l.mi, l.s) - Math.floor(guess / 1000) * 1000;
  return guess - offset;
};

const events = [];
const today = Math.floor((TO - START) / 86400000);
for (const [id, , , tz, sport, device, join, perWeek, drop, evening] of PEOPLE) {
  const [b, os, dt, w, h] = DEV[device] || DEV["iPhone 15"];
  for (let n = Math.max(join, 34); n <= today; n++) {
    if (n > drop) break;
    const day = local(START + n * 86400000, tz);
    const p = perWeek / 7 * (day.weekend && sport === "lifting" ? 0.6 : 1);
    if (random() > p) continue;
    let slots;
    if (sport === "food") {
      slots = [[7, 9.5, "breakfast"], [11.5, 14, "lunch"], [18, 21, "dinner"]];
      if (random() < 0.4) slots.push([15, 16.5, "snacks"]);
      const kept = slots.filter(() => random() < 0.85);
      slots = kept.length ? kept : slots.slice(0, 1);
    } else if (sport === "climbing") slots = [day.weekend ? [10, 16, null] : [17.5, 21, null]];
    else slots = [evening ? [17, 20.5, null] : [5.5, 8.5, null]];
    for (const [lo, hi, meal] of slots) {
      const t = atLocal(day, uniform(lo, hi), tz);
      if (t < FROM || t > TO) continue;
      const base = { distinct_id: id, $session_id: uuid7(t), $lib: "web", $browser: b, $os: os, $device_type: dt,
        $screen_width: w, $screen_height: h, $viewport_width: w, $viewport_height: h, $host: "justsend.fit",
        $timezone: tz, $current_url: "https://justsend.fit/", $pathname: "/", $referrer: "$direct", demo_seed: true };
      const ev = (event, sec, props) => events.push({ event, properties: { ...base, ...props }, timestamp: new Date(t + sec * 1000).toISOString(), uuid: uuid4() });
      ev("$pageview", 0);
      let sec = randint(20, 60);
      if (sport === "food") {
        for (let k = choice([1, 1, 2, 2, 3]); k > 0; k--) {
          if (random() < 0.12) {
            ev("barcode_scanned", sec, { found: random() < 0.85 }); sec += 8;
            ev("food_logged", sec, { source: "off", meal, kcal: randint(60, 750) });
          } else if (random() < 0.1) {
            ev("meal_photo_scanned", sec, { items: randint(1, 4), remaining: randint(0, 2) }); sec += 10;
            ev("food_logged", sec, { source: "photo", meal, items: randint(1, 4) });
          } else ev("food_logged", sec, { source: choice(FOOD_SRC), meal, kcal: randint(60, 750) });
          sec += randint(15, 70);
        }
      } else if (sport === "climbing") {
        const style = random() < 0.7 ? "boulder" : "sport";
        for (let k = randint(2, 7); k > 0; k--) {
          ev("climb_logged", sec, { grade: choice(style === "boulder" ? BOULDER : SPORT), style, sent: random() < 0.65, attempts: randint(1, 6) });
          sec += randint(240, 900);
        }
      } else {
        sec += randint(1800, 4500);
        const ex = randint(3, 7);
        ev("workout_logged", sec, { title: choice(WORKOUTS), exercises: ex, sets: ex * randint(3, 4), backdated: random() < 0.08 });
      }
      if (random() < 0.05) {
        const other = choice(["lifting", "climbing", "food"].filter(x => x !== sport));
        ev("sport_switched", sec + 5, { from: sport, to: other }); sec += 30;
        ev("sport_switched", sec + 5, { from: other, to: sport });
      }
      ev("$pageleave", sec + randint(10, 60));
    }
  }
}

const counts = {};
events.forEach(e => { counts[e.event] = (counts[e.event] || 0) + 1; });
const times = events.map(e => e.timestamp).sort();
console.log(`${new Set(events.map(e => e.properties.distinct_id)).size} people, ${events.length} events, ${times[0]} to ${times.at(-1)}`);
console.log(counts);
if (process.argv.includes("--hours")) { const hs = {}; events.filter(e => e.event === "$pageview").forEach(e => { const k = `${e.properties.$timezone} ${local(Date.parse(e.timestamp), e.properties.$timezone).h}`; hs[k] = (hs[k] || 0) + 1; }); console.log(hs); }
if (SEND) {
  for (let i = 0; i < events.length; i += 400) {
    const r = await fetch("https://us.i.posthog.com/batch/", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: KEY, historical_migration: true, batch: events.slice(i, i + 400) }) });
    console.log(i, r.status, (await r.text()).slice(0, 80));
    if (!r.ok) process.exit(1);
  }
  console.log(`Sent. Next time run with --from ${new Date(TO).toISOString()}`);
} else console.log("Dry run. Add --send to send these to PostHog.");
