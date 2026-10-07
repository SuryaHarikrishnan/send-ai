import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import Analytics from "./Analytics";
import AICoach from "./AICoach";
import Home from "./Home";
import LiftHome from "./LiftHome";
import LiftProgress from "./LiftProgress";
import WorkoutLog from "./WorkoutLog";
import News from "./News";
import FoodHome from "./FoodHome";
import FoodLog from "./FoodLog";
import FoodProgress from "./FoodProgress";
import OwnerStats from "./OwnerStats";
import "./Food.css";
import "./Nav.css";
import { forget, track } from "./tracking";
import { InstallSheet } from "./InstallHelp";
import { isInstalled } from "./install";

const SPORTS = [
  { id: "lifting", name: "Lifting", line: "Workouts, muscles and PRs" },
  { id: "climbing", name: "Climbing", line: "Sends, grades and sessions" },
  { id: "running", name: "Running", line: "Coming with the phone app", soon: true },
  { id: "food", name: "Food", line: "Calories, macros and barcode scanning" },
];

const SPORT_NAMES = { lifting: "Lifting", climbing: "Climbing", food: "Food" };

function readSport() {
  try { const s = localStorage.getItem("send.sport"); return SPORT_NAMES[s] ? s : "lifting"; } catch { return "lifting"; }
}

// Instagram-style icons: outline normally, filled when that tab is open.
const I = {
  home: on => (
    <svg viewBox="0 0 24 24"><path d="M3.5 10.2 12 3.2l8.5 7V20a1 1 0 0 1-1 1h-5v-6.2h-5V21h-5a1 1 0 0 1-1-1z" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
  ),
  progress: on => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5" fill={on ? "currentColor" : "none"} />
      <path d="M7.5 15l3-3.5 2.5 2 3.5-4.5" stroke={on ? "#0a2f6b" : "currentColor"} strokeWidth={on ? 2.4 : 2} />
    </svg>
  ),
  log: on => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="5.5" fill={on ? "currentColor" : "none"} />
      <path d="M12 8v8M8 12h8" stroke={on ? "#0a2f6b" : "currentColor"} strokeWidth={on ? 2.4 : 2} />
    </svg>
  ),
  lifting: on => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 2.6 : 2} strokeLinecap="round"><path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11" /></svg>
  ),
  climbing: on => (
    <svg viewBox="0 0 24 24"><path d="M2.5 20 9 8.5l3.5 5.5 2.5-3.5L21.5 20z" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="17" cy="5.5" r="1.8" fill="currentColor" /></svg>
  ),
  running: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="14.5" cy="4.5" r="1.8" /><path d="M8 21l3-6 3 2.5V22M6 11.5l3-3h4l2.5 3.5 3 .5M11 15l1.5-6.5" /></svg>
  ),
  food: on => (
    <svg viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21c-4.5 0-7.5-3.8-7.5-8.2 0-3.4 2.3-5.3 4.6-5.3 1.3 0 2.1.5 2.9.5s1.6-.5 2.9-.5c2.3 0 4.6 1.9 4.6 5.3 0 4.4-3 8.2-7.5 8.2zM12 7.5c0-2 1-3.5 3-4" /></svg>
  ),
  chevron: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>,
  check: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
};

function Avatar({ user, size = 26 }) {
  const meta = user.user_metadata || {};
  const [broken, setBroken] = useState(false);
  const pic = meta.avatar_url || meta.picture;
  const name = meta.full_name || meta.name || user.email || "?";
  if (pic && !broken) return <img className="nav-avatar" src={pic} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  return <span className="nav-avatar nav-initial" style={{ width: size, height: size, fontSize: size * 0.45 }}>{name.trim()[0].toUpperCase()}</span>;
}

// The current day, updated when the date changes or the app comes back to the front.
function useToday() {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const check = () => setToday(t => (t.toDateString() === new Date().toDateString() ? t : new Date()));
    const id = setInterval(check, 30000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", check); window.removeEventListener("focus", check); };
  }, []);
  return today;
}

export default function Dashboard({ user }) {
  const [sport, setSport] = useState(readSport);
  const [tab, setTab] = useState("home");
  const [focus, setFocus] = useState(null);
  const [picking, setPicking] = useState(false);
  const [installHelp, setInstallHelp] = useState(false);
  // null means "today", which moves on by itself when the clock passes midnight
  // (phones keep the app open for days).
  const [foodPick, setFoodPick] = useState(null);
  const today = useToday();
  const foodDay = foodPick ?? today;
  const setFoodDay = d => setFoodPick(d.toDateString() === new Date().toDateString() ? null : d);
  const [foodMeal, setFoodMeal] = useState(null);
  const [owner, setOwner] = useState(false);

  const go = t => { setTab(t === "workout" ? "log" : t); setFocus(null); if (t === "log") setFoodMeal(null); };
  useEffect(() => { window.scrollTo(0, 0); }, [tab, sport]);
  // Only owners (public.app_owners) get a Stats row; the stats themselves are checked again on the server.
  useEffect(() => {
    supabase.rpc("is_owner").then(({ data }) => setOwner(data === true), () => {});
  }, [user.id]);
  useEffect(() => {
    if (!picking) return;
    const onKey = e => e.key === "Escape" && setPicking(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picking]);

  function chooseSport(id) {
    if (id !== sport) track("sport_switched", { from: sport, to: id });
    setSport(id);
    try { localStorage.setItem("send.sport", id); } catch { /* storage blocked */ }
    setPicking(false);
    go("home");
  }

  const lifting = sport === "lifting";
  const food = sport === "food";
  const climbing = sport === "climbing";
  const youTab = ["you", "coach", "news", "stats"].includes(tab);
  const meta = user.user_metadata || {};
  const TABS = [
    ["home", "Home", I.home],
    ["progress", lifting ? "Progress" : food ? "Dashboard" : "Analytics", I.progress],
    ["log", lifting ? "Log workout" : food ? "Add food" : "Log climb", I.log],
  ];

  return (
    <div className="dash-root has-tabbar">
      <div className="grain" />

      <header className="topbar">
        <div className="logo">
          <img className="logo-mark" src="/logo.png" width="28" height="28" alt="" />
          <span className="wordmark">SENDIT</span>
        </div>
        <button className="topbar-sport" onClick={() => setPicking(true)} aria-label={`Sport: ${SPORT_NAMES[sport]}. Change sport`}>
          {I[sport](false)}
          {SPORT_NAMES[sport]}
          <svg className="topbar-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </header>

      <main className="dash-content">
        {lifting && tab === "home" && <LiftHome user={user} onNavigate={go} onOpenExercise={k => { setFocus(k); setTab("progress"); }} />}
        {lifting && tab === "progress" && <LiftProgress user={user} focus={focus} onFocus={setFocus} onNavigate={go} />}
        {lifting && tab === "log" && <WorkoutLog user={user} onNavigate={go} />}
        {food && tab === "home" && <FoodHome user={user} day={foodDay} onDay={setFoodDay} onAdd={m => { setTab("log"); setFoodMeal(m); }} />}
        {food && tab === "progress" && <FoodProgress user={user} />}
        {food && tab === "log" && <FoodLog key={`${foodDay.toDateString()}-${foodMeal}`} user={user} day={foodDay} meal={foodMeal} onDone={() => go("home")} />}
        {climbing && tab === "home" && <Home user={user} onNavigate={go} />}
        {climbing && tab === "progress" && <Analytics user={user} />}
        {climbing && tab === "log" && <LogTab user={user} />}
        {tab === "coach" && <><button className="you-back" onClick={() => go("you")}>‹ You</button><AICoach user={user} /></>}
        {tab === "news" && <><button className="you-back" onClick={() => go("you")}>‹ You</button><News /></>}
        {tab === "stats" && owner && <><button className="you-back" onClick={() => go("you")}>‹ You</button><OwnerStats /></>}
        {tab === "you" && (
          <div className="you">
            <div className="you-head">
              <Avatar user={user} size={72} />
              <div>
                <h1>{meta.full_name || meta.name || "Your profile"}</h1>
                <p>{user.email}</p>
              </div>
            </div>
            <div className="you-list">
              {owner && <button onClick={() => go("stats")}><span>App stats<small>Users, activity and visitors</small></span>{I.chevron()}</button>}
              <button onClick={() => setPicking(true)}><span>Sport<small>{SPORT_NAMES[sport]}</small></span>{I.chevron()}</button>
              <button onClick={() => go("coach")}><span>AI coach<small>Ask questions about your training</small></span>{I.chevron()}</button>
              <button onClick={() => go("news")}><span>News<small>Climbing headlines</small></span>{I.chevron()}</button>
              {!isInstalled() && <button onClick={() => setInstallHelp(true)}><span>Add to Home Screen<small>Open SendIt like an app</small></span>{I.chevron()}</button>}
              <a href="/privacy.html"><span>Privacy</span>{I.chevron()}</a>
            </div>
            <button className="you-signout" onClick={() => { track("signed_out"); forget(); supabase.auth.signOut(); }}>Sign out</button>
          </div>
        )}
      </main>

      <nav className="tabbar" aria-label="Main">
        {TABS.map(([id, label, icon]) => (
          <button key={id} className={tab === id ? "on" : ""} aria-label={label} aria-current={tab === id ? "page" : undefined} onClick={() => go(id)}>
            {icon(tab === id)}
          </button>
        ))}
        <button className={picking ? "on" : ""} aria-label="Change sport" aria-haspopup="dialog" onClick={() => setPicking(true)}>
          <span className="tabbar-sport">
            {I[sport](picking)}
            <svg className="tabbar-caret" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 6.5l4-4 4 4" /></svg>
          </span>
        </button>
        <button className={youTab ? "on" : ""} aria-label="You" aria-current={youTab ? "page" : undefined} onClick={() => go("you")}>
          <span className={`tabbar-av${youTab ? " on" : ""}`}><Avatar user={user} /></span>
        </button>
      </nav>

      {installHelp && <InstallSheet onClose={() => setInstallHelp(false)} />}

      {picking && (
        <div className="sheet-wrap" onClick={() => setPicking(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Choose a sport" onClick={e => e.stopPropagation()}>
            <span className="sheet-grab" />
            <h2>Your sports</h2>
            {SPORTS.map(sp => (
              <button key={sp.id} className={`sheet-row${sport === sp.id ? " on" : ""}`} disabled={sp.soon} onClick={() => chooseSport(sp.id)} autoFocus={sport === sp.id}>
                <span className="sheet-ic">{I[sp.id](sport === sp.id)}</span>
                <span className="sheet-txt"><b>{sp.name}</b><small>{sp.line}</small></span>
                {sp.soon ? <span className="sheet-soon">Soon</span> : sport === sp.id && <span className="sheet-check">{I.check()}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LogTab({ user }) {
  const [grade, setGrade] = useState("");
  const [style, setStyle] = useState("boulder");
  const [angle, setAngle] = useState([]);
  const [holdType, setHoldType] = useState([]);
  const [attempts, setAttempts] = useState(1);
  const [sent, setSent] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const boulderGrades = ["VB","V0","V1","V2","V3","V4","V5","V6","V7","V8","V9","V10","V11","V12","V13","V14","V15","V16","V17"];
  const sportGrades = ["5.6","5.7","5.8","5.9","5.10a","5.10b","5.10c","5.10d","5.11a","5.11b","5.11c","5.11d","5.12a","5.12b","5.12c","5.12d","5.13a","5.13b","5.13c","5.13d","5.14a","5.14b","5.14c","5.14d","5.15a","5.15b","5.15c","5.15d"];

  const grades = style === "boulder" ? boulderGrades : sportGrades;

  function toggleAngle(a) {
    setAngle(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  }

  function toggleHold(h) {
    setHoldType(prev => prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h]);
  }

  async function handleSave() {
    if (!grade) return;
    if (holdType.length === 0 || angle.length === 0) {
      alert("Please select at least one hold type and wall angle.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("climbs").insert({
      user_id: user.id,
      grade,
      style,
      wall_angle: angle,
      hold_type: holdType,
      attempts,
      sent,
      notes,
    });
    if (error) {
      console.error("Insert error:", error);
      alert(error.message);
    } else {
      track("climb_logged", { grade, style, sent, attempts });
      setSaved(true);
      setGrade("");
      setAngle([]);
      setHoldType([]);
      setAttempts(1);
      setSent(false);
      setNotes("");
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  return (
    <div className="log-tab">
      <h2 className="tab-title">Log a Climb</h2>
      <div className="log-form">
        <div className="form-row">
          <label>Style</label>
          <div className="btn-group">
            {["boulder", "sport", "trad"].map(s => (
              <button key={s} className={style === s ? "active" : ""} onClick={() => { setStyle(s); setGrade(""); }}>{s}</button>
            ))}
          </div>
        </div>
        <div className="form-row">
          <label>Grade</label>
          <select value={grade} onChange={e => setGrade(e.target.value)} className="log-select">
            <option value="">Select grade</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Wall angle <span style={{color:"rgba(255,255,255,0.55)", fontSize:"10px", letterSpacing:"1px"}}>SELECT ALL THAT APPLY</span></label>
          <div className="btn-group">
            {["slab", "vertical", "overhang", "cave"].map(a => (
              <button key={a} className={angle.includes(a) ? "active" : ""} onClick={() => toggleAngle(a)}>{a}</button>
            ))}
          </div>
        </div>
        <div className="form-row">
          <label>Hold type <span style={{color:"rgba(255,255,255,0.55)", fontSize:"10px", letterSpacing:"1px"}}>SELECT ALL THAT APPLY</span></label>
          <div className="btn-group">
            {["crimp", "sloper", "pinch", "jug", "pocket", "mixed"].map(h => (
              <button key={h} className={holdType.includes(h) ? "active" : ""} onClick={() => toggleHold(h)}>{h}</button>
            ))}
          </div>
        </div>
        <div className="form-row">
          <label>Attempts</label>
          <div className="attempts-row">
            <button onClick={() => setAttempts(Math.max(1, attempts - 1))}>−</button>
            <span>{attempts}</span>
            <button onClick={() => setAttempts(attempts + 1)}>+</button>
          </div>
        </div>
        <div className="form-row">
          <label>Sent?</label>
          <div className="btn-group">
            <button className={sent ? "active" : ""} onClick={() => setSent(true)}>✓ Yes</button>
            <button className={!sent ? "active" : ""} onClick={() => setSent(false)}>✗ No</button>
          </div>
        </div>
        <div className="form-row">
          <label>Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Beta, how it felt, what to work on..."
            className="log-textarea"
          />
        </div>
        <button className="save-btn" onClick={handleSave} disabled={saving || !grade}>
          {saved ? "✓ Saved" : saving ? "Saving..." : "Log Climb"}
        </button>
      </div>
    </div>
  );
}