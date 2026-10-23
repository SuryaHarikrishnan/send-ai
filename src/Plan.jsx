import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import "./Plan.css";
import { track } from "./tracking";
import MuscleThumb from "./MuscleThumb";
import {
  DAY_CHOICES, GOALS, INTENSITIES, LEVELS, MINUTE_CHOICES, SEXES,
  applyNutrition, buildPlan, estimateMinutes, loadPlan, nextDayIndex, nextTarget, nutritionFor, presetFor, removePlan, repText, savePlan, tweakPlan,
} from "./plan";

const DAY = 86400000;

function Choice({ options, value, onChange, label }) {
  return (
    <div className="pl-choice" role="radiogroup" aria-label={label}>
      {Object.entries(options).map(([id, o]) => (
        <button key={id} role="radio" aria-checked={value === id} className={value === id ? "on" : ""} onClick={() => onChange(id)}>
          <b>{o.name}</b>{o.line && <small>{o.line}</small>}
        </button>
      ))}
    </div>
  );
}

function Chips({ values, value, onChange, unit, label }) {
  return (
    <div className="wl-chips" role="radiogroup" aria-label={label}>
      {values.map(v => (
        <button key={v} role="radio" aria-checked={value === v} className={value === v ? "on" : ""} onClick={() => onChange(v)}>{v}{unit}</button>
      ))}
    </div>
  );
}

function Setup({ initial, onCancel, onBuilt }) {
  const p = initial || {};
  const [goal, setGoal] = useState(p.goal || "cut");
  const [sex, setSex] = useState(p.sex || null);
  const [age, setAge] = useState(p.age ? String(p.age) : "");
  const [level, setLevel] = useState(p.level || "beginner");
  const [ft, setFt] = useState(p.heightIn ? String(Math.floor(p.heightIn / 12)) : "");
  const [inch, setInch] = useState(p.heightIn ? String(p.heightIn % 12) : "");
  const [weight, setWeight] = useState(p.weightLb ? String(p.weightLb) : "");
  const [intensity, setIntensity] = useState(p.intensity || "moderate");
  const [days, setDays] = useState(p.days || 3);
  const [minutes, setMinutes] = useState(p.minutes || 60);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function build() {
    const heightIn = (Number(ft) || 0) * 12 + (Number(inch) || 0);
    const weightLb = Number(weight) || 0;
    if (heightIn && (heightIn < 48 || heightIn > 96)) { setError("Check your height. It should be between 4 ft and 8 ft."); return; }
    if (weightLb && (weightLb < 70 || weightLb > 500)) { setError("Check your weight. It should be between 70 and 500 lb."); return; }
    const years = Number(age) || 0;
    if (years && (years < 13 || years > 100)) { setError("Check your age. It should be between 13 and 100."); return; }
    setError("");
    const profile = { goal, level, sex, age: years || null, heightIn: heightIn || null, weightLb: weightLb || null, intensity, days, minutes };
    let plan = buildPlan(profile);
    let summary = "";
    if (note.trim()) {
      setBusy(true);
      try {
        ({ plan, summary } = await tweakPlan(plan, note.trim()));
      } catch (e) {
        summary = `Your plan is ready, but your note wasn't applied: ${e.message} You can ask again below.`;
      }
      setBusy(false);
    }
    onBuilt(plan, summary, !!note.trim());
  }

  return (
    <div className="lift">
      <header className="lift-head">
        <div>
          <p className="lift-date">{initial ? "Change your answers" : "A few quick questions"}</p>
          <h1 className="lift-title">Your plan</h1>
        </div>
      </header>

      <section className="lift-card pl-q">
        <h2 className="lift-h2">What's your goal?</h2>
        <Choice options={GOALS} value={goal} onChange={setGoal} label="Goal" />
      </section>

      <section className="lift-card pl-q">
        <h2 className="lift-h2">About you</h2>
        <div className="pl-body">
          <label>Height
            <span className="pl-pair">
              <span className="pl-unit"><input type="number" inputMode="numeric" min="3" max="8" value={ft} onChange={e => setFt(e.target.value)} placeholder="5" aria-label="Height, feet" /><i>ft</i></span>
              <span className="pl-unit"><input type="number" inputMode="numeric" min="0" max="11" value={inch} onChange={e => setInch(e.target.value)} placeholder="10" aria-label="Height, inches" /><i>in</i></span>
            </span>
          </label>
          <label>Weight
            <span className="pl-unit"><input type="number" inputMode="decimal" min="70" max="500" value={weight} onChange={e => setWeight(e.target.value)} placeholder="165" aria-label="Weight in pounds" /><i>lb</i></span>
          </label>
          <label>Age
            <span className="pl-unit"><input type="number" inputMode="numeric" min="13" max="100" value={age} onChange={e => setAge(e.target.value)} placeholder="28" aria-label="Age in years" /><i>yrs</i></span>
          </label>
          <label>Sex
            <span className="pl-sex" role="radiogroup" aria-label="Sex">
              {Object.entries(SEXES).map(([id, s]) => (
                <button key={id} role="radio" aria-checked={sex === id} className={sex === id ? "on" : ""} onClick={() => setSex(sex === id ? null : id)}>{s.name}</button>
              ))}
            </span>
          </label>
        </div>
        <p className="lift-sub">These set your daily calories and starting weights. Without height and weight you get the workouts only.</p>
        <h3 className="pl-h3">How long have you been lifting?</h3>
        <Choice options={LEVELS} value={level} onChange={setLevel} label="Experience" />
      </section>

      <section className="lift-card pl-q">
        <h2 className="lift-h2">How hard should it be?</h2>
        <Choice options={INTENSITIES} value={intensity} onChange={setIntensity} label="Intensity" />
      </section>

      <section className="lift-card pl-q">
        <h2 className="lift-h2">Time in the gym</h2>
        <h3 className="pl-h3">Days a week</h3>
        <Chips values={DAY_CHOICES} value={days} onChange={setDays} label="Days a week" />
        <h3 className="pl-h3">Minutes a workout</h3>
        <Chips values={MINUTE_CHOICES} value={minutes} onChange={setMinutes} unit=" min" label="Minutes a workout" />
      </section>

      <section className="lift-card pl-q">
        <h2 className="lift-h2">Anything else?</h2>
        <textarea className="pl-note" rows={3} maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="Optional. Injuries, missing equipment, or what to focus on. Like: bad knee, no barbell, more arms." />
        <p className="lift-sub">If you write something, AI adjusts the plan to fit.</p>
      </section>

      {error && <p className="wl-error">{error}</p>}
      <button className="lift-start wl-save" onClick={build} disabled={busy}>
        {busy ? "Adjusting your plan..." : initial ? "Rebuild my plan" : "Build my plan"}
      </button>
      {onCancel && <button className="wl-discard" onClick={onCancel}>Cancel, keep my plan</button>}
    </div>
  );
}

// Daily calories and macros that go with the goal. They're copied into the Food tab's goals.
function Nutrition({ plan, onAdd }) {
  const n = plan.nutrition;
  if (!n) {
    return (
      <section className="lift-card pl-q">
        <h2 className="lift-h2">Calories and macros</h2>
        <p className="lift-sub">Get daily calorie and macro targets for your goal. They become your Food goals.</p>
        <button className="lift-start pl-ask" onClick={onAdd}>{plan.profile.weightLb && plan.profile.heightIn ? "Add targets" : "Add height and weight"}</button>
      </section>
    );
  }
  const change = n.weeklyLb < 0 ? `lose about ${Math.abs(n.weeklyLb)} lb a week` : n.weeklyLb > 0 ? `gain about ${n.weeklyLb} lb a week` : "keep your weight steady";
  return (
    <section className="lift-card pl-q pl-food">
      <div className="lift-row">
        <h2 className="lift-h2">Eat each day</h2>
        <span className="pl-badge off">Food goals</span>
      </div>
      <div className="pl-kcal"><b>{n.kcal.toLocaleString()}</b> kcal</div>
      <div className="pl-macros">
        <span><b>{n.protein} g</b>Protein</span>
        <span><b>{n.carbs} g</b>Carbs</span>
        <span><b>{n.fat} g</b>Fat</span>
      </div>
      <p className="lift-sub">You burn about {n.maintenance.toLocaleString()} kcal a day. Eating this much should {change}. These are set as your goals on the Food tab.</p>
    </section>
  );
}

export default function Plan({ user, onStart }) {
  const [plan, setPlan] = useState(undefined);
  const [workouts, setWorkouts] = useState([]);
  const [editing, setEditing] = useState(false);
  const [ask, setAsk] = useState("");
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState(null);
  const [undo, setUndo] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    loadPlan(user).then(setPlan, () => setPlan(null));
    supabase
      .from("workouts")
      .select("title, exercises, performed_at")
      .eq("user_id", user.id)
      .gte("performed_at", new Date(Date.now() - 120 * DAY).toISOString())
      .order("performed_at", { ascending: false })
      .then(({ data }) => setWorkouts(data || []));
  }, [user]);

  function keep(next, message, previous) {
    // New targets from building, changing or undoing become the Food goals.
    if (next.nutrition && next.nutrition !== plan?.nutrition) applyNutrition(next, user, true);
    setPlan(next);
    savePlan(user, next);
    setNote(message ? { text: message, error: false } : null);
    setUndo(previous || null);
  }

  async function change() {
    const request = ask.trim();
    if (!request) return;
    setAsking(true);
    setAsked(true);
    setNote(null);
    try {
      const { plan: next, summary } = await tweakPlan(plan, request);
      keep(next, summary || "Plan updated.", plan);
      setAsk("");
      track("plan_tweaked", { days: next.days.length });
    } catch (e) {
      setNote({ text: e.message, error: true });
    }
    setAsking(false);
  }

  if (plan === undefined) return <div className="coming-soon">Loading...</div>;

  if (!plan || editing) {
    return (
      <Setup
        initial={editing ? plan.profile : null}
        onCancel={editing ? () => setEditing(false) : null}
        onBuilt={(next, summary, withNote) => {
          keep(next, summary, null);
          setAsked(false);
          setEditing(false);
          window.scrollTo(0, 0);
          track(editing ? "plan_rebuilt" : "plan_created", { goal: next.profile.goal, days: next.days.length, minutes: next.profile.minutes, level: next.profile.level, ai_note: withNote });
        }}
      />
    );
  }

  // Notes from "Change something" show under it; the one from building the plan shows at the top.
  const Note = note && (
    <div className={`pl-note-card${note.error ? " err" : ""}${undo || asked ? "" : " lift-card"}`} role="status">
      <p>{note.text}</p>
      {undo && <button className="lift-today" onClick={() => keep(undo, "Changed back.", null)}>Undo</button>}
    </div>
  );
  const p = plan.profile;
  const { index: next, doneToday } = nextDayIndex(plan, workouts);

  return (
    <div className="lift">
      <header className="lift-head">
        <div>
          <p className="lift-date">{GOALS[p.goal]?.name} · {plan.days.length} days a week · {p.minutes} min</p>
          <h1 className="lift-title">Your plan</h1>
        </div>
      </header>

      {note && !undo && !asked && Note}

      <Nutrition plan={plan} onAdd={() => {
        const nutrition = nutritionFor(p);
        if (nutrition) keep({ ...plan, nutrition }, "Calorie targets added. They're your Food goals now.", null);
        else { setEditing(true); window.scrollTo(0, 0); }
      }} />

      {plan.days.map((d, di) => (
        <section className={`lift-card pl-day${di === next ? " next" : ""}`} key={di}>
          <div className="lift-row">
            <div>
              <h2 className="lift-h2">{d.name}</h2>
              <p className="lift-sub">
                Day {di + 1} · {d.exercises.length} exercises · about {estimateMinutes(d, p)} min
              </p>
            </div>
            {di === next ? <span className="pl-badge">Next up</span> : doneToday === di && <span className="pl-badge off">Done today</span>}
          </div>
          <div className="pl-ex">
            {d.exercises.map((ex, i) => {
              const t = nextTarget(ex, workouts, p);
              return (
                <div key={i} className="pl-ex-row">
                  <MuscleThumb name={ex.name} />
                  <span className="pl-ex-name"><b>{ex.name}</b><small>{t.why}</small></span>
                  <span className="pl-dose">{ex.sets} × {repText(ex.reps)}<small>{t.weight === 0 ? "body weight" : t.weight ? `${t.weight} lb` : "your pick"}</small></span>
                </div>
              );
            })}
          </div>
          <button
            className={di === next ? "lift-start pl-go" : "pl-go-alt"}
            onClick={() => { track("plan_workout_started", { day: d.name, next: di === next }); onStart(presetFor(d, workouts, p)); }}
          >
            {di === next && <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>}
            Start {d.name}
          </button>
        </section>
      ))}

      <section className="lift-card pl-q">
        <h2 className="lift-h2">Change something</h2>
        <p className="lift-sub">Tell AI what to change in your workouts or eating and it rewrites the plan. You can undo it.</p>
        <textarea className="pl-note" rows={2} maxLength={500} value={ask} onChange={e => setAsk(e.target.value)} placeholder="Like: swap squats for leg press, or more carbs on a 2,000 calorie diet" />
        <button className="lift-start pl-ask" onClick={change} disabled={asking || !ask.trim()}>{asking ? "Changing your plan..." : "Change plan"}</button>
        {note && (undo || asked) && Note}
      </section>

      <p className="pl-how">Weights go up once you hit the top of the rep range on every set. Starting a workout fills the log with these sets, and you can change anything before saving.</p>

      <div className="pl-foot">
        <button className="wl-discard" onClick={() => { setEditing(true); window.scrollTo(0, 0); }}>Change my answers</button>
        {confirmRemove ? (
          <span className="lift-del-ask">
            Remove your plan?
            <button onClick={async () => { await removePlan(user); setPlan(null); setConfirmRemove(false); setNote(null); track("plan_removed"); }}>Remove</button>
            <button onClick={() => setConfirmRemove(false)}>Keep</button>
          </span>
        ) : (
          <button className="wl-discard" onClick={() => setConfirmRemove(true)}>Remove plan</button>
        )}
      </div>
    </div>
  );
}
