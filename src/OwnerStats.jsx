import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import "./Stats.css";

// Owner-only app stats. The numbers come from public.owner_stats (supabase/owner.sql), which
// refuses anyone who isn't in public.app_owners, and from /api/owner-stats for PostHog visitors.

const SPORT_LABEL = { lifting: "Lifting", climbing: "Climbing", food: "Food" };
const EVENT_LABEL = {
  workout_logged: "Workouts logged",
  food_logged: "Foods logged",
  climb_logged: "Climbs logged",
  sport_switched: "Sport switches",
  signed_out: "Sign outs",
};

const fmt = n => (Number(n) || 0).toLocaleString();
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const dayLabel = d => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// Adds the PostHog demo people (who never touched the database) on top of the real accounts.
function withDemo(stats, demo) {
  if (!stats || !demo) return stats;
  const add = (a = {}, b = {}) => Object.fromEntries(Object.keys(a).map(k => [k, (a[k] || 0) + (b[k] || 0)]));
  const sports = new Map(stats.sports.map(s => [s.sport, s]));
  for (const s of demo.sports) {
    const real = sports.get(s.sport) || { sport: s.sport, users: 0, entries: 0, entries_7d: 0 };
    sports.set(s.sport, { sport: s.sport, users: real.users + s.users, entries: real.entries + s.entries, entries_7d: real.entries_7d + s.entries_7d });
  }
  const demoDays = new Map(demo.daily.map(d => [d.day, d]));
  return {
    ...stats,
    users: { ...stats.users, total: stats.users.total + demo.users.total, new_7d: stats.users.new_7d + demo.users.new_7d, new_30d: stats.users.new_30d + demo.users.new_30d, signed_in_7d: stats.users.signed_in_7d + demo.active.d7 },
    active: add(stats.active, demo.active),
    entries: add(stats.entries, demo.entries),
    sports: [...sports.values()].filter(s => s.entries > 0).sort((a, b) => b.entries - a.entries),
    daily: stats.daily.map(d => {
      const x = demoDays.get(d.day) || {};
      return { ...d, signups: d.signups + (x.signups || 0), active: d.active + (x.active || 0), entries: d.entries + (x.entries || 0) };
    }),
  };
}

function Tile({ value, label, sub, tone }) {
  return (
    <div className={`st-tile${tone ? ` st-${tone}` : ""}`}>
      <b>{value}</b>
      <span>{label}</span>
      {sub && <small>{sub}</small>}
    </div>
  );
}

// 30 bars, one per day, with the first, middle and last dates underneath.
function DayBars({ days, field, tone }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...days.map(d => d[field] || 0));
  const total = days.reduce((a, d) => a + (d[field] || 0), 0);
  const shown = hover != null ? days[hover] : null;
  return (
    <div className="st-chart">
      <div className="st-chart-read">
        {shown ? <><b>{fmt(shown[field])}</b> on {dayLabel(shown.day)}</> : <><b>{fmt(total)}</b> in 30 days</>}
      </div>
      <div className="st-bars" onMouseLeave={() => setHover(null)}>
        {days.map((d, i) => (
          <span key={d.day} className={hover === i ? "on" : ""} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
            <i className={`st-fill st-${tone}`} style={{ height: `${Math.max(d[field] ? 4 : 0, ((d[field] || 0) / max) * 100)}%` }} />
          </span>
        ))}
      </div>
      <div className="st-axis">
        <span>{dayLabel(days[0].day)}</span>
        <span>{dayLabel(days[Math.floor(days.length / 2)].day)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

const CHARTS = [
  ["signups", "Sign-ups", "blue"],
  ["active", "Active", "green"],
  ["entries", "Entries", "purple"],
];

export default function OwnerStats() {
  const [stats, setStats] = useState(null);
  const [visits, setVisits] = useState(undefined); // undefined loading, null not set up, object loaded
  const [visitsError, setVisitsError] = useState("");
  const [error, setError] = useState("");
  const [chart, setChart] = useState("signups");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setVisitsError("");
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const { data: { session } } = await supabase.auth.getSession();
    const [db, ph] = await Promise.all([
      supabase.rpc("owner_stats", { tz }),
      fetch("/api/owner-stats", { headers: { Authorization: `Bearer ${session?.access_token}` }, signal: AbortSignal.timeout(30000) })
        .then(async r => ({ ok: r.ok, body: await r.json().catch(() => ({})) }))
        .catch(() => ({ ok: false, body: {} })),
    ]);
    if (db.error || !db.data) setError(db.error?.message || "Couldn't load stats.");
    else setStats(db.data);
    if (ph.ok) setVisits(ph.body.posthog ?? null);
    else { setVisits(undefined); setVisitsError(ph.body.error || "Couldn't load visitor numbers."); }
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="st"><div className="st-card st-error">{error}</div></div>;
  if (!stats) return <div className="st"><div className="st-card st-loading">Loading stats…</div></div>;

  const { users, active, entries, sports, daily } = withDemo(stats, visits?.demo);
  const sportMax = Math.max(1, ...sports.map(s => s.users));
  const updated = new Date(stats.generated_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <div className="st">
      <div className="st-head">
        <div>
          <h1>App stats</h1>
          <p>Updated {updated}</p>
        </div>
        <button className="st-refresh" onClick={load} disabled={loading} aria-label="Refresh">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={loading ? "spin" : ""}><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4.5h-4.5" /></svg>
        </button>
      </div>

      <div className="st-tiles">
        <Tile tone="blue" value={fmt(users.total)} label="Users" sub={`+${fmt(users.new_7d)} this week`} />
        <Tile tone="green" value={fmt(active.d7)} label="Active this week" sub={`${pct(active.d7, users.total)}% of users`} />
        <Tile value={fmt(active.d1)} label="Active today" sub={`${fmt(active.d30)} this month`} />
        <Tile value={fmt(entries.total)} label="Entries logged" sub={`+${fmt(entries.d7)} this week`} />
      </div>

      <section className="st-card">
        <div className="st-card-head">
          <h2>Last 30 days</h2>
          <div className="st-seg" role="tablist">
            {CHARTS.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={chart === id} className={chart === id ? "on" : ""} onClick={() => setChart(id)}>{label}</button>
            ))}
          </div>
        </div>
        {daily?.length > 0 && <DayBars days={daily} field={chart} tone={CHARTS.find(c => c[0] === chart)[2]} />}
      </section>

      {sports.length > 0 && (
        <section className="st-card">
          <h2>Sports</h2>
          <div className="st-sports">
            {sports.map(s => (
              <div key={s.sport} className="st-sport">
                <div className="st-sport-top">
                  <b>{SPORT_LABEL[s.sport] || s.sport}</b>
                  <span>{fmt(s.users)} {s.users === 1 ? "user" : "users"} · {fmt(s.entries)} entries</span>
                </div>
                <span className="st-meter"><i style={{ width: `${(s.users / sportMax) * 100}%` }} /></span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="st-mini">
        <div><b>{fmt(users.signed_in_7d)}</b><span>Signed in this week</span></div>
        <div><b>{fmt(stats.photo_scans)}</b><span>Meal photos scanned</span></div>
        <div><b>{fmt(users.new_30d)}</b><span>New this month</span></div>
      </div>

      {visits && (
        <>
          <h2 className="st-section">Visitors</h2>
          <div className="st-tiles st-tiles-3">
            <Tile value={fmt(visits.visitors.d1)} label="Today" />
            <Tile tone="blue" value={fmt(visits.visitors.d7)} label="This week" />
            <Tile value={fmt(visits.visitors.d30)} label="This month" />
          </div>
          <section className="st-card">
            <div className="st-card-head">
              <h2>Daily visitors</h2>
              <small>{fmt(visits.pageviews_30d)} page views · {fmt(visits.sessions_30d)} sessions</small>
            </div>
            {visits.daily.length > 0 && <DayBars days={visits.daily} field="visitors" tone="blue" />}
          </section>
          {visits.events.length > 0 && (
            <section className="st-card">
              <h2>What people do</h2>
              <div className="st-events">
                {visits.events.map(e => (
                  <div key={e.name}><span>{EVENT_LABEL[e.name] || e.name.replace(/_/g, " ")}</span><b>{fmt(e.count)}</b></div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
      {visits === null && <p className="st-note">Visitor numbers show up here once POSTHOG_PERSONAL_API_KEY is set in Vercel.</p>}
      {visitsError && <p className="st-note">{visitsError}</p>}
    </div>
  );
}
