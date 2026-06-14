import { useState, useEffect } from "react";
import { supabase } from "./supabase";

export default function Home({ user, onNavigate }) {
  const [climbs, setClimbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiMessage, setAiMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from("climbs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      setClimbs(data || []);
      setLoading(false);
    }
    fetchData();
  }, [user]);

  useEffect(() => {
    if (!loading && climbs.length >= 3) getAiMessage();
  }, [loading]);

  async function getAiMessage() {
    setAiLoading(true);
    const recent = climbs.slice(-5);
    const sent = climbs.filter(c => c.sent);
    const topGrade = sent.length > 0 ? sent[sent.length - 1].grade : "unknown";
    const lastSession = recent[recent.length - 1];
    const daysSince = lastSession
      ? Math.floor((Date.now() - new Date(lastSession.created_at)) / 86400000)
      : null;

    const prompt = `You are a climbing coach giving a short personal check-in. Address the climber as "you" never "team". Be direct, motivating, specific to their data. Max 2 sentences. No markdown. No emojis.'

Climber stats:
- Total climbs: ${climbs.length}
- Total sends: ${sent.length}
- Top grade sent: ${topGrade}
- Days since last climb: ${daysSince ?? "unknown"}
- Recent grades: ${recent.map(c => c.grade).join(", ")}
- Recent hold types: ${recent.map(c => c.hold_type).join(", ")}

Give them a personalized check-in. Reference their actual data.`;

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setAiMessage(data.text || "");
    } catch (e) {
      setAiMessage("");
    }
    setAiLoading(false);
  }
  async function handleDelete(id) {
  const { error } = await supabase.from("climbs").delete().eq("id", id);
  if (!error) setClimbs(climbs.filter(c => c.id !== id));
}

  if (loading) return <div className="coming-soon">Loading...</div>;

  const sent = climbs.filter(c => c.sent);
  const sendRate = climbs.length > 0 ? Math.round((sent.length / climbs.length) * 100) : 0;
  const topGrade = sent.length > 0 ? sent[sent.length - 1].grade : "—";
  const thisWeek = climbs.filter(c => {
    const d = new Date(c.created_at);
    const now = new Date();
    return (now - d) / 86400000 <= 7;
  });

  // grade progression for chart
  const gradeMap = { "VB": 0, "V0": 1, "V1": 2, "V2": 3, "V3": 4, "V4": 5, "V5": 6, "V6": 7, "V7": 8, "V8": 9, "V9": 10, "V10": 11, "V11": 12, "V12": 13, "V13": 14, "V14": 15, "V15": 16, "V16": 17, "V17": 18 };
  const chartData = climbs
    .filter(c => gradeMap[c.grade] !== undefined)
    .map((c, i) => ({ i, val: gradeMap[c.grade], grade: c.grade, sent: c.sent }));
  const maxVal = Math.max(...chartData.map(c => c.val), 5);
  const chartW = 500;
  const chartH = 120;

  return (
    <div className="home">
      <div className="home-header">
        <div>
          <div className="home-greeting">Welcome back.</div>
          <div className="home-sub">Here's where you stand.</div>
        </div>
        <button className="log-cta" onClick={() => onNavigate("log")}>+ Log Climb</button>
      </div>

      {aiMessage && (
        <div className="ai-checkin">
          <div className="ai-checkin-label">AI Coach</div>
          <div className="ai-checkin-text">{aiMessage}</div>
        </div>
      )}
      {aiLoading && (
        <div className="ai-checkin">
          <div className="ai-checkin-label">AI Coach</div>
          <div className="ai-checkin-text" style={{ color: "rgba(240,237,230,0.2)" }}>Analyzing your sessions...</div>
        </div>
      )}

      <div className="home-stats">
        <div className="home-stat-card">
          <span className="home-stat-num">{climbs.length}</span>
          <span className="home-stat-label">Total Climbs</span>
        </div>
        <div className="home-stat-card">
          <span className="home-stat-num">{topGrade}</span>
          <span className="home-stat-label">Top Send</span>
        </div>
        <div className="home-stat-card">
          <span className="home-stat-num">{sendRate}%</span>
          <span className="home-stat-label">Send Rate</span>
        </div>
        <div className="home-stat-card">
          <span className="home-stat-num">{thisWeek.length}</span>
          <span className="home-stat-label">This Week</span>
        </div>
      </div>

      {chartData.length > 1 && (
        <div className="home-card">
          <div className="home-card-title">Grade Progression</div>
          <svg viewBox={`0 0 ${chartW} ${chartH + 20}`} width="100%" style={{ overflow: "visible" }}>
            <polyline
              points={chartData.map((d, i) => `${(i / (chartData.length - 1)) * chartW},${chartH - (d.val / maxVal) * chartH}`).join(" ")}
              fill="none"
              stroke="rgba(200,245,122,0.2)"
              strokeWidth="1.5"
            />
            {chartData.map((d, i) => (
              <circle
                key={i}
                cx={(i / (chartData.length - 1)) * chartW}
                cy={chartH - (d.val / maxVal) * chartH}
                r="4"
                fill={d.sent ? "#c8f57a" : "rgba(200,245,122,0.3)"}
              />
            ))}
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem" }}>
            <span className="home-card-sub">First climb</span>
            <span className="home-card-sub">Most recent</span>
          </div>
        </div>
      )}

    <div className="home-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <div className="home-card-title" style={{ margin: 0 }}>Recent Climbs</div>
            <button className="see-all-btn" onClick={() => setShowAll(!showAll)}>
                {showAll ? "Show less" : "See all"}
            </button>
         </div>
        {(showAll ? climbs.slice().reverse() : climbs.slice(-3).reverse()).map((c, i) => (
            <div key={i} className="recent-climb-row">
                <span className="recent-grade">{c.grade}</span>
                <span className="recent-meta">{c.style} · {c.wall_angle} · {c.hold_type}</span>
                <span className={`recent-sent ${c.sent ? "sent" : "unsent"}`}>{c.sent ? "✓ Sent" : "✗ Unsent"}</span>
                <button className="delete-btn" onClick={() => { if (window.confirm("Delete this climb?")) handleDelete(c.id); }}>✕</button>
            </div>
        ))}
        
    </div>
    </div>
  );
}