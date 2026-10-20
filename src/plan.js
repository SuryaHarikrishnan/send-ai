// Workout plans: built from a few answers, then each workout's weights come from what was logged.
import { supabase } from "./supabase";
import { findExercise } from "./lifting";

export const GOALS = {
  strength: { name: "Strength", line: "Lift heavier. Fewer reps, more rest." },
  muscle: { name: "Muscle", line: "Build size. More reps and sets." },
};
export const LEVELS = {
  beginner: { name: "Beginner", line: "Under a year", mult: 1 },
  intermediate: { name: "Intermediate", line: "1 to 3 years", mult: 1.5 },
  advanced: { name: "Advanced", line: "3+ years", mult: 2 },
};
export const INTENSITIES = {
  light: { name: "Light", line: "Easing in" },
  moderate: { name: "Moderate", line: "Steady work" },
  hard: { name: "Hard", line: "Push every set" },
};
export const DAY_CHOICES = [2, 3, 4, 5, 6];
export const MINUTE_CHOICES = [30, 45, 60, 75, 90];

// Each day lists exercises best first; shorter sessions keep the first few.
const DAYS = {
  fullA: ["Full body A", ["Back squat", "Bench press", "Barbell row", "Romanian deadlift", "Lateral raise", "Dumbbell curl", "Cable crunch"]],
  fullB: ["Full body B", ["Deadlift", "Overhead press", "Lat pulldown", "Leg press", "Incline dumbbell press", "Triceps pushdown", "Hanging leg raise"]],
  fullC: ["Full body C", ["Back squat", "Incline bench press", "Cable row", "Hip thrust", "Face pull", "Leg curl", "Hammer curl"]],
  upperA: ["Upper A", ["Bench press", "Barbell row", "Overhead press", "Lat pulldown", "Lateral raise", "Barbell curl", "Triceps pushdown"]],
  upperB: ["Upper B", ["Incline dumbbell press", "Pull-up", "Dumbbell shoulder press", "Cable row", "Chest fly", "Hammer curl", "Skull crusher"]],
  lowerA: ["Lower A", ["Back squat", "Romanian deadlift", "Leg press", "Leg curl", "Calf raise", "Cable crunch"]],
  lowerB: ["Lower B", ["Deadlift", "Front squat", "Bulgarian split squat", "Leg extension", "Seated calf raise", "Hanging leg raise"]],
  push: ["Push", ["Bench press", "Overhead press", "Incline dumbbell press", "Lateral raise", "Triceps pushdown", "Chest fly", "Overhead triceps extension"]],
  pull: ["Pull", ["Barbell row", "Pull-up", "Cable row", "Face pull", "Barbell curl", "Hammer curl", "Shrug"]],
  legs: ["Legs", ["Back squat", "Romanian deadlift", "Leg press", "Leg curl", "Leg extension", "Calf raise", "Hanging leg raise"]],
  pushB: ["Push B", ["Incline bench press", "Dumbbell shoulder press", "Dips", "Cable lateral raise", "Cable fly", "Skull crusher"]],
  pullB: ["Pull B", ["Deadlift", "Lat pulldown", "Chest-supported row", "Rear delt fly", "EZ-bar curl", "Incline dumbbell curl"]],
  legsB: ["Legs B", ["Front squat", "Hip thrust", "Bulgarian split squat", "Seated leg curl", "Seated calf raise", "Ab wheel rollout"]],
};
const SPLITS = {
  strength: { 2: ["fullA", "fullB"], 3: ["fullA", "fullB", "fullC"], 4: ["upperA", "lowerA", "upperB", "lowerB"], 5: ["upperA", "lowerA", "push", "pull", "legs"], 6: ["push", "pull", "legs", "pushB", "pullB", "legsB"] },
  muscle: { 2: ["fullA", "fullB"], 3: ["push", "pull", "legs"], 4: ["upperA", "lowerA", "upperB", "lowerB"], 5: ["push", "pull", "legs", "upperB", "lowerB"], 6: ["push", "pull", "legs", "pushB", "pullB", "legsB"] },
};

// Starting weight for a beginner, as a share of body weight. Dumbbell lifts are per hand.
// 0 means a body weight exercise.
const RATIO = {
  "Back squat": 0.6, "Front squat": 0.45, "Deadlift": 0.75, "Romanian deadlift": 0.5, "Bench press": 0.5, "Incline bench press": 0.4,
  "Overhead press": 0.3, "Barbell row": 0.4, "Leg press": 1, "Hip thrust": 0.6, "Lat pulldown": 0.4, "Cable row": 0.4,
  "Chest-supported row": 0.3, "Incline dumbbell press": 0.15, "Dumbbell shoulder press": 0.12, "Dumbbell curl": 0.08,
  "Hammer curl": 0.08, "Incline dumbbell curl": 0.06, "Lateral raise": 0.05, "Cable lateral raise": 0.04, "Chest fly": 0.08,
  "Cable fly": 0.1, "Bulgarian split squat": 0.1, "Leg curl": 0.25, "Seated leg curl": 0.25, "Leg extension": 0.3,
  "Triceps pushdown": 0.2, "Skull crusher": 0.15, "Overhead triceps extension": 0.15, "Barbell curl": 0.2, "EZ-bar curl": 0.2,
  "Face pull": 0.15, "Rear delt fly": 0.04, "Shrug": 0.5, "Calf raise": 0.5, "Seated calf raise": 0.3, "Cable crunch": 0.25,
  "Pull-up": 0, "Dips": 0, "Hanging leg raise": 0, "Ab wheel rollout": 0, "Push-up": 0,
};
const BARBELL = new Set(["Back squat", "Front squat", "Deadlift", "Romanian deadlift", "Bench press", "Incline bench press", "Overhead press", "Barbell row", "Hip thrust"]);
const LOWER = new Set(["Back squat", "Front squat", "Deadlift", "Romanian deadlift", "Leg press", "Hip thrust"]);
// Beginners get the easier version of the hard body weight moves.
const EASIER = { "Pull-up": "Lat pulldown", "Dips": "Close-grip bench press" };
RATIO["Close-grip bench press"] = 0.4;

const round5 = n => Math.max(5, Math.round(n / 5) * 5);

export function startWeight(name, profile) {
  const r = RATIO[name];
  if (r === 0) return 0;
  if (r == null) return null;
  const bw = Number(profile.weightLb) || 160;
  const goalMult = profile.goal === "muscle" ? 0.85 : 1;
  const w = round5(bw * r * (LEVELS[profile.level]?.mult || 1) * goalMult);
  return BARBELL.has(name) ? Math.max(45, w) : w;
}

// Sets and rep range for the nth exercise of a day. The first two are the main lifts.
// Light takes a set off everything; hard adds one to the accessories (and to main lifts when building muscle).
function dose(i, profile) {
  const main = i < 2;
  const strength = profile.goal === "strength";
  let sets = strength ? (main ? 5 : 3) : main ? 4 : 3;
  if (profile.intensity === "light") sets -= 1;
  if (profile.intensity === "hard" && (!main || !strength)) sets += 1;
  const reps = strength ? (main ? (profile.level === "beginner" ? [5, 5] : [3, 5]) : [8, 10]) : main ? [6, 10] : [10, 15];
  return { sets: Math.max(2, sets), reps };
}
// Minutes a set takes with its rest.
const setMinutes = (profile, main) => (profile.goal === "strength" ? (main ? 3.5 : 2.5) : main ? 3 : 2.2);

export function estimateMinutes(day, profile) {
  return Math.round(5 + day.exercises.reduce((a, e, i) => a + e.sets * setMinutes(profile, i < 2), 0));
}

export function buildPlan(profile) {
  const days = Number(profile.days) || 3;
  const split = SPLITS[profile.goal]?.[days] || SPLITS.strength[3];
  const budget = (Number(profile.minutes) || 60) - 5;
  return {
    version: 1,
    profile,
    created_at: new Date().toISOString(),
    days: split.map(key => {
      const [name, pool] = DAYS[key];
      const exercises = [];
      let used = 0;
      for (const raw of pool) {
        const exName = profile.level === "beginner" && EASIER[raw] ? EASIER[raw] : raw;
        if (exercises.some(e => e.name === exName)) continue;
        const d = dose(exercises.length, profile);
        const cost = d.sets * setMinutes(profile, exercises.length < 2);
        if (exercises.length >= 3 && used + cost > budget) break;
        used += cost;
        exercises.push({ name: exName, ...d, start: startWeight(exName, profile) });
      }
      // Every day keeps at least 3 exercises; on short sessions that means fewer sets.
      const day = { name, exercises };
      while (estimateMinutes(day, profile) > budget + 5) {
        const most = exercises.reduce((m, e) => (e.sets > m.sets ? e : m));
        if (most.sets <= 2) break;
        most.sets -= 1;
      }
      return day;
    }),
  };
}

/* ---------- what to lift next time ---------- */

// Last few sessions of one exercise, newest first.
function sessionsOf(name, workouts) {
  const key = name.toLowerCase();
  const out = [];
  for (const w of workouts) {
    const hit = (w.exercises || []).find(e => e.name.toLowerCase() === key);
    if (hit?.sets?.length) out.push(hit.sets);
    if (out.length === 2) break;
  }
  return out;
}

// Double progression: once every set reaches the top of the rep range, add weight and
// start back at the bottom. Two misses in a row at the same weight drops it by 10%.
export function nextTarget(ex, workouts, profile) {
  const [lo, hi] = ex.reps;
  const [last, before] = sessionsOf(ex.name, workouts);
  const bodyweight = ex.start === 0 || RATIO[ex.name] === 0;
  if (!last) {
    const w = ex.start ?? startWeight(ex.name, profile);
    return { weight: w ?? "", reps: lo, why: bodyweight ? "Body weight" : w ? "Starting weight, change it if it feels off" : "Pick a weight you can do for these reps" };
  }
  const top = Math.max(...last.map(s => Number(s.weight) || 0));
  const atTop = last.filter(s => (Number(s.weight) || 0) === top);
  const minReps = Math.min(...atTop.map(s => Number(s.reps) || 0));
  if (bodyweight || top === 0) {
    return { weight: top, reps: Math.min(30, Math.max(lo, minReps + 1)), why: "One more rep than last time" };
  }
  const allHit = atTop.length >= ex.sets && minReps >= hi;
  if (allHit) {
    const step = LOWER.has(ex.name) ? 10 : 5;
    return { weight: top + step, reps: lo, why: `Up ${step} lb: you hit ${hi} reps on every set` };
  }
  const missed = sets => sets.some(s => (Number(s.reps) || 0) < lo);
  if (before && missed(last) && missed(before) && Math.max(...before.map(s => Number(s.weight) || 0)) === top) {
    return { weight: round5(top * 0.9), reps: lo, why: "Down 10% to reset after two tough sessions" };
  }
  return { weight: top, reps: Math.min(hi, Math.max(lo, minReps + 1)), why: `Same weight, aim for ${Math.min(hi, Math.max(lo, minReps + 1))} reps` };
}

// The log form's shape for one day of the plan.
export function presetFor(day, workouts, profile) {
  return {
    title: day.name,
    exercises: day.exercises.map(ex => {
      const t = nextTarget(ex, workouts, profile);
      return { name: ex.name, sets: Array.from({ length: ex.sets }, () => ({ reps: t.reps, weight: t.weight })) };
    }),
  };
}

// The day after the plan day logged most recently.
export function nextDayIndex(plan, workouts) {
  const names = plan.days.map(d => d.name.toLowerCase());
  for (const w of workouts) {
    const i = names.indexOf((w.title || "").trim().toLowerCase());
    if (i >= 0) return { index: (i + 1) % names.length, doneToday: new Date(w.performed_at).toDateString() === new Date().toDateString() ? i : null };
  }
  return { index: 0, doneToday: null };
}

export const repText = ([lo, hi]) => (lo === hi ? `${lo}` : `${lo}–${hi}`);
export const known = name => !!findExercise(name);

/* ---------- saving ---------- */

// Kept in public.workout_plans so it follows the person to any device; a copy stays on
// the phone so the plan still works before supabase/plans.sql has been run.
const localKey = user => `send.plan.${user.id}`;
function readLocal(user) {
  try { return JSON.parse(localStorage.getItem(localKey(user))) || null; } catch { return null; }
}
function writeLocal(user, plan) {
  try {
    if (plan) localStorage.setItem(localKey(user), JSON.stringify(plan));
    else localStorage.removeItem(localKey(user));
  } catch { /* storage blocked */ }
}

export async function loadPlan(user) {
  const { data, error } = await supabase.from("workout_plans").select("plan").eq("user_id", user.id).maybeSingle();
  if (error) return readLocal(user);
  if (data?.plan) { writeLocal(user, data.plan); return data.plan; }
  // Made before the table existed: move it up.
  const local = readLocal(user);
  if (local) supabase.from("workout_plans").upsert({ user_id: user.id, plan: local, updated_at: new Date().toISOString() }).then(() => {}, () => {});
  return local;
}

export async function savePlan(user, plan) {
  writeLocal(user, plan);
  await supabase.from("workout_plans").upsert({ user_id: user.id, plan, updated_at: new Date().toISOString() }).then(() => {}, () => {});
}

export async function removePlan(user) {
  writeLocal(user, null);
  await supabase.from("workout_plans").delete().eq("user_id", user.id).then(() => {}, () => {});
}

export const hasDraft = user => {
  try { return (JSON.parse(localStorage.getItem(`send.workoutDraft.${user.id}`))?.exercises || []).length > 0; } catch { return false; }
};

/* ---------- changes asked of Gemini (/api/plan) ---------- */

export async function tweakPlan(plan, request) {
  const { data } = await supabase.auth.getSession();
  let res, body;
  try {
    res = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` },
      body: JSON.stringify({ plan: { profile: plan.profile, days: plan.days }, request }),
    });
    body = await res.json().catch(() => ({}));
  } catch {
    throw new Error("No connection. Check your signal and try again.");
  }
  if (!res.ok) throw new Error(body.error || "Couldn't change the plan right now. Try again in a minute.");
  // Exercises already in the plan keep their start weight; new ones get ours when we have one.
  const before = Object.fromEntries(plan.days.flatMap(d => d.exercises).map(e => [e.name.toLowerCase(), e.start]));
  const days = body.days.map(d => ({
    name: d.name,
    exercises: d.exercises.map(e => {
      const was = before[e.name.toLowerCase()];
      const ours = startWeight(e.name, plan.profile);
      return { ...e, start: was !== undefined ? was : ours ?? e.start };
    }),
  }));
  return { plan: { ...plan, days, tweaks: [...(plan.tweaks || []), request].slice(-10), updated_at: new Date().toISOString() }, summary: body.summary };
}
