// Which workout reminder (if any) someone should get right now, and which food reminders. Shared by /api/notify and its tests.
// Files starting with "_" in api/ are helpers, not endpoints.
//
// Everything happens in the person's own time zone. At most one reminder a day, sent in the
// first few hours from their chosen hour (the hourly job can run late or skip a run).
// Most important first: streak just ended, streak about to break, been away a while,
// then the plain daily "time to train".

const DAY = 86400000;
const SEND_WINDOW_HOURS = 3;

// Local calendar day, hour and weekday (0 = Sunday) of a moment in a time zone.
export function localParts(when, tz) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short",
    }).formatToParts(new Date(when));
  } catch {
    return localParts(when, "UTC");
  }
  const get = t => parts.find(p => p.type === t).value;
  const y = +get("year"), m = +get("month"), d = +get("day");
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    day: Math.round(Date.UTC(y, m - 1, d) / DAY),
    hour: +get("hour") % 24,
    dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")),
  };
}

// Day number of the Monday that starts the week containing day `day` (weekday `dow`).
const mondayOf = (day, dow) => day - ((dow + 6) % 7);

// Is it time to think about someone's reminder? Cheap check before loading their workouts.
export function isDue(settings, now = new Date()) {
  const p = localParts(now, settings.tz || "UTC");
  const start = settings.hour ?? 18;
  if (p.hour < start || p.hour >= start + SEND_WINDOW_HOURS) return false;
  return settings.last_sent !== p.date;
}

const pick = (list, seed) => list[((seed % list.length) + list.length) % list.length];
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// workouts: performed_at times of lifting workouts (for the weekly streak).
// other: times of anything else logged that counts as training (climbs).
export function pickReminder(settings, { workouts = [], other = [] }, now = new Date()) {
  const tz = settings.tz || "UTC";
  const goal = Math.min(7, Math.max(1, settings.week_goal || 3));
  const today = localParts(now, tz);
  const thisWeek = mondayOf(today.day, today.dow);

  const workoutDays = workouts.map(t => localParts(t, tz)).map(p => ({ day: p.day, week: mondayOf(p.day, p.dow) }));
  const allDays = [...workoutDays.map(w => w.day), ...other.map(t => localParts(t, tz).day)];
  const trainedToday = allDays.includes(today.day);
  const lastDay = allDays.filter(d => d <= today.day).reduce((a, d) => Math.max(a, d), -Infinity);

  const perWeek = {};
  workoutDays.forEach(w => { perWeek[w.week] = (perWeek[w.week] || 0) + 1; });
  // Weeks in a row that hit the goal, counting back from (and including) the given week.
  const runFrom = week => { let n = 0; while ((perWeek[week - 7 * n] || 0) >= goal) n++; return n; };

  if (settings.streak !== false) {
    // Monday: last week missed the goal and ended a streak of 2+ weeks.
    const ended = (perWeek[thisWeek - 7] || 0) < goal ? runFrom(thisWeek - 14) : 0;
    if (today.dow === 1 && ended >= 2 && !trainedToday) {
      return {
        kind: "streak_lost",
        title: `Your ${ended}-week streak ended`,
        body: pick([
          `Last week came up short of ${plural(goal, "workout")}. A new streak starts with today's session.`,
          `Happens to everyone. Get ${plural(goal, "workout")} in this week and you're back on the board.`,
        ], today.day),
      };
    }

    // The streak can still be saved, but only if every remaining day this week counts.
    const streak = runFrom(thisWeek - 7);
    const need = goal - (perWeek[thisWeek] || 0);
    const daysLeft = 7 - ((today.dow + 6) % 7);
    if (streak >= 1 && need > 0 && need === daysLeft && !trainedToday) {
      return {
        kind: "streak_risk",
        title: `Your ${streak}-week streak is on the line`,
        body: need === 1
          ? "One more workout this week keeps it alive. Today's the day."
          : `You need ${need} more workouts this week to keep it, so today counts.`,
      };
    }
  }

  if (settings.comeback !== false && lastDay > -Infinity) {
    const away = today.day - lastDay;
    if ([3, 7, 14, 30].includes(away)) {
      return {
        kind: "comeback",
        title: away === 3 ? "It's been 3 days" : away === 7 ? "It's been a week" : `It's been ${away} days`,
        body: pick([
          "A short session still counts. Log one today and get moving again.",
          "Your next workout is waiting. Even 20 minutes keeps the habit going.",
          "Ease back in with something light today. Future you will thank you.",
        ], today.day),
      };
    }
  }

  const days = settings.days || [0, 1, 2, 3, 4, 5, 6];
  if (settings.daily !== false && days.includes(today.dow) && !trainedToday) {
    const thisWeekCount = perWeek[thisWeek] || 0;
    return {
      kind: "daily",
      title: pick(["Time to train", "Ready for today's session?", "Get your workout in"], today.day),
      body: thisWeekCount > 0 && thisWeekCount < goal
        ? `${thisWeekCount} of ${goal} workouts done this week. Keep it rolling.`
        : pick([
          "Nothing logged yet today. Open SendIt when you're done.",
          "Train, then log it in a few taps.",
          "Show up today and keep your week on track.",
        ], today.day + 1),
    };
  }

  return null;
}

/* ---------- food ---------- */
// Food reminders have their own limit, separate from the workout reminder: each meal
// reminder and the evening check go out at most once a day.

// When each meal reminder goes out (local hour), if that meal still has nothing logged.
export const MEAL_CHECKS = { breakfast: 10, lunch: 14, dinner: 20 };
const MEAL_WORDS = { breakfast: "breakfast", lunch: "lunch", dinner: "dinner" };
export const EVENING_CHECK = 21;
const FOOD_WINDOW_HOURS = 2;

const inWindow = (hour, start) => hour >= start && hour < start + FOOD_WINDOW_HOURS;
const sentToday = (settings, date) => (settings.food_sent?.date === date ? settings.food_sent.sent || [] : []);

// Could any food reminder be due this hour? Cheap check before loading the food log.
export function isFoodDue(settings, now = new Date()) {
  const p = localParts(now, settings.tz || "UTC");
  const meals = (settings.food_meals || []).filter(m => MEAL_CHECKS[m] !== undefined && inWindow(p.hour, MEAL_CHECKS[m]));
  return meals.length > 0 || (settings.food_eod !== false && inWindow(p.hour, EVENING_CHECK));
}

// logs: { eaten_at, meal, kcal } for roughly the last two weeks. Returns the reminders due
// now that haven't gone out today, each with a `key` to record once sent.
// Only people who logged food in the last 14 days get any, so lifters who never track food aren't nagged.
export function pickFoodReminders(settings, logs, now = new Date()) {
  const tz = settings.tz || "UTC";
  const today = localParts(now, tz);
  const recent = logs.filter(l => today.day - localParts(l.eaten_at, tz).day <= 14);
  if (!recent.length) return [];
  const todays = recent.filter(l => localParts(l.eaten_at, tz).day === today.day);
  const done = sentToday(settings, today.date);
  const out = [];

  // Only the most recent meal window applies, so a late run doesn't send breakfast and lunch together.
  const meal = (settings.food_meals || [])
    .filter(m => MEAL_CHECKS[m] !== undefined && inWindow(today.hour, MEAL_CHECKS[m]))
    .sort((a, b) => MEAL_CHECKS[b] - MEAL_CHECKS[a])[0];
  if (meal && !done.includes(meal) && !todays.some(l => l.meal === meal)) {
    out.push({
      kind: "meal", key: meal,
      title: `No ${MEAL_WORDS[meal]} logged yet`,
      body: pick([
        `Had ${MEAL_WORDS[meal]}? Log it now while you still remember.`,
        `Add your ${MEAL_WORDS[meal]} in a few taps to keep today's numbers right.`,
      ], today.day),
    });
  }

  // One food notification per run: if a meal reminder is going out, the evening check waits an hour.
  if (!out.length && settings.food_eod !== false && inWindow(today.hour, EVENING_CHECK) && !done.includes("evening") && todays.length) {
    const goal = Number(settings.kcal_goal) || 2000;
    const eaten = Math.round(todays.reduce((a, l) => a + (Number(l.kcal) || 0), 0));
    const gap = goal - eaten;
    if (gap >= goal * 0.25) {
      out.push({
        kind: "food_under", key: "evening",
        title: `${gap.toLocaleString("en-US")} cals under today`,
        body: `You're at ${eaten.toLocaleString("en-US")} of ${goal.toLocaleString("en-US")}. Missed logging something, or still time for a meal?`,
      });
    } else if (-gap >= goal * 0.15) {
      out.push({
        kind: "food_over", key: "evening",
        title: `${(-gap).toLocaleString("en-US")} cals over today`,
        body: `You're at ${eaten.toLocaleString("en-US")} of ${goal.toLocaleString("en-US")}. One day won't undo your progress. Back on plan tomorrow.`,
      });
    }
  }
  return out;
}

// The new food_sent value after sending reminders with these keys.
export function markFoodSent(settings, keys, now = new Date()) {
  const date = localParts(now, settings.tz || "UTC").date;
  return { date, sent: [...new Set([...sentToday(settings, date), ...keys])] };
}
