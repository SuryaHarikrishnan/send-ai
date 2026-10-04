// Exercise library and the math behind the lifting home screen.

// Muscle slugs match the body map in bodyPaths.js.
export const MUSCLE_NAMES = {
  chest: "Chest",
  deltoids: "Shoulders",
  triceps: "Triceps",
  biceps: "Biceps",
  forearm: "Forearms",
  abs: "Abs",
  obliques: "Obliques",
  trapezius: "Traps",
  "upper-back": "Upper back",
  "lower-back": "Lower back",
  gluteal: "Glutes",
  hamstring: "Hamstrings",
  quadriceps: "Quads",
  adductors: "Adductors",
  calves: "Calves",
};

// [name, primary muscles, secondary muscles]
const LIB = [
  ["Bench press", ["chest"], ["triceps", "deltoids"]],
  ["Incline bench press", ["chest"], ["deltoids", "triceps"]],
  ["Dumbbell bench press", ["chest"], ["triceps", "deltoids"]],
  ["Incline dumbbell press", ["chest"], ["deltoids", "triceps"]],
  ["Chest fly", ["chest"], ["deltoids"]],
  ["Push-up", ["chest"], ["triceps", "deltoids", "abs"]],
  ["Dips", ["chest", "triceps"], ["deltoids"]],
  ["Overhead press", ["deltoids"], ["triceps", "trapezius"]],
  ["Dumbbell shoulder press", ["deltoids"], ["triceps"]],
  ["Lateral raise", ["deltoids"], ["trapezius"]],
  ["Rear delt fly", ["deltoids"], ["upper-back"]],
  ["Face pull", ["deltoids", "upper-back"], ["trapezius"]],
  ["Shrug", ["trapezius"], ["forearm"]],
  ["Triceps pushdown", ["triceps"], []],
  ["Skull crusher", ["triceps"], []],
  ["Overhead triceps extension", ["triceps"], []],
  ["Close-grip bench press", ["triceps", "chest"], ["deltoids"]],
  ["Pull-up", ["upper-back"], ["biceps", "forearm"]],
  ["Chin-up", ["upper-back", "biceps"], ["forearm"]],
  ["Lat pulldown", ["upper-back"], ["biceps"]],
  ["Barbell row", ["upper-back"], ["biceps", "lower-back", "deltoids"]],
  ["Dumbbell row", ["upper-back"], ["biceps", "deltoids"]],
  ["Cable row", ["upper-back"], ["biceps", "trapezius"]],
  ["Deadlift", ["hamstring", "gluteal", "lower-back"], ["upper-back", "trapezius", "forearm", "quadriceps"]],
  ["Barbell curl", ["biceps"], ["forearm"]],
  ["Dumbbell curl", ["biceps"], ["forearm"]],
  ["Hammer curl", ["biceps", "forearm"], []],
  ["Back squat", ["quadriceps", "gluteal"], ["adductors", "lower-back", "hamstring"]],
  ["Front squat", ["quadriceps"], ["gluteal", "abs"]],
  ["Leg press", ["quadriceps", "gluteal"], ["adductors"]],
  ["Lunge", ["quadriceps", "gluteal"], ["hamstring", "adductors"]],
  ["Bulgarian split squat", ["quadriceps", "gluteal"], ["adductors"]],
  ["Leg extension", ["quadriceps"], []],
  ["Romanian deadlift", ["hamstring", "gluteal"], ["lower-back"]],
  ["Leg curl", ["hamstring"], []],
  ["Hip thrust", ["gluteal"], ["hamstring"]],
  ["Calf raise", ["calves"], []],
  ["Plank", ["abs"], ["obliques"]],
  ["Hanging leg raise", ["abs"], ["obliques", "forearm"]],
  ["Cable crunch", ["abs"], ["obliques"]],
  ["Russian twist", ["obliques"], ["abs"]],
  ["Back extension", ["lower-back"], ["gluteal", "hamstring"]],
  // Chest
  ["Decline bench press", ["chest"], ["triceps"]],
  ["Machine chest press", ["chest"], ["triceps", "deltoids"]],
  ["Cable fly", ["chest"], ["deltoids"]],
  ["Pec deck", ["chest"], ["deltoids"]],
  ["Dumbbell pullover", ["chest", "upper-back"], ["triceps"]],
  // Shoulders
  ["Arnold press", ["deltoids"], ["triceps"]],
  ["Machine shoulder press", ["deltoids"], ["triceps"]],
  ["Cable lateral raise", ["deltoids"], []],
  ["Front raise", ["deltoids"], ["chest"]],
  ["Upright row", ["deltoids", "trapezius"], ["biceps"]],
  ["Reverse pec deck", ["deltoids"], ["upper-back", "trapezius"]],
  ["Push press", ["deltoids"], ["triceps", "quadriceps", "trapezius"]],
  // Back
  ["Pendlay row", ["upper-back"], ["biceps", "lower-back", "deltoids"]],
  ["T-bar row", ["upper-back"], ["biceps", "trapezius", "lower-back"]],
  ["Chest-supported row", ["upper-back"], ["biceps", "deltoids"]],
  ["Machine row", ["upper-back"], ["biceps", "trapezius"]],
  ["Straight-arm pulldown", ["upper-back"], ["triceps"]],
  ["Assisted pull-up", ["upper-back"], ["biceps", "forearm"]],
  ["Rack pull", ["upper-back", "lower-back", "trapezius"], ["gluteal", "forearm"]],
  ["Dumbbell shrug", ["trapezius"], ["forearm"]],
  ["Good morning", ["hamstring", "lower-back"], ["gluteal"]],
  // Arms
  ["Preacher curl", ["biceps"], []],
  ["Incline dumbbell curl", ["biceps"], []],
  ["Cable curl", ["biceps"], ["forearm"]],
  ["EZ-bar curl", ["biceps"], ["forearm"]],
  ["Concentration curl", ["biceps"], []],
  ["Reverse curl", ["forearm", "biceps"], []],
  ["Wrist curl", ["forearm"], []],
  ["Triceps kickback", ["triceps"], []],
  ["Cable overhead extension", ["triceps"], []],
  ["Bench dip", ["triceps"], ["chest", "deltoids"]],
  ["Farmer's carry", ["forearm", "trapezius"], ["abs", "obliques"]],
  // Legs
  ["Sumo deadlift", ["gluteal", "quadriceps", "adductors"], ["hamstring", "lower-back", "trapezius"]],
  ["Trap bar deadlift", ["quadriceps", "gluteal", "hamstring"], ["lower-back", "trapezius", "forearm"]],
  ["Hack squat", ["quadriceps"], ["gluteal", "adductors"]],
  ["Goblet squat", ["quadriceps", "gluteal"], ["adductors", "abs"]],
  ["Smith machine squat", ["quadriceps", "gluteal"], ["adductors"]],
  ["Box squat", ["quadriceps", "gluteal"], ["hamstring", "adductors"]],
  ["Step-up", ["quadriceps", "gluteal"], ["hamstring"]],
  ["Walking lunge", ["quadriceps", "gluteal"], ["hamstring", "adductors"]],
  ["Seated leg curl", ["hamstring"], []],
  ["Nordic curl", ["hamstring"], ["gluteal"]],
  ["Glute bridge", ["gluteal"], ["hamstring"]],
  ["Cable kickback", ["gluteal"], ["hamstring"]],
  ["Hip abduction", ["gluteal"], []],
  ["Hip adduction", ["adductors"], []],
  ["Seated calf raise", ["calves"], []],
  // Core
  ["Ab wheel rollout", ["abs"], ["obliques", "lower-back"]],
  ["Crunch", ["abs"], []],
  ["Decline sit-up", ["abs"], ["obliques"]],
  ["Side plank", ["obliques"], ["abs"]],
  ["Cable woodchop", ["obliques"], ["abs", "deltoids"]],
  ["Pallof press", ["obliques", "abs"], []],
];

export const EXERCISES = LIB.map(([name, primary, secondary]) => ({ name, primary, secondary }));
const BY_NAME = Object.fromEntries(EXERCISES.map(e => [e.name.toLowerCase(), e]));
export const findExercise = name => BY_NAME[(name || "").trim().toLowerCase()];

export const WORKOUT_NAMES = ["Push", "Pull", "Legs", "Upper", "Lower", "Full body"];

// Sets per muscle: a primary muscle gets 1 per set, a secondary gets half.
export function muscleSets(workouts) {
  const out = {};
  for (const w of workouts) {
    for (const ex of w.exercises || []) {
      const info = findExercise(ex.name);
      const n = (ex.sets || []).length;
      if (!info || !n) continue;
      info.primary.forEach(m => (out[m] = (out[m] || 0) + n));
      info.secondary.forEach(m => (out[m] = (out[m] || 0) + n / 2));
    }
  }
  for (const k in out) out[k] = Math.round(out[k] * 2) / 2;
  return out;
}

export const totalSets = w => (w.exercises || []).reduce((a, e) => a + (e.sets || []).length, 0);
export const totalVolume = w =>
  (w.exercises || []).reduce((a, e) => a + (e.sets || []).reduce((b, s) => b + (Number(s.reps) || 0) * (Number(s.weight) || 0), 0), 0);

// Monday 00:00 local time of the week containing d.
export function weekStart(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
const DAY = 86400000;
const weekKey = d => weekStart(d).toISOString().slice(0, 10);

// Weeks in a row that hit the goal. The current week counts once the goal is hit,
// and does not break the streak while it is still in progress.
export function weekStreak(workouts, goal, now = new Date()) {
  const counts = {};
  workouts.forEach(w => { const k = weekKey(w.performed_at); counts[k] = (counts[k] || 0) + 1; });
  let streak = 0;
  const cur = weekStart(now);
  if ((counts[weekKey(cur)] || 0) >= goal) streak++;
  for (let d = new Date(cur.getTime() - 7 * DAY); ; d = new Date(d.getTime() - 7 * DAY)) {
    if ((counts[weekKey(d)] || 0) >= goal) streak++;
    else break;
  }
  return streak;
}

// Heaviest weight lifted for each exercise before a given workout, to flag PRs.
export function prFlags(workoutsNewestFirst) {
  const flags = {};
  const best = {};
  [...workoutsNewestFirst].reverse().forEach(w => {
    (w.exercises || []).forEach((ex, i) => {
      const top = Math.max(0, ...(ex.sets || []).map(s => Number(s.weight) || 0));
      const key = ex.name.toLowerCase();
      if (top > 0 && best[key] !== undefined && top > best[key]) flags[`${w.id}:${i}`] = true;
      if (top > (best[key] ?? -1)) best[key] = top;
    });
  });
  return flags;
}

// "4 × 8 · 165 lb" style summary for an exercise's sets.
export function setSummary(sets) {
  if (!sets?.length) return "";
  const reps = sets.map(s => Number(s.reps) || 0);
  const weights = sets.map(s => Number(s.weight) || 0);
  const sameReps = reps.every(r => r === reps[0]);
  const top = Math.max(...weights);
  const repsText = sameReps ? `${sets.length} × ${reps[0]}` : `${sets.length} sets · ${reps.join("/")}`;
  return top > 0 ? `${repsText} · ${top} lb` : repsText;
}

// Muscle groups for filtering the exercise picker.
export const GROUPS = {
  Chest: ["chest"],
  Back: ["upper-back", "trapezius", "lower-back"],
  Shoulders: ["deltoids"],
  Arms: ["biceps", "triceps", "forearm"],
  Legs: ["quadriceps", "hamstring", "gluteal", "calves", "adductors"],
  Core: ["abs", "obliques"],
};
export const groupOf = ex => Object.keys(GROUPS).find(g => GROUPS[g].includes(ex.primary[0]));

// Estimated one-rep max (Epley). Past 12 reps the estimate gets unreliable, so it's skipped.
export function e1rm(weight, reps) {
  const w = Number(weight) || 0;
  const r = Number(reps) || 0;
  if (w <= 0 || r <= 0 || r > 12) return 0;
  return r === 1 ? w : w * (1 + r / 30);
}

export const DAY_MS = 86400000;

// Every session of every exercise, oldest first, with the numbers the progress page needs.
// Returns { key: { name, sessions: [...], best: {...}, prs: [...] } } keyed by lowercase name.
export function exerciseStats(workouts) {
  const out = {};
  const sorted = [...workouts].sort((a, b) => new Date(a.performed_at) - new Date(b.performed_at));
  for (const w of sorted) {
    for (const ex of w.exercises || []) {
      const sets = (ex.sets || []).map(s => ({ reps: Number(s.reps) || 0, weight: Number(s.weight) || 0 })).filter(s => s.reps > 0);
      if (!sets.length) continue;
      const key = ex.name.trim().toLowerCase();
      const known = findExercise(ex.name);
      const entry = (out[key] ||= { key, name: known ? known.name : ex.name.trim(), info: known || null, sessions: [], prs: [] });
      // Best set: highest estimated max, falling back to heaviest weight, then most reps.
      const score = s => [e1rm(s.weight, s.reps), s.weight, s.reps];
      const better = (a, b) => { const x = score(a), y = score(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
      const bestSet = sets.reduce((a, s) => (better(s, a) ? s : a), sets[0]);
      const best1 = e1rm(bestSet.weight, bestSet.reps);
      entry.sessions.push({
        workoutId: w.id,
        title: w.title,
        date: w.performed_at,
        sets,
        bestSet,
        heaviest: sets.reduce((a, s) => (s.weight > a.weight || (s.weight === a.weight && s.reps > a.reps) ? s : a), sets[0]),
        e1rm: Math.round(best1),
        top: Math.max(...sets.map(s => s.weight)),
        maxReps: Math.max(...sets.map(s => s.reps)),
        volume: sets.reduce((a, s) => a + s.reps * s.weight, 0),
      });
    }
  }
  for (const entry of Object.values(out)) {
    const ss = entry.sessions;
    // Exercises done without added weight are tracked by reps instead.
    entry.weighted = ss.some(s => s.top > 0);
    const metric = entry.weighted ? (s => s.e1rm || s.top) : (s => s.maxReps);
    let running = 0;
    ss.forEach((s, i) => {
      s.value = metric(s);
      s.pr = i > 0 && s.value > running;
      if (s.pr) entry.prs.push(s);
      running = Math.max(running, s.value);
    });
    const pick = f => ss.reduce((a, s) => (f(s) > f(a) ? s : a), ss[0]);
    entry.best = {
      value: pick(metric),
      top: pick(s => s.heaviest.weight * 1000 + s.heaviest.reps),
      volume: pick(s => s.volume),
      reps: pick(s => s.maxReps),
    };
    entry.last = ss[ss.length - 1];
  }
  return out;
}

// Turn a Supabase error on the workouts table into something a person can act on.
export function workoutsError(err) {
  if (!err) return null;
  if (err.code === "42P01" || err.code === "PGRST205")
    return { title: "Workouts aren't switched on yet.", detail: "The workouts table doesn't exist. Run supabase/workouts.sql once in the Supabase SQL Editor, then reload." };
  if (err.code === "42501")
    return { title: "Workouts are blocked by database permissions.", detail: "Run supabase/workouts.sql again in the Supabase SQL Editor (it now grants access), then reload." };
  return { title: "Couldn't load workouts.", detail: err.message || "Unknown error. Try reloading." };
}
