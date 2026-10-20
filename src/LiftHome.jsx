import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import BodyMap from "./BodyMap";
import { syncReminderInfo } from "./notify";
import Ring from "./Ring";
import { readGoals as readFoodGoals } from "./food";
import { GROUPS, MUSCLE_NAMES, findExercise, groupOf, muscleSets, prFlags, setSummary, totalSets, totalVolume, weekStart, weekStreak, workoutsError } from "./lifting";

const DAY_NAMES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY = 86400000;
// The muscle groups shown across the "Muscles" card, with their short labels.
const GROUP_COLS = [["Chest", "Chest"], ["Back", "Back"], ["Legs", "Legs"], ["Shoulders", "Delts"], ["Arms", "Arms"], ["Core", "Core"]];
const GROUP_TARGET = 10;

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
// "Today, 20 Oct" in the header; other days by weekday.
function headDate(d) {
  const dm = new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const days = Math.round((midnight(new Date()) - midnight(d)) / DAY);
  if (days === 0) return `Today, ${dm}`;
  if (days === 1) return `Yesterday, ${dm}`;
  return `${new Date(d).toLocaleDateString(undefined, { weekday: "short" })}, ${dm}`;
}

const Chevron = ({ left }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={left ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} /></svg>
);
const Up = () => <svg className="lh-mark" viewBox="0 0 12 10" aria-hidden="true"><path d="M6 0l6 10H0z" /></svg>;
const MAX_WEEKS_BACK = 52;

// Sets per muscle group, counted for the group of each exercise's main muscle.
function groupSets(workouts) {
  const out = Object.fromEntries(Object.keys(GROUPS).map(g => [g, 0]));
  for (const w of workouts) {
    for (const ex of w.exercises || []) {
      const info = findExercise(ex.name);
      const g = info && groupOf(info);
      if (g) out[g] += (ex.sets || []).length;
    }
  }
  return out;
}

// One bar per set, as tall as its weight × reps (reps alone for bodyweight sets).
function SetBars({ workout }) {
  const bars = (workout.exercises || []).flatMap((ex, i) => (ex.sets || []).map(s => ({ v: (Number(s.weight) || 0) > 0 ? s.weight * s.reps : Number(s.reps) || 0, i })));
  const max = Math.max(1, ...bars.map(b => b.v));
  return (
    <span className="lh-bars" aria-hidden="true">
      {bars.map((b, k) => <i key={k} style={{ height: `${Math.max(8, (b.v / max) * 100)}%`, opacity: [1, 0.72, 0.5][b.i % 3] }} />)}
    </span>
  );
}

export default function LiftHome({ user, onNavigate, onEdit, onOpenExercise }) {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [goal, setGoal] = useState(readGoal);
  // The day whose workouts are listed; the week strip shows that day's week.
  const [day, setDay] = useState(() => midnight(new Date()));
  const [showMap, setShowMap] = useState(false);
  const [mapDay, setMapDay] = useState(false);
  const [muscle, setMuscle] = useState(null);
  const [climbs, setClimbs] = useState([]);
  const [food, setFood] = useState({ kcal: 0, protein: 0 });
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

  // Climbs and food for the small rings. Either may be missing; the ring then shows 0.
  useEffect(() => {
    const twoWeeks = addDays(weekStart(new Date()), -7).toISOString();
    supabase.from("climbs").select("created_at").eq("user_id", user.id).gte("created_at", twoWeeks)
      .then(({ data }) => setClimbs(data || []), () => {});
    supabase.from("food_logs").select("kcal, protein_g").eq("user_id", user.id).gte("eaten_at", midnight(new Date()).toISOString())
      .then(({ data }) => setFood({
        kcal: (data || []).reduce((a, r) => a + (Number(r.kcal) || 0), 0),
        protein: (data || []).reduce((a, r) => a + (Number(r.protein_g) || 0), 0),
      }), () => {});
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

  const today = midnight(new Date());
  const thisWeek = weekStart(today);
  const start = weekStart(day);
  const end = addDays(start, 7);
  const weekBack = Math.round((thisWeek - start) / (7 * DAY));
  const between = (t, a, b) => { const x = new Date(t); return x >= a && x < b; };
  const inWeek = workouts.filter(w => between(w.performed_at, start, end));
  const prevWeek = workouts.filter(w => between(w.performed_at, addDays(start, -7), start));
  const streak = weekStreak(workouts, goal);
  const prs = prFlags(workouts);
  const dayWorkouts = workouts.filter(w => sameDay(w.performed_at, day));
  const showDay = mapDay && dayWorkouts.length > 0;
  const mode = showDay ? "workout" : "week";
  const sets = muscleSets(showDay ? dayWorkouts : inWeek);
  const ranked = Object.entries(sets).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const weekSets = inWeek.reduce((a, w) => a + totalSets(w), 0);
  const prevSets = prevWeek.reduce((a, w) => a + totalSets(w), 0);
  const groups = groupSets(inWeek);
  const groupsHit = GROUP_COLS.filter(([g]) => groups[g] >= GROUP_TARGET).length;
  const climbsNow = climbs.filter(c => between(c.created_at, thisWeek, addDays(thisWeek, 7))).length;
  const climbsPrev = climbs.filter(c => between(c.created_at, addDays(thisWeek, -7), thisWeek)).length;
  const foodGoals = readFoodGoals();
  const pct = (v, g) => (g > 0 ? Math.round((v / g) * 100) : 0);
  const weekName = weekBack === 0 ? "this week" : weekBack === 1 ? "last week" : `${shortDate(start)} – ${shortDate(addDays(start, 6))}`;

  if (loading) return <div className="coming-soon">Loading...</div>;

  const days = DAY_NAMES.map((name, i) => {
    const date = addDays(start, i);
    const done = workouts.some(x => sameDay(x.performed_at, date));
    return { name, date, done, today: sameDay(date, today), future: date > today };
  });

  function pickDay(d) {
    const x = midnight(d);
    if (x > today || x < addDays(thisWeek, -7 * MAX_WEEKS_BACK)) return;
    setDay(x);
    setMapDay(workouts.some(w => sameDay(w.performed_at, x)));
    setMuscle(null);
  }
  // A swipe on the strip moves a week, keeping the weekday (today, at most).
  const moveWeek = delta => pickDay(addDays(day, 7 * delta) > today ? today : addDays(day, 7 * delta));
  const onTouchStart = e => { swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = e => {
    if (!swipe.current) return;
    const dx = e.changedTouches[0].clientX - swipe.current.x;
    const dy = e.changedTouches[0].clientY - swipe.current.y;
    swipe.current = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) moveWeek(dx > 0 ? -1 : 1);
  };

  return (
    <div className="lift">
      <header className="lh-head">
        <div className="lh-date">
          <button aria-label="Previous day" onClick={() => pickDay(addDays(day, -1))}><Chevron left /></button>
          <h1>{headDate(day)}</h1>
          <button aria-label="Next day" disabled={sameDay(day, today)} onClick={() => pickDay(addDays(day, 1))}><Chevron /></button>
        </div>
        <span className="lh-word">SENDIT</span>
      </header>

      {loadError && (
        <div className="lift-card lift-setup">
          <strong>{loadError.title}</strong>
          <p>{loadError.detail}</p>
        </div>
      )}

      <div className="lh-strip" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {days.map(d => (
          <button
            key={d.date.toDateString()}
            className={`lh-pill${d.done ? " done" : ""}${sameDay(d.date, day) ? " sel" : ""}`}
            disabled={d.future}
            aria-pressed={sameDay(d.date, day)}
            aria-label={`${d.date.toDateString()}${d.done ? ", workout logged" : ""}`}
            onClick={() => pickDay(d.date)}
          >
            <span>{d.today ? "TODAY" : d.name}</span>
            <i />
          </button>
        ))}
      </div>

      <section className="lh-rings">
        <Ring
          value={inWeek.length} goal={goal} size={160} color="var(--sky)"
          top={<>{inWeek.length}<span className="ring-of">/{goal}</span></>} bottom="Workouts"
          note={weekBack === 0 ? `${streak} week streak` : weekName}
          label={`${inWeek.length} of ${goal} workouts ${weekName}`}
        />
        <div className="lh-minis">
          <Ring className="ring-sm" size={80} stroke={4} color="#5ab8ff" value={weekSets} goal={Math.max(prevSets, weekSets, 1)} top={weekSets} bottom="Sets" label={`${weekSets} sets ${weekName}, ${prevSets} the week before`} />
          <Ring className="ring-sm" size={80} stroke={4} color="#b48cff" value={climbsNow} goal={Math.max(climbsPrev, climbsNow, 1)} top={climbsNow} bottom="Climbs" label={`${climbsNow} climbs this week, ${climbsPrev} last week`} />
          <Ring className="ring-sm" size={80} stroke={4} color="#ff9a4d" value={food.kcal} goal={foodGoals.kcal} top={<>{pct(food.kcal, foodGoals.kcal)}<span className="ring-of">%</span></>} bottom="Calories" label={`${pct(food.kcal, foodGoals.kcal)} percent of today's calorie goal`} />
          <Ring className="ring-sm" size={80} stroke={4} color="#5ef0d8" value={food.protein} goal={foodGoals.protein} top={<>{pct(food.protein, foodGoals.protein)}<span className="ring-of">%</span></>} bottom="Protein" label={`${pct(food.protein, foodGoals.protein)} percent of today's protein goal`} />
        </div>
      </section>

      <div className="lh-goal">
        <span className="lift-goal">
          Weekly goal
          <span className="lift-stepper">
            <button aria-label="Lower weekly goal" onClick={() => changeGoal(goal - 1)}>−</button>
            <b>{goal}</b>
            <button aria-label="Raise weekly goal" onClick={() => changeGoal(goal + 1)}>+</button>
          </span>
        </span>
      </div>

      <section className="lift-card lh-muscles">
        <div className="lift-row">
          <div>
            <h2 className="lift-h2">{weekBack < 2 ? `Muscles ${weekName}` : `Muscles, ${weekName}`}</h2>
            <p className="lift-sub">{groupsHit} of {GROUP_COLS.length} groups at {GROUP_TARGET}+ sets · {weekSets} sets</p>
          </div>
          <button className="lh-map-btn" aria-expanded={showMap} onClick={() => setShowMap(v => !v)}>{showMap ? "Hide map" : "Body map"}</button>
        </div>
        <div className="lh-groups">
          {GROUP_COLS.map(([g, short]) => (
            <div key={g} className={groups[g] >= GROUP_TARGET ? "hit" : ""} aria-label={`${g}: ${groups[g]} sets`}>
              <b>{groups[g]}</b>
              <span>{short}</span>
              {groups[g] >= GROUP_TARGET ? <Up /> : <i />}
            </div>
          ))}
        </div>
        {showMap && (
          <div className="lh-map">
            <div className="lift-toggle">
              <button className={!showDay ? "on" : ""} onClick={() => setMapDay(false)}>Week</button>
              <button className={showDay ? "on" : ""} disabled={!dayWorkouts.length} onClick={() => setMapDay(true)}>Day</button>
            </div>
            <BodyMap sets={sets} mode={mode} selected={muscle} onSelect={m => setMuscle(m === muscle ? null : m)} />
            <p className="lift-tip">
              {muscle ? (
                <>{MUSCLE_NAMES[muscle]} <span>· {sets[muscle] || 0} sets {showDay ? dayPhrase(day) : weekName}</span></>
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
          </div>
        )}
      </section>

      {!sameDay(day, today) && (
        <div className="lift-row lift-list-head">
          <h2 className="lift-h2">{dayLabel(day)}</h2>
          <button className="lift-today" onClick={() => pickDay(today)}>Back to today</button>
        </div>
      )}

      {workouts.length === 0 && !loadError && (
        <div className="lift-card lift-empty">
          <p>No workouts yet. Log your first one and the rings and muscles fill up with what you trained.</p>
          <button className="lift-start" onClick={() => onNavigate("log")}>Log workout</button>
        </div>
      )}

      {workouts.length > 0 && dayWorkouts.length === 0 && (
        <div className="lift-card lift-empty">
          {sameDay(day, today) ? (
            <>
              <p>Nothing logged today yet.</p>
              <button className="lift-start" onClick={() => onNavigate("log")}>Log workout</button>
            </>
          ) : (
            <p>Rest day. Nothing logged on {new Date(day).toLocaleDateString(undefined, { weekday: "long" })}. Tap a day with a dot to see that workout.</p>
          )}
        </div>
      )}

      {dayWorkouts.map(w => (
        <article key={w.id} className="lift-card lh-wo">
          <div className="lh-wo-top">
            <h3>{w.title}{w.duration_min ? <small> · {w.duration_min} min</small> : null}</h3>
          </div>
          <div className="lh-wo-mid">
            <span className="lh-wo-sets"><b>{totalSets(w)}</b> sets</span>
            <SetBars workout={w} />
          </div>
          <div className="lh-ex">
            {(w.exercises || []).map((ex, i) => (
              <button key={i} onClick={() => onOpenExercise(ex.name.trim().toLowerCase())}>
                <span>{ex.name}{prs[`${w.id}:${i}`] && <span className="lift-pr">PR</span>}</span>
                <span>{setSummary(ex.sets)}</span>
              </button>
            ))}
          </div>
          <div className="lift-tot">
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
