// Which reminder (if any) someone should get right now. Shared by /api/notify and its tests.
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
