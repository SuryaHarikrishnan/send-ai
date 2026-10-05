import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import ExercisePicker from "./ExercisePicker";
import DurationPicker from "./DurationPicker";
import { track } from "./tracking";
import { MUSCLE_NAMES, WORKOUT_NAMES, findExercise, formatDuration, setSummary, workoutsError } from "./lifting";

const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const newSet = (prev) => ({ reps: prev?.reps ?? "", weight: prev?.weight ?? "" });

function readRest() {
  try { return Math.min(600, Math.max(15, Number(localStorage.getItem("send.restSec")) || 90)); } catch { return 90; }
}
// The workout being logged is kept on the phone until it's saved, so tabbing
// out, switching apps or closing the app doesn't lose it.
const draftKey = user => `send.workoutDraft.${user.id}`;
function readDraft(user) {
  try { return JSON.parse(localStorage.getItem(draftKey(user))) || null; } catch { return null; }
}
function clearDraft(user) {
  try { localStorage.removeItem(draftKey(user)); } catch { /* storage blocked */ }
}

const clock = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

// A short double beep when rest is over. Quietly does nothing where audio isn't allowed.
function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.22].forEach(at => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + at);
      o.stop(ctx.currentTime + at + 0.2);
    });
    setTimeout(() => ctx.close(), 800);
  } catch { /* no audio */ }
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* no vibration */ }
}

function RestTimer({ rest, onChange, onDone }) {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });
  const left = Math.max(0, Math.ceil((rest.end - now) / 1000));

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true;
      chime();
      const t = setTimeout(() => done.current(), 4000);
      return () => clearTimeout(t);
    }
    if (left > 0) fired.current = false;
  }, [left]);

  const pct = Math.min(1, 1 - left / rest.total) * 100;
  return (
    <div className={`wl-rest${left === 0 ? " over" : ""}`} role="timer" aria-live={left === 0 ? "assertive" : "off"}>
      <div className="wl-rest-bar"><i style={{ width: `${pct}%` }} /></div>
      <div className="wl-rest-row">
        <div className="wl-rest-time">
          <small>{left === 0 ? "Rest over" : "Rest"}</small>
          <b>{left === 0 ? "Go!" : clock(left)}</b>
        </div>
        <button onClick={() => onChange(-15)} aria-label="15 seconds less" disabled={left === 0}>−15</button>
        <button onClick={() => onChange(15)} aria-label="15 seconds more">+15</button>
        <button className="wl-rest-skip" onClick={onDone}>{left === 0 ? "Close" : "Skip"}</button>
      </div>
    </div>
  );
}

export default function WorkoutLog({ user, onNavigate }) {
  const [draft] = useState(() => readDraft(user));
  const [title, setTitle] = useState(draft?.title ?? "Push");
  const [date, setDate] = useState(() => (draft?.date && draft.date <= todayISO() ? draft.date : todayISO()));
  const [duration, setDuration] = useState(draft?.duration ?? "");
  const [pickingDur, setPickingDur] = useState(false);
  const [exercises, setExercises] = useState(draft?.exercises ?? []);
  const [rest, setRest] = useState(() => (draft?.rest && draft.rest.end > Date.now() ? draft.rest : null));
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

  useEffect(() => {
    try {
      if (exercises.length) localStorage.setItem(draftKey(user), JSON.stringify({ title, date, duration, exercises, rest }));
      else localStorage.removeItem(draftKey(user));
    } catch { /* storage blocked */ }
  }, [user, title, date, duration, exercises, rest]);

  function discard() {
    if (!window.confirm("Discard this workout? What you've entered will be lost.")) return;
    clearDraft(user);
    setExercises([]);
    setTitle("Push");
    setDate(todayISO());
    setDuration("");
    setRest(null);
    setError("");
  }

  // Most recent sets for an exercise, from earlier workouts.
  function lastTime(name) {
    const key = name.toLowerCase();
    for (const w of history) {
      const hit = (w.exercises || []).find(e => e.name.toLowerCase() === key);
      if (hit) return { date: w.performed_at, sets: hit.sets };
    }
    return null;
  }
  const recent = [];
  history.forEach(w => (w.exercises || []).forEach(e => {
    if (recent.length < 12 && !recent.some(n => n.toLowerCase() === e.name.toLowerCase())) recent.push(e.name);
  }));
  const taken = new Set(exercises.map(e => e.name.toLowerCase()));

  function startRest() {
    const total = readRest();
    setRest({ end: new Date().getTime() + total * 1000, total });
  }
  function adjustRest(delta) {
    setRest(r => {
      if (!r) return r;
      const left = Math.max(0, r.end - Date.now());
      const total = Math.max(15, Math.round(r.total + delta));
      try { localStorage.setItem("send.restSec", String(total)); } catch { /* storage blocked */ }
      return { end: Date.now() + Math.max(0, left + delta * 1000), total };
    });
  }
  function toggleDone(ei, si) {
    const s = exercises[ei].sets[si];
    if (!s.done && !(Number(s.reps) > 0)) return;
    setField(ei, si, "done", !s.done);
    if (!s.done) startRest();
  }

  const last = history.find(w => w.title.toLowerCase() === title.trim().toLowerCase());

  function repeatLast() {
    setExercises(last.exercises.map(e => ({ name: e.name, sets: e.sets.map(s => ({ reps: s.reps, weight: s.weight })) })));
  }

  // Start a new exercise with the sets from the last time it was done.
  function addExercise(name) {
    const clean = name.trim();
    if (!clean) return;
    const known = findExercise(clean);
    const finalName = known ? known.name : clean[0].toUpperCase() + clean.slice(1);
    const prev = lastTime(finalName);
    setExercises(xs => [...xs, { name: finalName, sets: prev ? prev.sets.map(s => ({ reps: s.reps, weight: s.weight })) : [newSet(), newSet(), newSet()] }]);
  }

  const update = (ei, fn) => setExercises(xs => xs.map((x, i) => (i === ei ? fn(x) : x)));
  const setField = (ei, si, field, value) =>
    update(ei, x => ({ ...x, sets: x.sets.map((s, j) => (j === si ? { ...s, [field]: value } : s)) }));

  async function save() {
    if (date > todayISO()) { setError("The date is in the future. Pick today or an earlier day."); return; }
    for (const e of exercises) {
      for (const s of e.sets) {
        if (s.reps === "" && s.weight === "") continue;
        const reps = Number(s.reps), weight = Number(s.weight) || 0;
        if (reps < 0 || weight < 0) { setError(`${e.name}: reps and weight can't be negative.`); return; }
        if (reps > 100) { setError(`${e.name}: ${reps} reps looks like a typo. Use 100 or fewer.`); return; }
        if (weight > 1500) { setError(`${e.name}: ${weight} lb looks like a typo. Use 1500 lb or less.`); return; }
      }
    }
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
      const e = workoutsError(err);
      setError(e.title === "Couldn't load workouts." ? `Couldn't save the workout: ${err.message}` : `${e.title} ${e.detail}`);
      return;
    }
    clearDraft(user);
    track("workout_logged", { title: title.trim() || "Workout", exercises: cleaned.length, sets: cleaned.reduce((a, e) => a + e.sets.length, 0), backdated: !isToday });
    onNavigate("home");
  }

  return (
    <div className="lift">
      <header className="lift-head">
        <div>
          <p className="lift-date">{draft?.exercises?.length && exercises.length ? "Picking up where you left off" : "New workout"}</p>
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
          <label>Duration
            <button type="button" className={`wl-dur${duration ? "" : " empty"}`} onClick={() => setPickingDur(true)}>
              {formatDuration(duration) || "60 min"}
            </button>
          </label>
        </div>
        {pickingDur && (
          <DurationPicker
            minutes={Number(duration) || 0}
            onCancel={() => setPickingDur(false)}
            onDone={min => { setDuration(min ? String(min) : ""); setPickingDur(false); }}
          />
        )}
        {last && exercises.length === 0 && (
          <button className="wl-repeat" onClick={repeatLast}>
            Repeat last {last.title} · {last.exercises.length} exercises
          </button>
        )}
      </section>

      {exercises.map((ex, ei) => {
        const info = findExercise(ex.name);
        const prev = lastTime(ex.name);
        return (
          <section className="lift-card wl-ex" key={ei}>
            <div className="lift-row wl-ex-head">
              <div>
                <h2 className="lift-h2">{ex.name}</h2>
                {info && <p className="lift-sub">{info.primary.map(m => MUSCLE_NAMES[m]).join(" · ")}</p>}
                {prev && (
                  <p className="wl-last">
                    Last time · {setSummary(prev.sets).replace(/^\d+ sets · /, "")} · {new Date(prev.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                )}
              </div>
              <button className="lift-del" onClick={() => setExercises(xs => xs.filter((_, i) => i !== ei))}>Remove</button>
            </div>
            <div className="wl-sets">
              <div className="wl-set wl-set-head"><span>Set</span><span>Reps</span><span>Weight (lb)</span><span className="wl-done-h">Done</span><span /></div>
              {ex.sets.map((s, si) => (
                <div className={`wl-set${s.done ? " done" : ""}`} key={si}>
                  <span className="wl-n">{si + 1}</span>
                  <input type="number" inputMode="numeric" min="0" aria-label={`Set ${si + 1} reps`} value={s.reps} onChange={e => setField(ei, si, "reps", e.target.value)} placeholder="8" />
                  <input type="number" inputMode="decimal" min="0" step="2.5" aria-label={`Set ${si + 1} weight`} value={s.weight} onChange={e => setField(ei, si, "weight", e.target.value)} placeholder="0" />
                  <button
                    className={`wl-done${s.done ? " on" : ""}`}
                    aria-label={s.done ? `Set ${si + 1} done, tap to undo` : `Mark set ${si + 1} done and start rest`}
                    aria-pressed={!!s.done}
                    disabled={!s.done && !(Number(s.reps) > 0)}
                    onClick={() => toggleDone(ei, si)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                  </button>
                  <button aria-label={`Remove set ${si + 1}`} onClick={() => update(ei, x => ({ ...x, sets: x.sets.filter((_, j) => j !== si) }))}>×</button>
                </div>
              ))}
            </div>
            <button className="wl-add-set" onClick={() => update(ei, x => ({ ...x, sets: [...x.sets, newSet(x.sets[x.sets.length - 1])] }))}>+ Add set</button>
          </section>
        );
      })}

      <ExercisePicker recent={recent} taken={taken} onAdd={addExercise} />

      {error && <p className="wl-error">{error}</p>}
      <button className="lift-start wl-save" onClick={save} disabled={saving || !exercises.length}>
        {saving ? "Saving..." : "Save workout"}
      </button>
      {exercises.length > 0 && <button className="wl-discard" onClick={discard}>Discard workout</button>}
      {rest && <div className="wl-rest-space" />}
      {rest && <RestTimer rest={rest} onChange={adjustRest} onDone={() => setRest(null)} />}
    </div>
  );
}
