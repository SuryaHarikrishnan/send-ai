import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import BodyMap from "./BodyMap";
import { MUSCLE_NAMES, muscleSets, prFlags, setSummary, totalSets, totalVolume, weekStart, weekStreak } from "./lifting";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY = 86400000;

function readGoal() {
  try { return Math.min(7, Math.max(1, Number(localStorage.getItem("send.weeklyGoal")) || 3)); } catch { return 3; }
}

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
function whenLabel(d) {
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / DAY);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return new Date(d).toLocaleDateString(undefined, { weekday: "long" });
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
const Flame = () => (
  <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2c.9 3.3 4.8 5.4 4.8 10.8a4.8 4.8 0 0 1-9.6 0c0-2.3 1-3.9 2.2-5 .2 1.5.9 2.6 2 3.1-.4-2.9.1-5.9.6-8.9z" /></svg>
);
const Dumbbell = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11" /></svg>
);

export default function LiftHome({ user, onNavigate, onOpenExercise }) {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [goal, setGoal] = useState(readGoal);
  const [selectedId, setSelectedId] = useState(null);
  const [muscle, setMuscle] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    const since = new Date(Date.now() - 400 * DAY).toISOString();
    supabase
      .from("workouts")
      .select("*")
      .eq("user_id", user.id)
      .gte("performed_at", since)
      .order("performed_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setSetupNeeded(true);
        setWorkouts(data || []);
        setLoading(false);
      });
  }, [user]);

  function changeGoal(n) {
    const g = Math.min(7, Math.max(1, n));
    setGoal(g);
    try { localStorage.setItem("send.weeklyGoal", String(g)); } catch { /* storage blocked */ }
  }

  async function remove(id) {
    const { error } = await supabase.from("workouts").delete().eq("id", id);
    if (!error) {
      setWorkouts(ws => ws.filter(w => w.id !== id));
      if (selectedId === id) setSelectedId(null);
    }
    setConfirmDelete(null);
  }

  const startMs = weekStart(new Date()).getTime();
  const start = new Date(startMs);
  const thisWeek = workouts.filter(w => new Date(w.performed_at).getTime() >= startMs);
  const streak = weekStreak(workouts, goal);
  const prs = prFlags(workouts);
  const selected = workouts.find(w => w.id === selectedId) || null;
  const mode = selected ? "workout" : "week";
  const sets = muscleSets(selected ? [selected] : thisWeek);
  const ranked = Object.entries(sets).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const weekSetCount = thisWeek.reduce((a, w) => a + totalSets(w), 0);

  if (loading) return <div className="coming-soon">Loading...</div>;

  const days = DAY_LETTERS.map((letter, i) => {
    const date = new Date(start.getTime() + i * DAY);
    const w = workouts.find(x => sameDay(x.performed_at, date));
    return { letter, date, w, today: sameDay(date, new Date()), future: date > new Date() };
  });

  return (
    <div className="lift">
      <header className="lift-head">
        <div>
          <p className="lift-date">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="lift-title">{greeting()}</h1>
        </div>
        <button className="lift-start" onClick={() => onNavigate("log")}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
          Log workout
        </button>
      </header>

      {setupNeeded && (
        <div className="lift-card lift-setup">
          <strong>Workouts aren't switched on yet.</strong>
          <p>The database table for workouts hasn't been created. Run <code>supabase/workouts.sql</code> once in the Supabase SQL Editor, then reload.</p>
        </div>
      )}

      <section className="lift-card lift-week">
        <div className="lift-row">
          <div className="lift-goal">
            <b>{thisWeek.length}</b> of
            <span className="lift-stepper">
              <button aria-label="Lower weekly goal" onClick={() => changeGoal(goal - 1)}>−</button>
              <b>{goal}</b>
              <button aria-label="Raise weekly goal" onClick={() => changeGoal(goal + 1)}>+</button>
            </span>
            workouts
          </div>
          <div className={streak ? "lift-streak" : "lift-streak off"}>
            <span className="lift-flame"><Flame /></span>
            <span>{streak} week streak<small>{goal} workouts a week</small></span>
          </div>
        </div>
        <div className="lift-days">
          {days.map(d => (
            <button
              key={d.letter + d.date.getDate()}
              className={`lift-day${d.w ? " done" : ""}${d.today ? " today" : ""}${d.w && d.w.id === selectedId ? " sel" : ""}`}
              disabled={!d.w}
              aria-label={d.w ? `${d.w.title} on ${d.date.toDateString()}` : d.date.toDateString()}
              onClick={() => setSelectedId(d.w.id === selectedId ? null : d.w.id)}
            >
              <span className="lift-dn">{d.today ? "Today" : d.letter}</span>
              <span className="lift-dc">{d.w ? <Check /> : d.date.getDate()}</span>
            </button>
          ))}
        </div>
        <div className="lift-bar"><i style={{ width: `${Math.min(1, thisWeek.length / goal) * 100}%` }} /></div>
      </section>

      <section className="lift-card lift-body">
        <div className="lift-row">
          <div>
            <h2 className="lift-h2">{selected ? `${selected.title}, ${whenLabel(selected.performed_at).toLowerCase()}` : "Muscles this week"}</h2>
            <p className="lift-sub">
              {selected
                ? `${totalSets(selected)} sets${selected.duration_min ? ` · ${selected.duration_min} min` : ""}`
                : `${weekSetCount} sets across ${thisWeek.length} workout${thisWeek.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="lift-toggle">
            <button className={!selected ? "on" : ""} onClick={() => setSelectedId(null)}>Week</button>
            <button className={selected ? "on" : ""} disabled={!workouts.length} onClick={() => workouts[0] && setSelectedId(workouts[0].id)}>Last</button>
          </div>
        </div>
        <BodyMap sets={sets} mode={mode} selected={muscle} onSelect={m => setMuscle(m === muscle ? null : m)} />
        <p className="lift-tip">
          {muscle ? (
            <>{MUSCLE_NAMES[muscle]} <span>· {sets[muscle] || 0} sets {selected ? "in this workout" : "this week"}</span></>
          ) : (
            <span>Tap a muscle</span>
          )}
        </p>
        <div className="lift-legend">
          <span><i className="bm-l1" />{mode === "week" ? "1–4 sets" : "1"}</span>
          <span><i className="bm-l2" />{mode === "week" ? "5–9" : "2–3"}</span>
          <span><i className="bm-l3" />{mode === "week" ? "10+" : "4+"}</span>
        </div>
        {ranked.length > 0 && (
          <div className="lift-vol">
            {ranked.map(([k, v]) => (
              <div className="lift-vr" key={k}>
                <span>{MUSCLE_NAMES[k]}</span>
                <span className="lift-tr"><i style={{ width: `${Math.min(v / 20, 1) * 100}%` }} />{!selected && <em />}</span>
                <span>{v} sets</span>
              </div>
            ))}
            {!selected && <p className="lift-vnote"><i />10–20 sets a week is a common target for growth</p>}
          </div>
        )}
      </section>

      <div className="lift-row lift-list-head">
        <h2 className="lift-h2">Workouts</h2>
      </div>

      {workouts.length === 0 && !setupNeeded && (
        <div className="lift-card lift-empty">
          <p>No workouts yet. Log your first one and the body map will light up with the muscles you trained.</p>
          <button className="lift-start" onClick={() => onNavigate("log")}>Log workout</button>
        </div>
      )}

      {workouts.slice(0, 15).map(w => (
        <article key={w.id} className={`lift-card lift-wo${w.id === selectedId ? " sel" : ""}`}>
          <button className="lift-wo-top" onClick={() => setSelectedId(w.id === selectedId ? null : w.id)}>
            <span className="lift-ic"><Dumbbell /></span>
            <span className="lift-wo-name">
              <b>{w.title}</b>
              <small>{whenLabel(w.performed_at)}{w.duration_min ? ` · ${w.duration_min} min` : ""}</small>
            </span>
            <span className="lift-mini"><BodyMap sets={muscleSets([w])} mode="workout" small /></span>
          </button>
          <div className="lift-ex">
            {(w.exercises || []).map((ex, i) => (
              <div key={i}>
                <button className="lift-ex-name" onClick={() => onOpenExercise(ex.name.trim().toLowerCase())}>
                  {ex.name}{prs[`${w.id}:${i}`] && <span className="lift-pr">PR</span>}
                </button>
                <span>{setSummary(ex.sets)}</span>
              </div>
            ))}
          </div>
          <div className="lift-tot">
            <span>{totalSets(w)} sets</span>
            {totalVolume(w) > 0 && <span>{totalVolume(w).toLocaleString()} lb lifted</span>}
            {confirmDelete === w.id ? (
              <span className="lift-del-ask">
                Delete this workout?
                <button onClick={() => remove(w.id)}>Delete</button>
                <button onClick={() => setConfirmDelete(null)}>Keep</button>
              </span>
            ) : (
              <button className="lift-del" onClick={() => setConfirmDelete(w.id)}>Delete</button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
