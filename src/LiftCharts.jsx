import { useState } from "react";
import { Sparkline } from "./TrendChart";
import Ring from "./Ring";
import { DAY_MS, groupSetsPerWeek, setsByDay, strengthHistory, weekStart, weeklyTotals } from "./lifting";

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

const RANGE_NAMES = { 91: "3 months", 182: "6 months", 365: "a year" };

// Strength as a ring: the combined estimated max, filling toward the next round hundred.
export function StrengthRing({ stats, days }) {
  const { lifts, sbd, points } = strengthHistory(stats);
  if (!lifts.length || !points.length) return (
    <section className="lift-card lc-empty">
      <h2 className="lift-h2">Strength</h2>
      <p className="lc-note">Log a lift with weight, like squat, bench or deadlift, and your strength shows up here.</p>
    </section>
  );
  const last = points[points.length - 1];
  const cutoff = new Date().getTime() - days * DAY_MS;
  const base = [...points].reverse().find(p => p.t <= cutoff) || points[0];
  const change = last.v - base.v;
  const next = (Math.floor(last.v / 100) + 1) * 100;
  const label = sbd ? "Squat + bench + deadlift" : lifts.map(e => e.name).join(" + ");
  return (
    <section className="lift-card lc-ring">
      <Ring value={last.v} goal={next} size={140} color="#5ab8ff" top={last.v.toLocaleString()} bottom={sbd ? "Big 3 · lb" : "Total · lb"} label={`${label}: ${last.v} pounds estimated max total`} />
      <div className="lc-ring-txt">
        <h2 className="lift-h2">Strength</h2>
        <p className="lift-sub">{sbd ? "Squat, bench and deadlift" : "Your main lifts"}: estimated max total</p>
        {points.length > 1 && (
          <em className={change > 0 ? "up" : change < 0 ? "down" : ""}>
            {change > 0 ? "▲ " : change < 0 ? "▼ " : ""}{change === 0 ? "No change" : `${Math.abs(change).toLocaleString()} lb`}<small> in {base === points[0] ? "total" : RANGE_NAMES[days]}</small>
          </em>
        )}
        <p className="lc-ring-next">{(next - last.v).toLocaleString()} lb to {next.toLocaleString()}</p>
      </div>
    </section>
  );
}

// The headline lifts, each with a trend line over the range and its best estimated max.
export function MainLiftRows({ stats, days, onFocus }) {
  const { lifts } = strengthHistory(stats);
  if (!lifts.length) return null;
  const cutoff = new Date().getTime() - days * DAY_MS;
  return (
    <section className="lift-card lc-rows">
      {lifts.map(e => {
        let inRange = e.sessions.filter(s => new Date(s.date).getTime() >= cutoff);
        if (!inRange.length) inRange = e.sessions.slice(-1);
        const best = Math.max(...e.sessions.map(s => s.value));
        return (
          <button key={e.key} className="lc-row" onClick={() => onFocus(e.key)}>
            <span className="lc-row-name"><b>{e.name}</b><small>est. max</small></span>
            <Sparkline values={inRange.map(s => s.value)} />
            <span className="lc-row-val">{best.toLocaleString()} <small>lb</small></span>
          </button>
        );
      })}
    </section>
  );
}

// Average weekly sets for each muscle group, last 4 weeks.
export function MuscleBalance({ workouts }) {
  const groups = Object.entries(groupSetsPerWeek(workouts, 4));
  const max = Math.max(...groups.map(([, v]) => v));
  if (!max) return (
    <section className="lift-card lc-empty">
      <h2 className="lift-h2">Muscle balance</h2>
      <p className="lc-note">The muscles you've trained in the last 4 weeks show up here.</p>
    </section>
  );
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

const CAL_RANGES = [["2W", 2, "2 weeks"], ["1M", 5, "month"], ["6M", 26, "6 months"], ["1Y", 52, "year"]];
const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

// Calendar of training days: white if you logged a workout that day, blank if not.
// Short ranges read like a calendar (a row per week); long ones are a column per week.
export function Consistency({ workouts }) {
  const [range, setRange] = useState("1M");
  const [, weeks, rangeName] = CAL_RANGES.find(r => r[0] === range);
  const byDay = setsByDay(workouts);
  const first = new Date(weekStart(new Date()).getTime() - (weeks - 1) * 7 * DAY_MS);
  const today = new Date().setHours(0, 0, 0, 0);
  const grid = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, r) => {
      const d = new Date(first);
      d.setDate(first.getDate() + w * 7 + r);
      return { d, on: (byDay[d.toDateString()] || 0) > 0, future: d.getTime() > today, today: d.getTime() === today };
    }));
  const days = grid.flat().filter(c => c.on).length;
  const activeWeeks = grid.filter(wk => wk.some(c => c.on)).length;
  const short = weeks <= 5;
  const cls = c => `${c.on ? "on" : ""}${c.future ? " fut" : ""}${c.today ? " now" : ""}`;
  const tip = c => `${shortDate(c.d)}${c.on ? ", trained" : ""}`;
  // Month names over the first week of each month, skipped when too close to the last one to fit.
  let lastLabel = -9;
  const monthLabels = grid.map((col, w) => {
    if (w > 0 && col[0].d.getMonth() === grid[w - 1][0].d.getMonth()) return "";
    if (w - lastLabel < (weeks > 30 ? 8 : 3)) return "";
    lastLabel = w;
    return col[0].d.toLocaleDateString(undefined, { month: "short" });
  });

  return (
    <section className="lift-card lc-cal" data-shot="consistency">
      <div className="lift-row">
        <h2 className="lift-h2">Consistency</h2>
        <div className="lift-toggle" role="group" aria-label="Time range">
          {CAL_RANGES.map(([r]) => (
            <button key={r} className={range === r ? "on" : ""} aria-pressed={range === r} onClick={() => setRange(r)}>{r}</button>
          ))}
        </div>
      </div>
      <p className="lc-cal-sum"><b>{days}</b> day{days === 1 ? "" : "s"} trained in the last {rangeName}</p>
      {short ? (
        <div className="lc-month" role="img" aria-label={`Trained ${days} days in the last ${rangeName}`}>
          {DAY_LETTERS.map((l, i) => <span key={i} className="lc-dl">{l}</span>)}
          {grid.flat().map(c => <i key={c.d.toDateString()} className={cls(c)} title={tip(c)}>{c.d.getDate()}</i>)}
        </div>
      ) : (
        <div className="lc-grid" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`, gap: weeks > 30 ? 1 : 2 }} role="img" aria-label={`Trained ${days} days and ${activeWeeks} of the last ${weeks} weeks`}>
          {grid.map((col, w) => (
            <div key={w} className="lc-gcol">
              <span className="lc-m">{monthLabels[w]}</span>
              {col.map(c => <i key={c.d.toDateString()} className={cls(c)} title={tip(c)} />)}
            </div>
          ))}
        </div>
      )}
      <p className="lc-cal-foot">Trained {activeWeeks} of {weeks} weeks</p>
    </section>
  );
}
