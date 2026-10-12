import { useState } from "react";
import { Sparkline } from "./TrendChart";
import { DAY_MS, groupSetsPerWeek, mainLifts, setsByDay, weekStart, weeklyTotals } from "./lifting";

const bigNumber = n => (n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : Math.round(n).toLocaleString());
const shortDate = d => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const METRICS = [
  ["volume", "Volume", v => `${bigNumber(v)} lb`],
  ["sets", "Sets", v => `${Math.round(v)} sets`],
  ["workouts", "Workouts", v => `${Math.round(v * 10) / 10} workout${v === 1 ? "" : "s"}`],
];

// Bars for the last 12 weeks, with the 12-week average as a dashed line.
export function TrainingWeeks({ workouts }) {
  const [metric, setMetric] = useState("volume");
  const weeks = weeklyTotals(workouts, 12);
  // Early in the week, open on last week so the card doesn't lead with a zero.
  const [sel, setSel] = useState(weeks.length - (weeks[weeks.length - 1].workouts ? 1 : 2));
  const [, , fmt] = METRICS.find(m => m[0] === metric);
  const vals = weeks.map(w => w[metric]);
  // This week is still going, so it stays out of the average.
  const past = vals.slice(0, -1);
  const avg = past.reduce((a, v) => a + v, 0) / (past.length || 1);
  const max = Math.max(...vals, avg) || 1;
  const s = weeks[sel];
  const isNow = sel === weeks.length - 1;

  return (
    <section className="lift-card lc-weeks" data-shot="training-weeks">
      <div className="lift-row">
        <h2 className="lift-h2">Training</h2>
        <div className="lift-toggle" role="group" aria-label="Measure">
          {METRICS.map(([id, label]) => (
            <button key={id} className={metric === id ? "on" : ""} aria-pressed={metric === id} onClick={() => setMetric(id)}>{label}</button>
          ))}
        </div>
      </div>
      <div className="lc-read">
        <div>
          <small>{isNow ? "This week" : `Week of ${shortDate(s.start)}`}</small>
          <b>{fmt(s[metric])}</b>
        </div>
        <div className="lc-avg">
          <small>12-week average</small>
          <b>{fmt(avg)}</b>
        </div>
      </div>
      <div className="lc-bars" role="group" aria-label={`Weekly ${metric}, last 12 weeks`}>
        <em className="lc-avgline" style={{ bottom: `${(avg / max) * 100}%` }} aria-hidden="true" />
        {weeks.map((w, i) => {
          const label = i === 0 || w.start.getMonth() !== weeks[i - 1].start.getMonth() ? w.start.toLocaleDateString(undefined, { month: "short" }) : "";
          return (
            <button key={i} className={`lc-col${i === sel ? " on" : ""}${i === weeks.length - 1 ? " now" : ""}`} onClick={() => setSel(i)}
              aria-label={`Week of ${shortDate(w.start)}: ${fmt(w[metric])}`} aria-pressed={i === sel}>
              <span className="lc-bar"><i style={{ height: `${Math.max(w[metric] ? 3 : 0, (w[metric] / max) * 100)}%` }} /></span>
              <span className="lc-l">{label}</span>
            </button>
          );
        })}
      </div>
      <p className="lc-note">Volume is weight × reps added up. Tap a week to see it.</p>
    </section>
  );
}

// The headline lifts: estimated max now, and how it moved over 3 months.
export function MainLifts({ stats, onFocus }) {
  const lifts = mainLifts(stats);
  if (!lifts.length) return null;
  const cutoff = new Date().getTime() - 91 * DAY_MS;
  const rows = lifts.map(e => {
    const recent = e.sessions.filter(s => new Date(s.date).getTime() >= cutoff);
    const before = e.sessions.filter(s => new Date(s.date).getTime() < cutoff).pop();
    const now = recent.length ? Math.max(...recent.map(s => s.value)) : e.last.value;
    const from = before || recent[0];
    return { e, now, change: from && from !== e.last ? now - from.value : null, spark: (recent.length > 1 ? recent : e.sessions.slice(-8)).map(s => s.value) };
  });
  const sbd = ["back squat", "bench press", "deadlift"].map(k => rows.find(r => r.e.key === k));
  const total = sbd.every(Boolean) ? sbd.reduce((a, r) => a + r.now, 0) : null;

  return (
    <section className="lift-card lc-main" data-shot="main-lifts">
      <div className="lift-row">
        <h2 className="lift-h2">Strength</h2>
        <span className="lift-sub">Est. max · 3 months</span>
      </div>
      {total != null && (
        <div className="lc-total">
          <small>Squat + bench + deadlift</small>
          <b>{total.toLocaleString()}<span> lb</span></b>
        </div>
      )}
      {rows.map(({ e, now, change, spark }) => (
        <button key={e.key} className="lp-row" onClick={() => onFocus(e.key)}>
          <span className="lp-row-name"><b>{e.name}</b><small>{e.sessions.length} sessions</small></span>
          <Sparkline values={spark} />
          <span className="lp-row-val">
            <b>{now.toLocaleString()} lb</b>
            {change != null && <small className={change > 0 ? "up" : change < 0 ? "down" : ""}>{change > 0 ? "▲ " : change < 0 ? "▼ " : ""}{change === 0 ? "No change" : `${Math.abs(change)} lb`}</small>}
          </span>
        </button>
      ))}
    </section>
  );
}

// Average weekly sets for each muscle group, last 4 weeks.
export function MuscleBalance({ workouts }) {
  const groups = Object.entries(groupSetsPerWeek(workouts, 4));
  const max = Math.max(...groups.map(([, v]) => v));
  if (!max) return null;
  const low = groups.reduce((a, g) => (g[1] < a[1] ? g : a), groups[0]);
  const fmt = v => `${Number.isInteger(v) ? v : v.toFixed(1)}`;
  const scale = v => `${(v / Math.max(max, 24)) * 100}%`;

  return (
    <section className="lift-card lc-mb" data-shot="muscle-balance">
      <div className="lift-row">
        <h2 className="lift-h2">Muscle balance</h2>
        <span className="lift-sub">Sets a week</span>
      </div>
      <div className="lc-mb-list">
        {groups.map(([g, v]) => (
          <div key={g} className={`lc-mb-row${g === low[0] ? " low" : ""}`}>
            <span className="lc-mb-name">{g}</span>
            <span className="lc-mb-track">
              <span className="lc-mb-band" style={{ left: scale(10), width: scale(10) }} />
              <i style={{ width: scale(v) }} />
            </span>
            <b>{fmt(v)}</b>
          </div>
        ))}
      </div>
      <p className="lc-note">
        {low[1] < 10 ? <><strong>{low[0]}</strong> gets the least work. </> : null}
        Average of the last 4 weeks. The shaded band is 10 to 20 sets a week, a common target for growth.
      </p>
    </section>
  );
}

// Calendar of training days, last 18 weeks, Monday at the top.
export function Consistency({ workouts }) {
  const WEEKS = 18;
  const byDay = setsByDay(workouts);
  const first = new Date(weekStart(new Date()).getTime() - (WEEKS - 1) * 7 * DAY_MS);
  const today = new Date().setHours(0, 0, 0, 0);
  const cols = Array.from({ length: WEEKS }, (_, c) =>
    Array.from({ length: 7 }, (_, r) => {
      const d = new Date(first);
      d.setDate(first.getDate() + c * 7 + r);
      const n = byDay[d.toDateString()] || 0;
      return { d, n, future: d.getTime() > today, level: n === 0 ? 0 : n < 12 ? 1 : n < 20 ? 2 : 3 };
    }));
  const days = cols.flat().filter(c => c.n > 0).length;
  const activeWeeks = cols.filter(col => col.some(c => c.n > 0)).length;

  return (
    <section className="lift-card lc-cal" data-shot="consistency">
      <div className="lift-row">
        <h2 className="lift-h2">Consistency</h2>
        <span className="lift-sub">{days} days in {WEEKS} weeks</span>
      </div>
      <div className="lc-grid" role="img" aria-label={`Trained ${days} days and ${activeWeeks} of the last ${WEEKS} weeks`}>
        {cols.map((col, c) => (
          <div key={c} className="lc-gcol">
            <span className="lc-m">{c === 0 || col[0].d.getMonth() !== cols[c - 1][0].d.getMonth() ? col[0].d.toLocaleDateString(undefined, { month: "short" }) : ""}</span>
            {col.map((cell, r) => <i key={r} className={`l${cell.level}${cell.future ? " fut" : ""}`} title={cell.n ? `${shortDate(cell.d)}: ${cell.n} sets` : undefined} />)}
          </div>
        ))}
      </div>
      <div className="lift-row lc-cal-foot">
        <span>Trained {activeWeeks} of {WEEKS} weeks</span>
        <span className="lc-key">Fewer sets<i className="l1" /><i className="l2" /><i className="l3" />More</span>
      </div>
    </section>
  );
}
