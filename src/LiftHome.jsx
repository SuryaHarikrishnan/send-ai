import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import BodyMap from "./BodyMap";
import { syncReminderInfo } from "./notify";
import { MUSCLE_NAMES, muscleSets, prFlags, setSummary, totalSets, totalVolume, weekStart, weekStreak, workoutsError } from "./lifting";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY = 86400000;

function readGoal() {
  try { return Math.min(7, Math.max(1, Number(localStorage.getItem("send.weeklyGoal")) || 3)); } catch { return 3; }
}

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const midnight = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
// Adding days by date, not by 24 h, so daylight saving changes don't skip a day.
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
function dayPhrase(d) {
  const label = dayLabel(d);
  return label === "Today" || label === "Yesterday" ? label.toLowerCase() : `on ${new Date(d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`;
}
const shortDate = d => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
function dayLabel(d) {
  const days = Math.round((midnight(new Date()) - midnight(d)) / DAY);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Date(d).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
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
const Chevron = ({ left }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d={left ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} /></svg>
);
const MAX_WEEKS_BACK = 52;
const Dumbbell = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11" /></svg>
);

export default function LiftHome({ user, onNavigate, onEdit, onOpenExercise }) {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [goal, setGoal] = useState(readGoal);
  // The day whose workouts are listed, and how many weeks back the strip is showing.
  const [day, setDay] = useState(() => midnight(new Date()));
  const [weekBack, setWeekBack] = useState(0);
  const [mapDay, setMapDay] = useState(false);
  const [muscle, setMuscle] = useState(null);
  const swipe = useRef(null);
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
        if (error) setLoadError(workoutsError(error));
        setWorkouts(data || []);
        setLoading(false);
      });
  }, [user]);

  function changeGoal(n) {
    const g = Math.min(7, Math.max(1, n));
    setGoal(g);
    try { localStorage.setItem("send.weeklyGoal", String(g)); } catch { /* storage blocked */ }
    syncReminderInfo(user.id, g);
  }

  async function remove(id) {
    const { error } = await supabase.from("workouts").delete().eq("id", id);
    if (!error) setWorkouts(ws => ws.filter(w => w.id !== id));
    setConfirmDelete(null);
  }

  const start = addDays(weekStart(new Date()), -7 * weekBack);
  const end = addDays(start, 7);
  const inWeek = workouts.filter(w => { const t = new Date(w.performed_at); return t >= start && t < end; });
  const streak = weekStreak(workouts, goal);
  const prs = prFlags(workouts);
  const dayWorkouts = workouts.filter(w => sameDay(w.performed_at, day));
  const showDay = mapDay && dayWorkouts.length > 0;
  const mode = showDay ? "workout" : "week";
  const sets = muscleSets(showDay ? dayWorkouts : inWeek);
  const ranked = Object.entries(sets).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const weekSetCount = inWeek.reduce((a, w) => a + totalSets(w), 0);
  const weekName = weekBack === 0 ? "This week" : weekBack === 1 ? "Last week" : `${shortDate(start)} – ${shortDate(addDays(start, 6))}`;

  if (loading) return <div className="coming-soon">Loading...</div>;

  const days = DAY_LETTERS.map((letter, i) => {
    const date = addDays(start, i);
    const done = workouts.some(x => sameDay(x.performed_at, date));
    return { letter, date, done, today: sameDay(date, new Date()), future: date > new Date() };
  });

  function pickDay(d) {
    setDay(d);
    setMapDay(workouts.some(w => sameDay(w.performed_at, d)));
    setMuscle(null);
  }
  // Moving a week keeps the same weekday selected (today, at most).
  function moveWeek(delta) {
    const next = Math.min(MAX_WEEKS_BACK, Math.max(0, weekBack + delta));
    if (next === weekBack) return;
    setWeekBack(next);
    const d = addDays(day, -7 * (next - weekBack));
    pickDay(d > new Date() ? midnight(new Date()) : d);
  }
  const onTouchStart = e => { swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = e => {
    if (!swipe.current) return;
    const dx = e.changedTouches[0].clientX - swipe.current.x;
    const dy = e.changedTouches[0].clientY - swipe.current.y;
    swipe.current = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) moveWeek(dx > 0 ? 1 : -1);
  };

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

      {loadError && (
        <div className="lift-card lift-setup">
          <strong>{loadError.title}</strong>
          <p>{loadError.detail}</p>
        </div>
      )}

      <section className="lift-card lift-week">
        <div className="lift-row">
          <div className="lift-goal">
            <b>{inWeek.length}</b> of
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
        <div className="lift-weeknav">
          <button aria-label="Previous week" disabled={weekBack >= MAX_WEEKS_BACK} onClick={() => moveWeek(1)}><Chevron left /></button>
          <span>{weekName}</span>
          <button aria-label="Next week" disabled={weekBack === 0} onClick={() => moveWeek(-1)}><Chevron /></button>
        </div>
        <div className="lift-days" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {days.map(d => (
            <button
              key={d.date.toDateString()}
              className={`lift-day${d.done ? " done" : ""}${d.today ? " today" : ""}${sameDay(d.date, day) ? " sel" : ""}`}
              disabled={d.future}
              aria-pressed={sameDay(d.date, day)}
              aria-label={`${d.date.toDateString()}${d.done ? ", workout logged" : ""}`}
              onClick={() => pickDay(d.date)}
            >
              <span className="lift-dn">{d.today ? "Today" : d.letter}</span>
              <span className="lift-dc">{d.done ? <Check /> : d.date.getDate()}</span>
            </button>
          ))}
        </div>
        <div className="lift-bar"><i style={{ width: `${Math.min(1, inWeek.length / goal) * 100}%` }} /></div>
      </section>

      <section className="lift-card lift-body">
        <div className="lift-row">
          <div>
            <h2 className="lift-h2">{showDay ? `Muscles ${dayPhrase(day)}` : weekBack < 2 ? `Muscles ${weekName.toLowerCase()}` : `Muscles, ${weekName}`}</h2>
            <p className="lift-sub">
              {showDay
                ? `${dayWorkouts.reduce((a, w) => a + totalSets(w), 0)} sets · ${dayWorkouts.map(w => w.title).join(", ")}`
                : `${weekSetCount} sets across ${inWeek.length} workout${inWeek.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="lift-toggle">
            <button className={!showDay ? "on" : ""} onClick={() => setMapDay(false)}>Week</button>
            <button className={showDay ? "on" : ""} disabled={!dayWorkouts.length} onClick={() => setMapDay(true)}>Day</button>
          </div>
        </div>
        <BodyMap sets={sets} mode={mode} selected={muscle} onSelect={m => setMuscle(m === muscle ? null : m)} />
        <p className="lift-tip">
          {muscle ? (
            <>{MUSCLE_NAMES[muscle]} <span>· {sets[muscle] || 0} sets {showDay ? dayPhrase(day) : weekBack === 0 ? "this week" : "that week"}</span></>
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
                <span className="lift-tr"><i style={{ width: `${Math.min(v / 20, 1) * 100}%` }} />{!showDay && <em />}</span>
                <span>{v} sets</span>
              </div>
            ))}
            {!showDay && <p className="lift-vnote"><i />10–20 sets a week is a common target for growth</p>}
          </div>
        )}
      </section>

      <div className="lift-row lift-list-head">
        <h2 className="lift-h2">{dayLabel(day)}</h2>
        {!sameDay(day, new Date()) && (
          <button className="lift-today" onClick={() => { setWeekBack(0); pickDay(midnight(new Date())); }}>Back to today</button>
        )}
      </div>

      {workouts.length === 0 && !loadError && (
        <div className="lift-card lift-empty">
          <p>No workouts yet. Log your first one and the body map will light up with the muscles you trained.</p>
          <button className="lift-start" onClick={() => onNavigate("log")}>Log workout</button>
        </div>
      )}

      {workouts.length > 0 && dayWorkouts.length === 0 && (
        <div className="lift-card lift-empty">
          {sameDay(day, new Date()) ? (
            <>
              <p>Nothing logged today yet.</p>
              <button className="lift-start" onClick={() => onNavigate("log")}>Log workout</button>
            </>
          ) : (
            <p>Rest day. Nothing logged on {new Date(day).toLocaleDateString(undefined, { weekday: "long" })}. Tap a day with a check to see that workout.</p>
          )}
        </div>
      )}

      {dayWorkouts.map(w => (
        <article key={w.id} className="lift-card lift-wo">
          <div className="lift-wo-top">
            <span className="lift-ic"><Dumbbell /></span>
            <span className="lift-wo-name">
              <b>{w.title}</b>
              <small>{(w.exercises || []).length} exercise{(w.exercises || []).length === 1 ? "" : "s"}{w.duration_min ? ` · ${w.duration_min} min` : ""}</small>
            </span>
            <span className="lift-mini"><BodyMap sets={muscleSets([w])} mode="workout" small /></span>
          </div>
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
              <span className="lift-wo-acts">
                <button className="lift-del" onClick={() => onEdit(w)}>Edit</button>
                <button className="lift-del" onClick={() => setConfirmDelete(w.id)}>Delete</button>
              </span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
