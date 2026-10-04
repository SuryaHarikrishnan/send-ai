import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import TrendChart, { Sparkline } from "./TrendChart";
import { DAY_MS, MUSCLE_NAMES, exerciseStats, totalVolume } from "./lifting";
import "./Lift.css";

const RANGES = [["3M", 91], ["6M", 182], ["1Y", 365], ["All", Infinity]];

const shortDate = d => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
function ago(d) {
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / DAY_MS);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return shortDate(d);
}
const reps = n => `${n} rep${n === 1 ? "" : "s"}`;
const setText = s => (s.weight > 0 ? `${s.weight} lb × ${s.reps}` : reps(s.reps));
const valueText = (ex, v) => (ex.weighted ? `${v.toLocaleString()} lb` : reps(v));
const bigNumber = n => (n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : Math.round(n).toLocaleString());

const Back = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
);
const Trophy = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4" /></svg>
);

export default function LiftProgress({ user, focus, onFocus, onNavigate }) {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    supabase
      .from("workouts")
      .select("id, title, performed_at, exercises")
      .eq("user_id", user.id)
      .order("performed_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) setFailed(true);
        setWorkouts(data || []);
        setLoading(false);
      });
  }, [user]);

  const stats = useMemo(() => exerciseStats(workouts), [workouts]);

  useEffect(() => { window.scrollTo(0, 0); }, [focus]);

  if (loading) return <div className="coming-soon">Loading...</div>;

  const ex = focus && stats[focus];
  if (ex) return <ExerciseDetail ex={ex} onBack={() => onFocus(null)} />;

  const list = Object.values(stats)
    .filter(e => !query.trim() || e.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => new Date(b.last.date) - new Date(a.last.date));
  const monthAgo = new Date().getTime() - 30 * DAY_MS;
  const recentPrs = Object.values(stats)
    .flatMap(e => e.prs.map(p => ({ ex: e, p })))
    .sort((a, b) => new Date(b.p.date) - new Date(a.p.date));
  const prsThisMonth = recentPrs.filter(r => new Date(r.p.date).getTime() >= monthAgo).length;
  const liftedThisMonth = workouts.filter(w => new Date(w.performed_at).getTime() >= monthAgo).reduce((a, w) => a + totalVolume(w), 0);

  return (
    <div className="lift">
      <header className="lift-head">
        <div>
          <p className="lift-date">Progress</p>
          <h1 className="lift-title">Your lifts</h1>
        </div>
      </header>

      {failed && (
        <div className="lift-card lift-setup">
          <strong>Workouts aren't switched on yet.</strong>
          <p>Run <code>supabase/workouts.sql</code> once in the Supabase SQL Editor, then reload.</p>
        </div>
      )}

      {!failed && workouts.length === 0 ? (
        <div className="lift-card lift-empty">
          <p>Your progress shows up here once you've logged a workout: a chart for every lift, your best sets and every PR.</p>
          <button className="lift-start" onClick={() => onNavigate("log")}>Log workout</button>
        </div>
      ) : (
        <>
          <section className="lp-tiles">
            <div className="lift-card lp-tile"><b>{workouts.length}</b><span>Workouts logged</span></div>
            <div className="lift-card lp-tile"><b>{prsThisMonth}</b><span>PRs in 30 days</span></div>
            <div className="lift-card lp-tile"><b>{bigNumber(liftedThisMonth)}</b><span>lb lifted in 30 days</span></div>
          </section>

          {recentPrs.length > 0 && (
            <section className="lift-card lp-prs">
              <h2 className="lift-h2">Recent PRs</h2>
              {recentPrs.slice(0, 5).map(({ ex: e, p }) => (
                <button key={e.key + p.date} className="lp-pr-row" onClick={() => onFocus(e.key)}>
                  <span className="lp-pr-ic"><Trophy /></span>
                  <span className="lp-pr-name"><b>{e.name}</b><small>{e.weighted ? `Best set ${setText(p.bestSet)}` : `${reps(p.maxReps)} in a set`}</small></span>
                  <span className="lp-pr-val"><b>{valueText(e, p.value)}</b><small>{ago(p.date)}</small></span>
                </button>
              ))}
            </section>
          )}

          <div className="lift-row lift-list-head">
            <h2 className="lift-h2">All lifts</h2>
            <span className="lift-sub">{Object.keys(stats).length} exercises</span>
          </div>
          {Object.keys(stats).length > 6 && (
            <input className="lp-search" type="search" placeholder="Search your lifts" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search your lifts" />
          )}
          <div className="lift-card lp-list">
            {list.map(e => (
              <button key={e.key} className="lp-row" onClick={() => onFocus(e.key)}>
                <span className="lp-row-name">
                  <b>{e.name}</b>
                  <small>{ago(e.last.date)} · {setText(e.last.bestSet)}</small>
                </span>
                <Sparkline values={e.sessions.slice(-12).map(s => s.value)} />
                <span className="lp-row-val">
                  <b>{valueText(e, e.best.value.value)}</b>
                  <small>{e.weighted ? "best est. max" : "best set"}</small>
                </span>
              </button>
            ))}
            {!list.length && <p className="lift-sub lp-none">No lifts match "{query}".</p>}
          </div>
          <p className="lp-foot">Estimated max is what you could lift once, worked out from your best set (Epley formula, sets of 12 reps or fewer).</p>
        </>
      )}
    </div>
  );
}

function ExerciseDetail({ ex, onBack }) {
  const [range, setRange] = useState("All");
  const [shown, setShown] = useState(10);
  const days = RANGES.find(r => r[0] === range)[1];
  const cutoff = new Date().getTime() - days * DAY_MS;
  let inRange = ex.sessions.filter(s => new Date(s.date).getTime() >= cutoff);
  if (!inRange.length) inRange = ex.sessions.slice(-1);
  const first = inRange[0], last = inRange[inRange.length - 1];
  const change = last.value - first.value;
  const unit = ex.weighted ? "lb" : "reps";
  const muscles = ex.info ? [...ex.info.primary, ...ex.info.secondary].map(m => MUSCLE_NAMES[m]).join(" · ") : "Custom exercise";
  const rangeName = range === "All" ? "since you started" : `in ${{ "3M": "3 months", "6M": "6 months", "1Y": "a year" }[range]}`;

  const points = inRange.map(s => ({
    t: new Date(s.date).getTime(),
    v: s.value,
    pr: s.pr,
    detail: ex.weighted ? `Best set ${setText(s.bestSet)}` : `${s.sets.length} sets`,
  }));

  return (
    <div className="lift">
      <button className="lp-back" onClick={onBack}><Back />All lifts</button>
      <header className="lp-head">
        <h1 className="lift-title">{ex.name}</h1>
        <p className="lift-sub">{muscles}</p>
      </header>

      <section className="lift-card lp-chart">
        <div className="lift-row lp-hero-row">
          <div className="lp-hero">
            <small>{ex.weighted ? "Estimated max" : "Most reps in a set"}</small>
            <b>{last.value.toLocaleString()}<span> {unit}</span></b>
            {inRange.length > 1 && (
              <em className={change > 0 ? "up" : change < 0 ? "down" : ""}>
                {change > 0 ? "▲ " : change < 0 ? "▼ " : ""}{change === 0 ? "No change" : `${Math.abs(change).toLocaleString()} ${unit}`} {rangeName}
              </em>
            )}
          </div>
          <div className="lift-toggle" role="group" aria-label="Time range">
            {RANGES.map(([r]) => (
              <button key={r} className={range === r ? "on" : ""} aria-pressed={range === r} onClick={() => setRange(r)}>{r}</button>
            ))}
          </div>
        </div>
        <TrendChart points={points} unit={unit} label={ex.weighted ? "Estimated max" : "Most reps"} />
        {inRange.length === 1 && <p className="lift-sub lp-center">Log {ex.name.toLowerCase()} again to start a trend line.</p>}
        {points.some(p => p.pr) && <p className="lp-legend"><i />PR, a new best</p>}
      </section>

      <section className="lp-bests">
        {ex.weighted ? (
          <>
            <div className="lift-card lp-tile">
              <b>{ex.best.top.heaviest.weight} lb × {ex.best.top.heaviest.reps}</b>
              <span>Heaviest set · {shortDate(ex.best.top.date)}</span>
            </div>
            <div className="lift-card lp-tile">
              <b>{ex.best.value.value} lb</b>
              <span>Best est. max · {shortDate(ex.best.value.date)}</span>
            </div>
            <div className="lift-card lp-tile">
              <b>{bigNumber(ex.best.volume.volume)} lb</b>
              <span>Most lifted in a session · {shortDate(ex.best.volume.date)}</span>
            </div>
          </>
        ) : (
          <div className="lift-card lp-tile">
            <b>{reps(ex.best.reps.maxReps)}</b>
            <span>Most in a set · {shortDate(ex.best.reps.date)}</span>
          </div>
        )}
        <div className="lift-card lp-tile">
          <b>{ex.sessions.length}</b>
          <span>Sessions · {ex.prs.length} PR{ex.prs.length === 1 ? "" : "s"}</span>
        </div>
      </section>

      <div className="lift-row lift-list-head"><h2 className="lift-h2">History</h2></div>
      <div className="lift-card lp-hist">
        {[...ex.sessions].reverse().slice(0, shown).map(s => (
          <div key={s.workoutId + s.date} className="lp-hist-row">
            <div className="lp-hist-top">
              <span><b>{shortDate(s.date)}</b><small> · {s.title}</small>{s.pr && <span className="lift-pr">PR</span>}</span>
              <span className="lp-hist-val">{valueText(ex, s.value)}</span>
            </div>
            <div className="lp-sets">
              {s.sets.map((st, i) => (
                <span key={i} className={st === s.bestSet ? "best" : ""}>{st.weight > 0 ? `${st.weight}×${st.reps}` : reps(st.reps)}</span>
              ))}
            </div>
          </div>
        ))}
        {ex.sessions.length > shown && (
          <button className="lp-more" onClick={() => setShown(n => n + 20)}>Show {Math.min(20, ex.sessions.length - shown)} more</button>
        )}
      </div>
    </div>
  );
}
