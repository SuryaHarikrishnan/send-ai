// What each bot tries to do. A journey is a little script with checks; a
// failed check becomes a finding in the report, with a screenshot.

const tabbar = b => b.page.locator("nav.tabbar");
const tab = (b, label) => tabbar(b).getByRole("button", { name: label, exact: true });

async function switchSport(b, name) {
  await b.tap(tabbar(b).getByRole("button", { name: "Change sport" }), "sport switcher");
  await b.tap(b.page.getByRole("dialog", { name: "Choose a sport" }).getByRole("button", { name: new RegExp(`^${name}`) }), `${name} in sport sheet`);
}

async function ensureSport(b, sport) {
  const names = { lifting: "Lifting", climbing: "Climbing", food: "Food" };
  const now = await b.page.locator(".topbar-sport").textContent().catch(() => "");
  if (!now?.includes(names[sport])) await switchSport(b, names[sport]);
}

/* ---------- lifting ---------- */

async function openLog(b) {
  await ensureSport(b, "lifting");
  await b.tap(tab(b, "Log workout"), "Log workout tab");
  await b.expectVisible(b.page.getByRole("heading", { name: "Log workout" }), "Log workout screen opens");
}

async function addExercise(b, search, pick) {
  await b.type(b.page.locator("#ep-search"), search, "exercise search");
  await b.tap(b.page.locator(".ep-row", { hasText: pick }).first(), `${pick} in exercise list`);
}

async function fillSets(b, exIndex, sets) {
  const card = b.page.locator("section.wl-ex").nth(exIndex);
  for (let i = 0; i < sets.length; i++) {
    const [reps, weight] = sets[i];
    await b.type(card.getByLabel(`Set ${i + 1} reps`), String(reps), `set ${i + 1} reps`);
    await b.type(card.getByLabel(`Set ${i + 1} weight`), String(weight), `set ${i + 1} weight`);
  }
}

async function saveWorkout(b) {
  await b.tap(b.page.getByRole("button", { name: "Save workout" }), "Save workout");
}

export const journeys = {
  async liftFirstWorkout(b) {
    await ensureSport(b, "lifting");
    if (!b.db.workouts.length) await b.expectVisible(b.page.getByText("No workouts yet"), "new user sees the empty state");
    const before = b.db.workouts.length;
    await openLog(b);
    await b.tap(b.page.locator(".wl-chips button", { hasText: "Legs" }), "Legs chip");
    await addExercise(b, "squat", "Back squat");
    await fillSets(b, 0, [[5, 135], [5, 135], [5, 135]]);
    await b.tap(b.page.getByLabel("Mark set 1 done and start rest"), "set 1 done");
    await b.expectVisible(b.page.getByRole("timer"), "rest timer appears after a set");
    await b.tap(b.page.locator(".wl-rest-skip"), "skip rest");
    await b.tap(b.page.locator(".wl-dur"), "duration");
    await b.tap(b.page.getByRole("dialog", { name: "Workout length" }).getByRole("button", { name: "Done" }), "duration Done");
    await saveWorkout(b);
    await b.expectVisible(b.page.locator(".lift-wo").filter({ hasText: "Back squat" }).first(), "saved workout shows on Home");
    const w = b.db.workouts[b.db.workouts.length - 1];
    b.check(b.db.workouts.length === before + 1, "exactly one workout saved", `${b.db.workouts.length - before} rows were added`);
    if (w) {
      b.check(w.title === "Legs", "workout name is Legs", `saved as "${w.title}"`);
      b.check(w.exercises?.[0]?.sets?.length === 3 && w.exercises[0].sets.every(s => s.reps === 5 && s.weight === 135), "3 sets of 5 x 135 saved", JSON.stringify(w.exercises));
      b.check(w.duration_min === 60, "duration saved as 60 min after tapping Done on the default", `duration_min = ${w.duration_min}`);
      const saved = new Date(w.performed_at);
      const shownToday = await b.page.locator(".lift-wo").first().textContent();
      b.check(/Today/.test(shownToday || ""), "new workout is labelled Today", `card says: ${shownToday?.slice(0, 80)} (saved ${saved.toISOString()})`);
    }
  },

  async liftRepeatLast(b) {
    await openLog(b);
    await b.tap(b.page.locator(".wl-chips button", { hasText: "Push" }), "Push chip");
    const repeat = b.page.locator(".wl-repeat");
    await b.expectVisible(repeat, "'Repeat last Push' shows for a returning lifter");
    await b.tap(repeat, "Repeat last Push");
    const first = b.page.locator("section.wl-ex").first();
    const w0 = Number(await first.getByLabel("Set 1 weight").inputValue().catch(() => 0));
    await b.type(first.getByLabel("Set 1 weight"), String(w0 + 10), "heavier first set");
    await saveWorkout(b);
    await b.expectVisible(b.page.locator(".lift-wo").first(), "back on Home after saving");
    const pr = await b.page.locator(".lift-wo").first().locator(".lift-pr").count();
    b.check(pr > 0, "a heavier bench set gets a PR badge", "no PR badge on the new workout");
  },

  async liftProgress(b) {
    await ensureSport(b, "lifting");
    await b.tap(tab(b, "Progress"), "Progress tab");
    await b.expectVisible(b.page.getByRole("heading", { name: "Your lifts" }), "Progress screen opens");
    const row = b.page.locator(".lp-row").first();
    if (await row.count()) {
      await b.tap(row, "first lift in All lifts");
      await b.expectVisible(b.page.locator(".lift-title"), "exercise detail opens");
      await b.shot("exercise-detail");
    }
    await b.type(b.page.getByLabel("Search your lifts").first(), "zzz", "search lifts for nonsense").catch(() => {});
  },

  async liftDelete(b) {
    await ensureSport(b, "lifting");
    await b.tap(tab(b, "Home"), "Home tab");
    const before = b.db.workouts.length;
    const card = b.page.locator(".lift-wo").first();
    const title = await card.locator(".lift-wo-name b").textContent();
    await b.tap(card.locator(".lift-del"), "Delete on a workout");
    await b.tap(card.getByRole("button", { name: "Delete" }), "confirm Delete");
    await b.page.waitForTimeout(b.persona.faults.latency ? 3500 : 600);
    if (b.persona.faults.failWrites) {
      const msg = await b.page.getByText(/couldn.t|failed|try again|error/i).count();
      b.check(msg > 0, "a failed delete tells the user", `delete of "${title}" failed on the server and the screen showed no message; the workout just stayed`);
    } else {
      b.check(b.db.workouts.length === before - 1, "workout removed from the database", `${before} -> ${b.db.workouts.length}`);
    }
  },

  async liftWeeklyGoal(b) {
    await ensureSport(b, "lifting");
    const raise = b.page.getByLabel("Raise weekly goal");
    for (let i = 0; i < 6; i++) await b.tap(raise, "raise weekly goal");
    const goal = await b.page.locator(".lift-stepper b").textContent();
    b.check(goal === "7", "weekly goal stops at 7", `goal shows ${goal}`);
    await b.page.reload();
    await b.expectVisible(b.page.locator(".lift-stepper b"), "home reloads");
    const after = await b.page.locator(".lift-stepper b").textContent();
    b.check(after === "7", "weekly goal survives a reload", `after reload: ${after}`);
  },

  async liftMistakes(b) {
    await openLog(b);
    const save = b.page.getByRole("button", { name: "Save workout" });
    b.check(await save.isDisabled(), "Save is disabled with no exercises", "Save was tappable with nothing logged");
    await addExercise(b, "bench", "Bench press");
    await saveWorkout(b);
    await b.expectVisible(b.page.locator(".wl-error"), "saving empty sets shows an error");
    // Typos: negative weight, absurd reps, a typo'd zero.
    await fillSets(b, 0, [[8, -135], [9999, 135], [0, 135]]);
    await b.type(b.page.getByLabel("Name"), "💪 Chest day!!! with a really long name that goes on", "workout name with emoji");
    const date = b.page.getByLabel("Date");
    const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    await date.fill(future).catch(() => {});
    await saveWorkout(b);
    await b.page.waitForTimeout(800);
    const w = b.db.workouts[b.db.workouts.length - 1];
    if (!w) return b.issue("high", "Workout with typos didn't save", "Expected a saved workout or a clear error.");
    const sets = w.exercises[0].sets;
    b.check(!sets.some(s => s.weight < 0), "negative weight is rejected", `saved a set with weight ${sets.find(s => s.weight < 0)?.weight} lb`);
    b.check(!sets.some(s => s.reps > 500), "absurd rep counts are questioned", `saved a set with ${sets.find(s => s.reps > 500)?.reps} reps without a warning`);
    b.check(new Date(w.performed_at).getTime() < Date.now() + 3600000, "future dates are rejected", `typed ${future} into Date and the workout saved for the future (${w.performed_at})`);
    b.note(`name saved as "${w.title}" (${w.title.length} chars)`);
  },

  async liftDoubleTap(b) {
    await openLog(b);
    await addExercise(b, "deadlift", "Deadlift");
    await fillSets(b, 0, [[5, 225], [5, 225], [5, 225]]);
    const before = b.db.workouts.length;
    await b.page.getByRole("button", { name: "Save workout" }).dblclick({ timeout: 5000 }).catch(e => b.issue("medium", "Couldn't double-tap Save", e.message.split("\n")[0]));
    await b.page.waitForTimeout(1200);
    b.check(b.db.workouts.length - before === 1, "double-tapping Save saves once", `${b.db.workouts.length - before} copies saved`);
  },

  async liftAbandon(b) {
    await openLog(b);
    await addExercise(b, "row", "Barbell row");
    await fillSets(b, 0, [[8, 115], [8, 115]]);
    await b.tap(tab(b, "Home"), "Home tab mid-workout (checking a text)");
    await b.tap(tab(b, "Log workout"), "back to Log workout");
    const kept = await b.page.locator("section.wl-ex").count();
    b.check(kept > 0, "an unsaved workout survives leaving the Log tab", "the half-logged workout (Barbell row, 2 sets) was wiped with no warning after tapping Home");
    await b.page.reload();
    await b.page.waitForTimeout(800);
  },

  async liftCustomExercise(b) {
    await openLog(b);
    await b.type(b.page.locator("#ep-search"), "Zercher carry", "exercise search");
    await b.tap(b.page.locator(".ep-custom"), "Add \"Zercher carry\" as own exercise");
    await fillSets(b, 0, [[1, 185], [1, 185], [1, 185]]);
    await saveWorkout(b);
    await b.expectVisible(b.page.getByText("Zercher carry").first(), "custom exercise shows on Home");
    await openLog(b);
    await b.tap(b.page.locator(".ep-chips button", { hasText: "Recent" }), "Recent chip");
    await b.expectVisible(b.page.locator(".ep-row", { hasText: "Zercher carry" }), "custom exercise is in Recent next time");
  },

  async liftBackdate(b) {
    await openLog(b);
    // "Yesterday" in the bot's own time zone, not this machine's.
    const iso = await b.page.evaluate(() => { const y = new Date(Date.now() - 86400000); return new Date(y.getTime() - y.getTimezoneOffset() * 60000).toISOString().slice(0, 10); });
    await b.page.getByLabel("Date").fill(iso);
    await addExercise(b, "pull-up", "Pull-up");
    await fillSets(b, 0, [[10, 0], [8, 0], [6, 0]]);
    await saveWorkout(b);
    await b.expectVisible(b.page.locator(".lift-wo").first(), "back on Home");
    const label = await b.page.locator(".lift-wo", { hasText: "Pull-up" }).first().locator("small").first().textContent();
    b.check(/Yesterday/.test(label || ""), "backdated workout says Yesterday", `card says "${label}"`);
  },

  async liftRestTimer(b) {
    await openLog(b);
    await addExercise(b, "curl", "Barbell curl");
    await fillSets(b, 0, [[10, 60]]);
    await b.tap(b.page.getByLabel("Mark set 1 done and start rest"), "set 1 done");
    const timer = b.page.getByRole("timer");
    await b.expectVisible(timer, "rest timer shows");
    await b.tap(b.page.getByLabel("15 seconds more"), "+15");
    const t = await timer.locator("b").textContent();
    b.check(/^1:4\d$/.test(t || ""), "+15 takes 90 s rest to about 1:45", `timer shows ${t}`);
    // Is the Save button still reachable with the timer open?
    const save = b.page.getByRole("button", { name: "Save workout" });
    await save.scrollIntoViewIfNeeded();
    const covered = await b.coveredBy(save);
    b.check(!covered, "rest timer doesn't cover Save", `Save is under ${covered}`);
    await b.tap(b.page.locator(".wl-rest-skip"), "skip");
    await b.tap(b.page.getByLabel(/Set 1 done, tap to undo/), "undo set 1");
  },

  async liftSaveFails(b) {
    await openLog(b);
    await addExercise(b, "bench", "Bench press");
    await fillSets(b, 0, [[5, 185], [5, 185], [5, 185]]);
    await saveWorkout(b);
    await b.expectVisible(b.page.locator(".wl-error"), "failed save shows an error");
    const msg = await b.page.locator(".wl-error").textContent().catch(() => "");
    b.note(`save error text: "${msg}"`);
    b.check(!/upstream connect|disconnect\/reset/i.test(msg || ""), "save error is in plain words", `user sees: "${msg}"`);
    const kept = await b.page.locator("section.wl-ex").count();
    b.check(kept === 1, "the workout stays on screen to retry", `exercises on screen after failure: ${kept}`);
  },

  /* ---------- climbing ---------- */

  async climbLog(b) {
    await ensureSport(b, "climbing");
    const before = b.db.climbs.length;
    await b.tap(tab(b, "Log climb"), "Log climb tab");
    await b.page.locator("select.log-select").selectOption("V4");
    await b.tap(b.page.locator(".btn-group button", { hasText: "overhang" }), "overhang");
    await b.tap(b.page.locator(".btn-group button", { hasText: "crimp" }), "crimp");
    await b.tap(b.page.locator(".attempts-row button").nth(1), "+ attempt");
    await b.tap(b.page.locator(".btn-group button", { hasText: "Yes" }), "Sent yes");
    await b.tap(b.page.locator(".save-btn"), "Log Climb");
    await b.expectVisible(b.page.getByText("✓ Saved"), "climb shows Saved");
    b.check(b.db.climbs.length === before + 1, "one climb saved", `${b.db.climbs.length - before} rows`);
    const c = b.db.climbs.at(-1);
    b.check(c?.grade === "V4" && c?.attempts === 2 && c?.sent === true, "climb saved with the right grade, attempts and send", JSON.stringify(c));
  },

  async climbFirst(b) {
    await ensureSport(b, "climbing");
    await b.shot("climbing-home-empty");
    const text = await b.page.locator("main").textContent();
    b.check(!/Welcome back/.test(text) || b.persona.returning, "a brand-new climber isn't greeted with 'Welcome back'", "new climber with 0 climbs sees \"Welcome back. Here's where you stand.\" and empty stat cards, with no hint what to do first");
    await journeys.climbLog(b);
    await b.tap(tab(b, "Home"), "Home tab");
    const total = await b.page.locator(".home-stat-card").first().textContent();
    b.check(/^1/.test(total || ""), "Total climbs shows 1", `shows "${total}"`);
  },

  async climbSportGrade(b) {
    await ensureSport(b, "climbing");
    await b.tap(tab(b, "Log climb"), "Log climb tab");
    await b.tap(b.page.locator(".btn-group button", { hasText: "sport" }), "sport style");
    await b.page.locator("select.log-select").selectOption("5.11a");
    await b.tap(b.page.locator(".btn-group button", { hasText: "vertical" }), "vertical");
    await b.tap(b.page.locator(".btn-group button", { hasText: "pocket" }), "pocket");
    await b.tap(b.page.locator(".btn-group button", { hasText: "Yes" }), "Sent yes");
    await b.tap(b.page.locator(".save-btn"), "Log Climb");
    await b.expectVisible(b.page.getByText("✓ Saved"), "climb shows Saved");
    await b.tap(tab(b, "Home"), "Home tab");
    const top = await b.page.locator(".home-stat-card").nth(1).textContent();
    b.check(!/5\.11a/.test(top || ""), "Top Send shows the hardest send, not the latest", `after sending V6 earlier and a 5.11a today, Top Send shows "${top}" (it's just the most recent send)`);
  },

  async climbHome(b) {
    await ensureSport(b, "climbing");
    await b.tap(tab(b, "Home"), "Home tab");
    await b.page.waitForTimeout(800);
    const row = await b.page.locator(".recent-climb-row .recent-meta").first().textContent().catch(() => "");
    b.note(`recent climb row reads "${row}"`);
    const top = await b.page.locator(".home-stat-card").nth(1).textContent();
    const sent = b.db.climbs.filter(c => c.sent).map(c => c.grade);
    b.note(`sent grades: ${sent.join(", ")}; Top Send card: ${top}`);
  },

  async climbAnalytics(b) {
    await ensureSport(b, "climbing");
    await b.tap(tab(b, "Analytics"), "Analytics tab");
    await b.page.waitForTimeout(800);
    await b.shot("climbing-analytics");
  },

  async climbMistakes(b) {
    await ensureSport(b, "climbing");
    await b.tap(tab(b, "Log climb"), "Log climb tab");
    const save = b.page.locator(".save-btn");
    b.check(await save.isDisabled(), "Log Climb is disabled before a grade is picked", "tappable with no grade");
    await b.page.locator("select.log-select").selectOption("V2");
    await b.tap(save, "Log Climb without wall angle or holds");
    await b.page.waitForTimeout(400);
    const dlg = b.dialogs.at(-1);
    b.check(!dlg, "missing fields are pointed out on the page", `a browser pop-up said "${dlg}" (native alert, looks like an error box on phones)`);
    await b.tap(b.page.locator(".attempts-row button").first(), "− attempts at 1");
    const n = await b.page.locator(".attempts-row span").textContent();
    b.check(n === "1", "attempts can't go below 1", `attempts shows ${n}`);
  },

  async climbDelete(b) {
    await ensureSport(b, "climbing");
    await b.tap(tab(b, "Home"), "Home tab");
    const before = b.db.climbs.length;
    await b.tap(b.page.locator(".see-all-btn"), "See all");
    await b.tap(b.page.locator(".delete-btn").first(), "✕ on a climb");
    await b.page.waitForTimeout(500);
    b.check(b.db.climbs.length === before - 1, "climb deleted after confirming", `${before} -> ${b.db.climbs.length}`);
    const btn = await b.page.locator(".delete-btn").first().boundingBox();
    if (btn) b.check(btn.width >= 32 && btn.height >= 32, "climb delete ✕ is big enough to tap", `✕ is ${Math.round(btn.width)}x${Math.round(btn.height)} px, and sits right next to the row`);
  },

  async climbSaveFails(b) {
    await ensureSport(b, "climbing");
    await b.tap(tab(b, "Log climb"), "Log climb tab");
    await b.page.locator("select.log-select").selectOption("V3");
    await b.tap(b.page.locator(".btn-group button", { hasText: "slab" }), "slab");
    await b.tap(b.page.locator(".btn-group button", { hasText: "jug" }), "jug");
    await b.tap(b.page.locator(".save-btn"), "Log Climb");
    await b.page.waitForTimeout(600);
    const dlg = b.dialogs.at(-1);
    b.check(!dlg, "a failed climb save explains itself on the page", `a browser pop-up showed the raw server error: "${dlg}"`);
  },

  /* ---------- food ---------- */

  async foodSearch(b) {
    await ensureSport(b, "food");
    await b.tap(tab(b, "Home"), "Home tab");
    await b.tap(b.page.locator(".fd-meal", { hasText: "Breakfast" }).locator(".fd-addfood"), "Add Food on Breakfast");
    await b.type(b.page.getByLabel("Search foods"), "banana", "food search");
    const card = b.page.locator(".fl-item", { hasText: "Banana, raw" }).first();
    await b.expectVisible(card, "Banana shows in search results");
    await b.tap(card.locator(".fl-item-main"), "Banana, raw");
    const sheet = b.page.getByRole("dialog", { name: "Banana, raw" });
    await b.expectVisible(sheet, "amount sheet opens");
    await b.type(sheet.getByLabel("Amount"), "2", "amount 2");
    await b.tap(sheet.locator(".fd-primary"), "Add to Breakfast");
    await b.expectVisible(b.page.locator(".fl-toast"), "toast confirms the add");
    await b.tap(b.page.getByRole("button", { name: "Done" }), "Done");
    const entry = b.page.locator(".fd-meal", { hasText: "Breakfast" }).locator(".fd-entry", { hasText: "Banana" });
    await b.expectVisible(entry, "banana shows under Breakfast");
    const row = b.db.food_logs.at(-1);
    b.check(row?.meal === "breakfast", "logged to breakfast", `meal = ${row?.meal}`);
    b.check(Math.abs((row?.kcal || 0) - 210) < 3, "2 servings of banana ≈ 210 kcal", `kcal = ${row?.kcal}`);
  },

  async foodRestaurant(b) {
    await ensureSport(b, "food");
    await b.tap(tab(b, "Add food"), "Add food tab");
    await b.type(b.page.getByLabel("Search foods"), "dominos", "food search");
    await b.expectVisible(b.page.getByText("Powered by fatsecret"), "FatSecret credit shows");
    const before = b.db.food_logs.length;
    await b.tap(b.page.locator(".fl-item", { hasText: "Pepperoni" }).first().locator(".fl-plus"), "quick add pizza");
    await b.expectVisible(b.page.locator(".fl-toast"), "toast confirms");
    b.check(b.db.food_logs.length === before + 1, "one pizza logged", `${b.db.food_logs.length - before}`);
  },

  async foodQuickAddDouble(b) {
    await ensureSport(b, "food");
    await b.tap(tab(b, "Add food"), "Add food tab");
    await b.type(b.page.getByLabel("Search foods"), "", "clear search");
    await b.tap(b.page.getByRole("tab", { name: "Common" }), "Common tab");
    const before = b.db.food_logs.length;
    const plus = b.page.locator(".fl-item .fl-plus").first();
    await plus.dblclick({ timeout: 5000 }).catch(e => b.issue("medium", "Couldn't double-tap +", e.message.split("\n")[0]));
    await b.page.waitForTimeout(b.persona.faults.latency ? 6000 : 1000);
    b.check(b.db.food_logs.length - before === 1, "double-tapping + adds the food once", `${b.db.food_logs.length - before} copies logged`);
    // Tapping + again on a food that's already ticked.
    await b.tap(plus, "+ again on a ticked food");
    await b.page.waitForTimeout(b.persona.faults.latency ? 6000 : 800);
    b.note(`after a third tap: ${b.db.food_logs.length - before} copies (the tick doesn't stop repeat adds)`);
  },

  async foodBarcode(b) {
    await ensureSport(b, "food");
    await b.tap(tab(b, "Add food"), "Add food tab");
    await b.tap(b.page.getByRole("button", { name: "Scan barcode" }), "Scan barcode");
    const box = b.page.locator(".bs input").first();
    await b.expectVisible(box, "with no camera, a box to type the barcode shows");
    const msg = await b.page.locator(".bs").textContent();
    b.note(`scanner text with no camera: "${msg?.replace(/\s+/g, " ").slice(0, 140)}"`);
    await b.type(box, "3017620422003", "barcode digits");
    await box.press("Enter");
    const sheet = b.page.getByRole("dialog", { name: "Nutella" });
    await b.expectVisible(sheet, "Nutella amount sheet opens");
    await b.tap(sheet.locator(".fd-primary"), "Add Nutella");
    await b.expectVisible(b.page.locator(".fl-toast"), "toast confirms");
    const row = b.db.food_logs.at(-1);
    b.check(row?.name === "Nutella" && Math.round(row.kcal) === 81, "1 serving (15 g) of Nutella ≈ 81 kcal", JSON.stringify(row && { name: row.name, kcal: row.kcal, unit: row.unit }));
  },

  async foodBarcodeUnknown(b) {
    await ensureSport(b, "food");
    await b.tap(tab(b, "Add food"), "Add food tab");
    await b.tap(b.page.getByRole("button", { name: "Scan barcode" }), "Scan barcode");
    const box = b.page.locator(".bs input").first();
    await b.type(box, "0000000012345", "barcode of a product with no nutrition");
    await box.press("Enter");
    await b.expectVisible(b.page.getByText(/no nutrition facts/i), "says it found it but has no nutrition");
    await b.tap(b.page.locator(".bs").getByRole("button", { name: /label|type|enter/i }).first(), "copy from label");
    const sheet = b.page.getByRole("dialog", { name: "Create a food" });
    await b.expectVisible(sheet, "Create a food opens prefilled");
    const name = await sheet.getByLabel("Name").inputValue();
    b.check(name === "Mystery granola", "name is prefilled from the barcode", `name = "${name}"`);
    await b.type(sheet.getByLabel("Calories"), "-120", "negative calories typo");
    const add = sheet.locator(".fd-primary");
    b.check(await add.isDisabled(), "negative calories can't be saved", "Add was enabled with -120 calories");
    await b.type(sheet.getByLabel("Calories"), "210", "calories");
    await b.tap(add, "Add");
    await b.expectVisible(b.page.locator(".fl-toast"), "toast confirms");
  },

  async foodPhoto(b) {
    await ensureSport(b, "food");
    await b.tap(tab(b, "Add food"), "Add food tab");
    await b.uploadPhoto();
    const sheet = b.page.getByRole("dialog", { name: "Meal photo" });
    await b.expectVisible(sheet.getByText("Grilled salmon"), "photo finds salmon");
    await b.tap(sheet.getByLabel("Remove Steamed broccoli"), "untick broccoli");
    await b.tap(sheet.getByRole("group", { name: "Portion of White rice" }).getByRole("button", { name: "1½" }), "1½ rice");
    const before = b.db.food_logs.length;
    await b.tap(sheet.locator(".fd-primary"), "Add 2 items");
    await b.expectVisible(b.page.locator(".fl-toast"), "toast confirms");
    b.check(b.db.food_logs.length === before + 2, "two items logged", `${b.db.food_logs.length - before}`);
    const rice = b.db.food_logs.find(r => r.name === "White rice" && r.source === "photo");
    b.check(rice && Math.round(rice.kcal) === 315, "1½ portions of rice = 315 kcal", `rice kcal ${rice?.kcal}`);
  },

  async foodPhotoLimit(b) {
    await ensureSport(b, "food");
    await b.tap(tab(b, "Add food"), "Add food tab");
    const sheet = b.page.getByRole("dialog", { name: "Meal photo" });
    for (let i = 0; i < 3; i++) {
      await b.uploadPhoto();
      await b.page.waitForTimeout(700);
      const text = await sheet.textContent().catch(() => "");
      if (/used your 3 photos/.test(text)) {
        b.note(`limit message after ${i} more photos: "${text.match(/You've used[^.]*\./)?.[0]}"`);
        const retry = await sheet.getByRole("button", { name: "Try another photo" }).count();
        b.check(retry === 0, "no 'Try another photo' once the limit is hit", "still offers Try another photo");
        return;
      }
      await b.tap(sheet.getByLabel("Close"), "close photo sheet");
    }
    b.issue("medium", "Photo limit never kicked in", "Took 4+ photos in a day without seeing the 3-a-day message.");
  },

  async foodPhotoNoFood(b) {
    await ensureSport(b, "food");
    await b.tap(tab(b, "Add food"), "Add food tab");
    await b.uploadPhoto();
    await b.expectVisible(b.page.getByText(/Couldn't spot any food/), "says no food was found and it didn't count");
  },

  async foodCustom(b) {
    await ensureSport(b, "food");
    await b.tap(tab(b, "Add food"), "Add food tab");
    await b.type(b.page.getByLabel("Search foods"), "grandma's lasagna", "search for a homemade dish");
    await b.page.waitForTimeout(900);
    await b.tap(b.page.locator(".fl-create"), "Create \"grandma's lasagna\"");
    const sheet = b.page.getByRole("dialog", { name: "Create a food" });
    const name = await sheet.getByLabel("Name").inputValue();
    b.check(name === "Grandma's lasagna", "name carried over from the search", `name = "${name}"`);
    await b.type(sheet.getByLabel("Serving"), "slice", "serving");
    await b.type(sheet.getByLabel("Protein (g)"), "22", "protein");
    await b.type(sheet.getByLabel("Carbs (g)"), "35", "carbs");
    await b.type(sheet.getByLabel("Fat (g)"), "18", "fat");
    await b.tap(sheet.locator(".fd-primary"), "Add");
    await b.expectVisible(b.page.locator(".fl-toast"), "toast confirms");
    const row = b.db.food_logs.at(-1);
    b.check(row && Math.round(row.kcal) === 390, "calories filled in from macros (22·4+35·4+18·9 = 390)", `kcal = ${row?.kcal}`);
  },

  async foodMine(b) {
    await ensureSport(b, "food");
    await b.tap(tab(b, "Add food"), "Add food tab");
    await b.tap(b.page.getByRole("tab", { name: "My Foods" }), "My Foods tab");
    await b.expectVisible(b.page.locator(".fl-item").first(), "logged foods show in My Foods");
  },

  async foodEdit(b) {
    await ensureSport(b, "food");
    await b.tap(tab(b, "Home"), "Home tab");
    const entry = b.page.locator(".fd-entry").first();
    if (!(await entry.count())) return b.note("nothing logged to edit");
    await b.tap(entry, "a logged food");
    const sheet = b.page.locator(".fd-sheet");
    await b.tap(sheet.getByLabel("More"), "+ amount");
    await b.tap(sheet.locator(".fd-primary"), "Save");
    await b.page.waitForTimeout(500);
    await b.tap(b.page.locator(".fd-entry").first(), "the food again");
    await b.tap(b.page.locator(".fd-del"), "Remove from log");
    await b.tap(b.page.locator(".fd-del-ask").getByRole("button", { name: "Remove" }), "confirm Remove");
    await b.page.waitForTimeout(500);
    b.check((await b.page.locator(".fd-entry").count()) === 0, "removed food is gone from the day", "still listed");
  },

  async foodGoals(b) {
    await ensureSport(b, "food");
    await b.tap(tab(b, "Home"), "Home tab");
    await b.tap(b.page.getByLabel("Edit goals"), "goals gear");
    const sheet = b.page.getByRole("dialog", { name: "Daily goals" });
    await b.type(sheet.getByLabel("Calories goal"), "0", "0 calories");
    b.check(await sheet.locator(".fd-primary").isDisabled(), "0-calorie goal can't be saved", "Save goals enabled");
    await b.type(sheet.getByLabel("Calories goal"), "2400", "2400 calories");
    await b.type(sheet.getByLabel("Protein goal"), "180", "180 protein");
    const note = await sheet.locator(".fd-sh-note").textContent();
    b.note(`goals note: "${note}"`);
    await b.tap(sheet.locator(".fd-primary"), "Save goals");
    await b.expectVisible(b.page.getByText("Budget: 2,400 cals"), "budget shows 2,400");
    b.check(true, "goals saved");
    b.note("goals live only in this browser (localStorage); a second phone or a reinstall starts back at 2,000");
  },

  async foodYesterday(b) {
    await ensureSport(b, "food");
    await b.tap(tab(b, "Home"), "Home tab");
    b.check(await b.page.getByLabel("Next day").isDisabled(), "can't go to tomorrow", "Next day enabled on today");
    await b.tap(b.page.getByLabel("Previous day"), "previous day");
    await b.tap(b.page.locator(".fd-meal", { hasText: "Lunch" }).locator(".fd-addfood"), "Add Food on yesterday's Lunch");
    await b.expectVisible(b.page.getByText("· Yesterday"), "add screen says Yesterday");
    await b.tap(b.page.getByRole("tab", { name: "Common" }), "Common tab");
    await b.tap(b.page.locator(".fl-item .fl-plus").first(), "quick add");
    await b.expectVisible(b.page.locator(".fl-toast"), "toast");
    const row = b.db.food_logs.at(-1);
    const isYest = await b.page.evaluate(at => new Date(at).toDateString() === new Date(Date.now() - 86400000).toDateString(), row.eaten_at);
    b.check(isYest, "logged on yesterday", `eaten_at ${row.eaten_at}`);
    await b.tap(b.page.getByRole("button", { name: "Done" }), "Done");
    const label = await b.page.locator(".fd-date-mid span").textContent();
    b.check(label !== "Today", "Done returns to yesterday, not today", `date pill says ${label}`);
  },

  async foodMidnight(b) {
    await ensureSport(b, "food");
    await b.tap(tab(b, "Add food"), "Add food tab");
    await b.tap(b.page.getByRole("tab", { name: "Common" }), "Common tab");
    await b.tap(b.page.locator(".fl-item .fl-plus").first(), "quick add a snack at 23:58");
    await b.expectVisible(b.page.locator(".fl-toast"), "toast");
    // Let the clock pass midnight while the screen is open.
    await b.page.clock.fastForward("05:00");
    await b.tap(b.page.locator(".fl-item .fl-plus").nth(1), "quick add another at 00:03");
    await b.page.waitForTimeout(400);
    await b.tap(b.page.getByRole("button", { name: "Done" }), "Done");
    const [a, z] = await b.page.evaluate(rows => rows.map(r => new Date(r.eaten_at).toString().slice(0, 21)), b.db.food_logs.slice(-2));
    b.note(`snack at 23:58 stamped ${a}; snack at 00:03 stamped ${z}`);
    b.check(a.slice(0, 10) !== z.slice(0, 10), "a snack logged just after midnight lands on the new day", `with the app left open past midnight, the 00:03 snack was saved as ${z} on the previous day (the screen's "today" never rolled over)`);
    const pill = await b.page.locator(".fd-date-mid span").textContent();
    b.check(pill === "Today", "the food home rolls over to the new day", `after midnight the date pill still shows "${pill}" instead of Today`);
  },

  async foodSaveFails(b) {
    await ensureSport(b, "food");
    await b.tap(tab(b, "Add food"), "Add food tab");
    await b.tap(b.page.getByRole("tab", { name: "Common" }), "Common tab");
    await b.tap(b.page.locator(".fl-item .fl-plus").first(), "quick add");
    await b.expectVisible(b.page.locator(".fl-toast"), "a toast explains the failure");
    const t = await b.page.locator(".fl-toast").textContent();
    b.note(`toast: "${t}"`);
    b.check(/couldn.t/i.test(t || ""), "toast says it failed", `toast says "${t}"`);
    await b.tap(b.page.locator(".fl-item .fl-item-main").first(), "open food");
    await b.tap(b.page.locator(".fd-sheet .fd-primary"), "Add");
    await b.expectVisible(b.page.locator(".fd-sheet .wl-error"), "sheet shows an error");
    const e = await b.page.locator(".fd-sheet .wl-error").textContent();
    b.check(!/upstream connect|disconnect\/reset/i.test(e || ""), "sheet error is in plain words", `user sees: "${e}"`);
  },

  async foodDashboard(b) {
    await ensureSport(b, "food");
    await b.tap(tab(b, "Dashboard"), "Dashboard tab");
    await b.expectVisible(b.page.getByRole("heading", { name: "Dashboard" }), "Dashboard opens");
    for (const btn of await b.page.locator(".fp-range button, [aria-pressed]").all()) await btn.click({ timeout: 2000 }).catch(() => {});
    await b.shot("food-dashboard");
  },

  /* ---------- general ---------- */

  async sportSwitch(b) {
    await b.tap(tabbar(b).getByRole("button", { name: "Change sport" }), "sport switcher");
    const sheet = b.page.getByRole("dialog", { name: "Choose a sport" });
    await b.expectVisible(sheet, "sport sheet opens");
    b.check(await sheet.getByRole("button", { name: /^Running/ }).isDisabled(), "Running is marked Soon and disabled", "Running tappable");
    await b.page.keyboard.press("Escape");
    b.check(!(await sheet.isVisible()), "Escape closes the sheet", "sheet still open");
    for (const s of ["Food", "Climbing", "Lifting"]) {
      await switchSport(b, s);
      const label = await b.page.locator(".topbar-sport").textContent();
      b.check(label.includes(s), `top bar shows ${s}`, label);
    }
    await b.page.reload();
    await b.page.waitForTimeout(800);
    const label = await b.page.locator(".topbar-sport").textContent();
    b.check(label.includes("Lifting"), "sport survives a reload", label);
  },

  async fastTapper(b) {
    const labels = ["Home", "Progress", "Log workout", "You"];
    for (let i = 0; i < 40; i++) {
      const l = labels[Math.floor(b.rng() * labels.length)];
      await tab(b, l).click({ timeout: 2000, noWaitAfter: true }).catch(() => {});
    }
    for (const s of ["Food", "Climbing", "Lifting", "Food", "Lifting"]) await switchSport(b, s);
    const tabsFood = ["Home", "Dashboard", "Add food"];
    await switchSport(b, "Food");
    for (let i = 0; i < 30; i++) await tab(b, tabsFood[i % 3]).click({ timeout: 2000, noWaitAfter: true }).catch(() => {});
    await b.page.waitForTimeout(1500);
    await b.shot("after-fast-tapping");
  },

  async explore(b) {
    // Tap every visible button in every main screen and watch for crashes.
    const sport = await b.page.locator(".topbar-sport").textContent();
    const names = sport.includes("Food") ? ["Home", "Dashboard", "Add food"] : sport.includes("Climbing") ? ["Home", "Analytics", "Log climb"] : ["Home", "Progress", "Log workout"];
    for (const n of [...names, "You"]) {
      await tab(b, n).click({ timeout: 3000 }).catch(() => {});
      await b.page.waitForTimeout(400);
      await b.checkLayout(`${sport.trim()} ${n}`);
      const btns = await b.page.locator("main button:visible").all();
      let tapped = 0;
      for (const btn of btns.slice(0, 25)) {
        const txt = ((await btn.textContent().catch(() => "")) || "").trim();
        if (/sign out|delete|remove/i.test(txt)) continue;
        if (await btn.isDisabled().catch(() => true)) continue;
        await btn.click({ timeout: 800 }).catch(() => {});
        tapped++;
        await b.page.keyboard.press("Escape").catch(() => {});
        if (!(await tabbar(b).isVisible().catch(() => false))) { await b.page.goBack().catch(() => {}); break; }
      }
      b.note(`${n}: tapped ${tapped} buttons`);
    }
  },

  async profile(b) {
    await b.tap(tab(b, "You"), "You tab");
    await b.expectVisible(b.page.getByRole("heading", { name: b.user.user_metadata.full_name }), "name shows on profile");
    await b.expectVisible(b.page.getByText(b.user.email), "email shows");
    const coach = await b.page.getByRole("button", { name: /AI coach/ }).count();
    if (coach) {
      await b.tap(b.page.getByRole("button", { name: /AI coach/ }), "AI coach (parked feature)");
      await b.page.waitForTimeout(600);
      await b.shot("parked-coach");
      const text = (await b.page.locator("main").textContent()) || "";
      b.check(!/climb/i.test(text) || (await b.page.locator(".topbar-sport").textContent()).includes("Climbing"), "the parked coach doesn't confuse non-climbers", `a ${b.persona.sport} user opening "AI coach" from You gets a climbing coach: "${text.replace(/\s+/g, " ").slice(0, 120)}"`);
      await b.tap(b.page.locator(".you-back"), "back to You");
    }
    const news = b.page.getByRole("button", { name: /News/ });
    if (await news.count()) b.note("You page still lists 'News · Climbing headlines' for every sport");
    await b.tap(b.page.locator(".you-signout"), "Sign out");
    await b.expectVisible(b.page.getByRole("button", { name: "Continue with Google" }), "sign out lands on the start page");
  },

  async landing(b) {
    await b.page.goto(b.baseURL);
    await b.expectVisible(b.page.getByRole("button", { name: "Continue with Google" }), "start page shows Continue with Google");
    await b.checkLayout("start page");
    const txt = (await b.page.locator("body").textContent()) || "";
    b.check(!/climb(?!ing app)/i.test(txt.replace(/climbing,? /gi, "")) || /lift|food/i.test(txt), "start page is sport-neutral", txt.slice(0, 160));
    const req = b.page.waitForRequest(r => r.url().includes("/auth/v1/authorize"), { timeout: 5000 }).catch(() => null);
    await b.tap(b.page.getByRole("button", { name: "Continue with Google" }), "Continue with Google");
    const r = await req;
    b.check(r && r.url().includes("provider=google"), "Google sign-in starts", r?.url() || "no request");
    await b.page.goto(`${b.baseURL}/privacy.html`);
    await b.expectVisible(b.page.locator("h1").first(), "privacy page loads");
    await b.checkLayout("privacy page");
  },

  async pausedDb(b) {
    const t0 = Date.now();
    await b.page.getByText("Loading...").waitFor({ state: "hidden", timeout: 30000 }).catch(() => {});
    b.note(`lifting home spent ${Math.round((Date.now() - t0) / 1000)}s on "Loading..." with the database down`);
    await b.shot("paused-db-home");
    const text = ((await b.page.locator("main").textContent()) || "").replace(/\s+/g, " ");
    b.note(`lifting home with the database down: "${text.slice(0, 160)}"`);
    b.check(/couldn.t|try again|offline|unavailable/i.test(text), "a down database shows a clear message", `screen says: "${text.slice(0, 160)}"`);
    await switchSport(b, "Food");
    await b.page.waitForTimeout(15000);
    const food = ((await b.page.locator("main").textContent()) || "").replace(/\s+/g, " ");
    b.note(`food home with the database down: "${food.slice(0, 160)}"`);
    await switchSport(b, "Climbing");
    await b.page.getByText("Loading...").waitFor({ state: "hidden", timeout: 30000 }).catch(() => {});
    const climb = ((await b.page.locator("main").textContent()) || "").replace(/\s+/g, " ");
    b.check(/couldn.t|try again|offline|unavailable/i.test(climb), "climbing home says the data didn't load", `climbing home with the database down shows: "${climb.slice(0, 160)}" (looks like a brand-new empty account)`);
  },
};
