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
