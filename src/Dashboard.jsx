import { useState } from "react";
import { supabase } from "./supabase";
import Analytics from "./Analytics";
import AICoach from "./AICoach";
import Home from "./Home";
import LiftHome from "./LiftHome";
import WorkoutLog from "./WorkoutLog";
import News from "./News";

export default function Dashboard({ user }) {
  const [tab, setTab] = useState("home");
  const TABS = [["home", "home"], ["workout", "log workout"], ["climbing", "climbing"], ["log", "log climb"], ["analytics", "analytics"], ["training", "coach"], ["news", "news"]];

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="dash-root">
      <div className="grain" />

      <nav className="dash-nav">
        <div className="logo">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <path d="M8 28 L16 4 L24 28" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11 20 L21 20" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="16" cy="4" r="2.5" fill="#ffffff"/>
          </svg>
          SEND<span>-AI</span>
        </div>
        <div className="dash-tabs">
          {TABS.map(([t, label]) => (
            <button
              key={t}
              className={`dash-tab ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="signout-btn" onClick={handleSignOut}>Sign Out</button>
      </nav>

      <div className="dash-content">
        {tab === "home" && <LiftHome user={user} onNavigate={setTab} />}
        {tab === "workout" && <WorkoutLog user={user} onNavigate={setTab} />}
        {tab === "climbing" && <Home user={user} onNavigate={setTab} />}
        {tab === "log" && <LogTab user={user} />}
        {tab === "analytics" && <Analytics user={user} />}
        {tab === "training" && <AICoach user={user} />}
        {tab === "news" && <News />}
      </div>
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