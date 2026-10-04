import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { EXERCISES, MUSCLE_NAMES, WORKOUT_NAMES, findExercise } from "./lifting";

const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const newSet = (prev) => ({ reps: prev?.reps ?? "", weight: prev?.weight ?? "" });

export default function WorkoutLog({ user, onNavigate }) {
  const [title, setTitle] = useState("Push");
  const [date, setDate] = useState(todayISO);
  const [duration, setDuration] = useState("");
  const [exercises, setExercises] = useState([]);
  const [pick, setPick] = useState("");
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("workouts")
      .select("title, exercises, performed_at")
      .eq("user_id", user.id)
      .order("performed_at", { ascending: false })
      .limit(40)
      .then(({ data }) => setHistory(data || []));
  }, [user]);

  const last = history.find(w => w.title.toLowerCase() === title.trim().toLowerCase());

  function repeatLast() {
    setExercises(last.exercises.map(e => ({ name: e.name, sets: e.sets.map(s => ({ reps: s.reps, weight: s.weight })) })));
  }

  // Start a new exercise with the sets from the last time it was done.
  function addExercise(name) {
    const clean = name.trim();
    if (!clean) return;
    const known = findExercise(clean);
    const finalName = known ? known.name : clean;
    let prevSets = null;
    for (const w of history) {
      const hit = (w.exercises || []).find(e => e.name.toLowerCase() === finalName.toLowerCase());
      if (hit) { prevSets = hit.sets; break; }
    }
    setExercises(xs => [...xs, { name: finalName, sets: prevSets ? prevSets.map(s => ({ ...s })) : [newSet(), newSet(), newSet()] }]);
    setPick("");
  }

  const update = (ei, fn) => setExercises(xs => xs.map((x, i) => (i === ei ? fn(x) : x)));
  const setField = (ei, si, field, value) =>
    update(ei, x => ({ ...x, sets: x.sets.map((s, j) => (j === si ? { ...s, [field]: value } : s)) }));

  async function save() {
    const cleaned = exercises
      .map(e => ({ name: e.name, sets: e.sets.filter(s => Number(s.reps) > 0).map(s => ({ reps: Number(s.reps), weight: Number(s.weight) || 0 })) }))
      .filter(e => e.sets.length);
    if (!cleaned.length) { setError("Add at least one exercise with reps filled in."); return; }
    setSaving(true);
    setError("");
    const isToday = date === todayISO();
    const performed = isToday ? new Date() : new Date(`${date}T12:00:00`);
    const { error: err } = await supabase.from("workouts").insert({
      user_id: user.id,
      title: title.trim() || "Workout",
      performed_at: performed.toISOString(),
      duration_min: Number(duration) || null,
      exercises: cleaned,
    });
    setSaving(false);
    if (err) {
      setError(err.code === "42P01" || err.code === "PGRST205"
        ? "Workouts aren't switched on yet. Run supabase/workouts.sql in the Supabase SQL Editor first."
        : `Couldn't save the workout: ${err.message}`);
      return;
    }
    onNavigate("home");
  }

  return (
    <div className="lift">
      <header className="lift-head">
        <div>
          <p className="lift-date">New workout</p>
          <h1 className="lift-title">Log workout</h1>
        </div>
      </header>

      <section className="lift-card wl-meta">
        <div className="wl-chips">
          {WORKOUT_NAMES.map(n => (
            <button key={n} className={title === n ? "on" : ""} onClick={() => setTitle(n)}>{n}</button>
          ))}
        </div>
        <div className="wl-fields">
          <label>Name<input value={title} onChange={e => setTitle(e.target.value)} maxLength={40} /></label>
          <label>Date<input type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value)} /></label>
          <label>Minutes<input type="number" inputMode="numeric" min="0" value={duration} onChange={e => setDuration(e.target.value)} placeholder="60" /></label>
        </div>
        {last && exercises.length === 0 && (
          <button className="wl-repeat" onClick={repeatLast}>
            Repeat last {last.title} · {last.exercises.length} exercises
          </button>
        )}
      </section>

      {exercises.map((ex, ei) => {
        const info = findExercise(ex.name);
        return (
          <section className="lift-card wl-ex" key={ei}>
            <div className="lift-row">
              <div>
                <h2 className="lift-h2">{ex.name}</h2>
                {info && <p className="lift-sub">{[...info.primary, ...info.secondary].map(m => MUSCLE_NAMES[m]).join(" · ")}</p>}
              </div>
              <button className="lift-del" onClick={() => setExercises(xs => xs.filter((_, i) => i !== ei))}>Remove</button>
            </div>
            <div className="wl-sets">
              <div className="wl-set wl-set-head"><span>Set</span><span>Reps</span><span>Weight (lb)</span><span /></div>
              {ex.sets.map((s, si) => (
                <div className="wl-set" key={si}>
                  <span className="wl-n">{si + 1}</span>
                  <input type="number" inputMode="numeric" min="0" aria-label={`Set ${si + 1} reps`} value={s.reps} onChange={e => setField(ei, si, "reps", e.target.value)} placeholder="8" />
                  <input type="number" inputMode="decimal" min="0" step="2.5" aria-label={`Set ${si + 1} weight`} value={s.weight} onChange={e => setField(ei, si, "weight", e.target.value)} placeholder="0" />
                  <button aria-label={`Remove set ${si + 1}`} onClick={() => update(ei, x => ({ ...x, sets: x.sets.filter((_, j) => j !== si) }))}>×</button>
                </div>
              ))}
            </div>
            <button className="wl-add-set" onClick={() => update(ei, x => ({ ...x, sets: [...x.sets, newSet(x.sets[x.sets.length - 1])] }))}>+ Add set</button>
          </section>
        );
      })}

      <section className="lift-card wl-pick">
        <label htmlFor="wl-exercise" className="lift-h2">Add exercise</label>
        <div className="wl-pick-row">
          <input
            id="wl-exercise"
            list="wl-exercise-list"
            value={pick}
            placeholder="Search, e.g. Bench press"
            onChange={e => setPick(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addExercise(pick); }}
          />
          <button onClick={() => addExercise(pick)} disabled={!pick.trim()}>Add</button>
        </div>
        <datalist id="wl-exercise-list">
          {EXERCISES.map(e => <option key={e.name} value={e.name} />)}
        </datalist>
      </section>

      {error && <p className="wl-error">{error}</p>}
      <button className="lift-start wl-save" onClick={save} disabled={saving || !exercises.length}>
        {saving ? "Saving..." : "Save workout"}
      </button>
    </div>
  );
}
