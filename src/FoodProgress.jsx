import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { Gauge, Pie, RangeBars, WeekBars } from "./FoodCharts";
import { DAY_MS, dayKey, foodsError, logStreak, readGoals, startOfDay, weekStart } from "./food";

const LETTERS = ["M", "Tu", "W", "Th", "F", "Sa", "Su"];
const RANGES = [["1W", 7], ["1M", 30], ["3M", 91]];
const MACROS = [["protein", "Protein", "p", 4], ["carbs", "Carbs", "c", 4], ["fat", "Fat", "f", 9]];

const fmt = n => Math.round(n).toLocaleString();

function MacroCard({ title, k, tone, goal, week, today, todayIdx }) {
  const left = goal - today[k];
  const prior = week.slice(0, todayIdx).filter(d => d.logged);
  const avg = prior.length ? prior.reduce((a, d) => a + d[k], 0) / prior.length : null;
  return (
    <section className="lift-card fp-card">
      <h2 className="fp-h">{title}</h2>
      <div className="fp-mid">
        <Gauge value={today[k]} goal={goal} size={124} stroke={12} tone={tone} top={fmt(Math.abs(left))} bottom={left >= 0 ? "Under" : "Over"} />
        <WeekBars goal={goal} tone={tone} days={week.map((d, i) => ({ label: LETTERS[i], value: d[k], today: i === todayIdx }))} />
      </div>
      <div className="fp-foot">
        <span><b>{fmt(today[k])}</b> of {fmt(goal)}g</span>
        <span>{avg == null ? "No days logged before today" : <><b>{fmt(avg)}g</b> avg prior to today</>}</span>
      </div>
    </section>
  );
}

export default function FoodProgress({ user }) {
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [range, setRange] = useState(30);
  const goals = readGoals();

  useEffect(() => {
    supabase
      .from("food_logs")
      .select("eaten_at, kcal, protein_g, carbs_g, fat_g")
      .eq("user_id", user.id)
      .gte("eaten_at", new Date(startOfDay(new Date()).getTime() - 91 * DAY_MS).toISOString())
      .order("eaten_at", { ascending: true })
      .limit(5000)
      .then(({ data, error }) => {
        if (error) setLoadError(foodsError(error));
        setRows(data || []);
      });
  }, [user]);

  if (rows === null) return <div className="coming-soon">Loading...</div>;

  const byDay = new Map();
  for (const r of rows) {
    const k = dayKey(r.eaten_at);
    const d = byDay.get(k) || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    d.kcal += Number(r.kcal) || 0;
    d.protein += Number(r.protein_g) || 0;
    d.carbs += Number(r.carbs_g) || 0;
    d.fat += Number(r.fat_g) || 0;
    byDay.set(k, d);
  }
  const dayData = date => {
    const d = byDay.get(date.toDateString());
    return { date, logged: !!d, ...(d || { kcal: 0, protein: 0, carbs: 0, fat: 0 }) };
  };

  const today0 = startOfDay(new Date());
  const ws = weekStart(today0);
  const week = Array.from({ length: 7 }, (_, i) => dayData(new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + i)));
  const todayIdx = (today0.getDay() + 6) % 7;
  const today = week[todayIdx];

  const kcalLeft = goals.kcal - today.kcal;
  const priorLogged = week.slice(0, todayIdx).filter(d => d.logged);
  const priorDiff = priorLogged.reduce((a, d) => a + (goals.kcal - d.kcal), 0);

  const split = d => {
    const parts = MACROS.map(([k, , tone, cal]) => ({ tone, kcal: d[k] * cal }));
    const total = parts.reduce((a, p) => a + p.kcal, 0);
    return parts.map(p => ({ tone: p.tone, frac: total ? p.kcal / total : 0 }));
  };
  const todaySplit = split(today);
  const weekLogged = week.filter(d => d.logged);
  const weekSplit = split(weekLogged.reduce((a, d) => ({ protein: a.protein + d.protein, carbs: a.carbs + d.carbs, fat: a.fat + d.fat }), { protein: 0, carbs: 0, fat: 0 }));

  const dates = rows.map(r => r.eaten_at);
  const streak = logStreak(dates);
  const last7 = Array.from({ length: 7 }, (_, i) => dayData(new Date(today0.getFullYear(), today0.getMonth(), today0.getDate() - 6 + i)));

  const points = Array.from({ length: range }, (_, i) => {
    const d = new Date(today0.getFullYear(), today0.getMonth(), today0.getDate() - range + 1 + i);
    return { t: d.getTime(), v: dayData(d).kcal };
  });
  const loggedPts = points.filter(p => p.v > 0);
  const rangeAvg = loggedPts.length ? loggedPts.reduce((a, p) => a + p.v, 0) / loggedPts.length : 0;
  const avg7 = last7.filter(d => d.logged);
  const avg7kcal = avg7.length ? avg7.reduce((a, d) => a + d.kcal, 0) / avg7.length : 0;

  return (
    <div className="lift fp">
      <header className="lift-head">
        <div>
          <p className="lift-date">Food</p>
          <h1 className="lift-title">Dashboard</h1>
        </div>
      </header>

      {loadError && (
        <div className="lift-card lift-setup">
          <strong>{loadError.title}</strong>
          <p>{loadError.detail}</p>
        </div>
      )}

      <section className="lift-card fp-card">
        <h2 className="fp-h">Calories</h2>
        <div className="fp-mid">
          <Gauge value={today.kcal} goal={goals.kcal} size={124} stroke={12} top={fmt(Math.abs(kcalLeft))} bottom={kcalLeft >= 0 ? "Under" : "Over"} />
          <WeekBars goal={goals.kcal} days={week.map((d, i) => ({ label: LETTERS[i], value: d.kcal, today: i === todayIdx }))} />
        </div>
        <div className="fp-foot">
          <span><b>{fmt(today.kcal)}</b> cals</span>
          <span>{priorLogged.length ? <><b>{fmt(Math.abs(priorDiff))}</b> {priorDiff >= 0 ? "under" : "over"} prior to today</> : "No days logged before today"}</span>
        </div>
      </section>

      <section className="lift-card fp-card">
        <h2 className="fp-h">Macronutrients</h2>
        <div className="fp-mid">
          <div className="fp-pie">
            <Pie parts={todaySplit} size={92} />
            <div className="fp-legend">
              {MACROS.slice().reverse().map(([k, name, tone]) => (
                <span key={k}><i className={`fd-dot ${tone}`} />{name}<b>{Math.round((todaySplit.find(p => p.tone === tone).frac) * 100)}%</b></span>
              ))}
            </div>
          </div>
          <div className="fp-stack">
            <WeekBars goal={0} days={week.map((d, i) => ({ label: LETTERS[i], value: d.kcal, today: i === todayIdx, parts: split(d) }))} />
            <div className="fp-avg">
              <span>AVG</span>
              {weekSplit.slice().reverse().map(p => <em key={p.tone} className={`ft-chip-${p.tone}`}>{Math.round(p.frac * 100)}%</em>)}
            </div>
          </div>
        </div>
      </section>

      <div className="fp-pair">
        <section className="lift-card fp-card fp-small">
          <h2 className="fp-h">Streak</h2>
          <div className="fp-dots">
            {last7.map((d, i) => <i key={i} className={`${d.logged ? "on" : ""}${i === 6 ? " now" : ""}`} />)}
          </div>
          <p className="fp-big"><b>{streak}</b><span>{streak === 1 ? "Day" : "Days"}</span></p>
        </section>
        <section className="lift-card fp-card fp-small">
          <h2 className="fp-h">Average</h2>
          <p className="fp-big fp-big-top"><b>{fmt(avg7kcal)}</b><span>cals a day</span></p>
          <p className="fp-small-note">{avg7.length ? `Over ${avg7.length} logged day${avg7.length === 1 ? "" : "s"} this past week` : "Log a day to see your average"}</p>
        </section>
      </div>

      {MACROS.map(([k, name, tone]) => (
        <MacroCard key={k} title={k === "carbs" ? "Carbohydrates" : name} k={k} tone={tone} goal={goals[k]} week={week} today={today} todayIdx={todayIdx} />
      ))}

      <div className="fp-ranges" role="group" aria-label="Range">
        {RANGES.map(([label, n]) => (
          <button key={label} className={range === n ? "on" : ""} aria-pressed={range === n} onClick={() => setRange(n)}>{label}</button>
        ))}
      </div>
      <section className="lift-card fp-card">
        <div className="lift-row">
          <h2 className="fp-h">Calories</h2>
          <span className="fp-davg"><b>{fmt(rangeAvg)}</b> daily avg</span>
        </div>
        <RangeBars points={points} goal={goals.kcal} />
        <div className="fp-today">
          <small>TODAY</small>
          <b>{fmt(today.kcal)}</b>
          <span>{kcalLeft >= 0 ? `${fmt(kcalLeft)} under` : `${fmt(-kcalLeft)} over`}</span>
        </div>
      </section>
      <p className="lp-foot">Free history covers the last 3 months.</p>
    </div>
  );
}
