import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { topSend } from "./climbing";

export default function Analytics({ user }) {
  const [climbs, setClimbs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClimbs() {
      const { data } = await supabase
        .from("climbs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      setClimbs(data || []);
      setLoading(false);
    }
    fetchClimbs();
  }, [user]);

  if (loading) return <div className="coming-soon">Loading...</div>;
  if (climbs.length === 0) return <div className="coming-soon">No climbs logged yet.</div>;

  const sent = climbs.filter(c => c.sent);
  const sendRate = Math.round((sent.length / climbs.length) * 100);

  const gradeOrder = ["VB","V0","V1","V2","V3","V4","V5","V6","V7","V8","V9","V10","V11","V12","V13","V14","V15","V16","V17"];
  const gradeMap = Object.fromEntries(gradeOrder.map((g, i) => [g, i]));

  const topGrade = topSend(climbs) ?? "—";

  const holdCounts = {};
  const angleCounts = {};
  climbs.forEach(c => {
    (Array.isArray(c.hold_type) ? c.hold_type : [c.hold_type]).forEach(h => {
      if (h) holdCounts[h] = (holdCounts[h] || 0) + 1;
    });
    (Array.isArray(c.wall_angle) ? c.wall_angle : [c.wall_angle]).forEach(a => {
      if (a) angleCounts[a] = (angleCounts[a] || 0) + 1;
    });
  });

  const gradeCounts = {};
  climbs.forEach(c => { gradeCounts[c.grade] = (gradeCounts[c.grade] || 0) + 1; });

  const firstSends = {};
  sent.forEach(c => { if (!firstSends[c.grade]) firstSends[c.grade] = c.created_at; });
  const pbList = Object.entries(firstSends)
    .sort((a, b) => (gradeMap[b[0]] ?? 0) - (gradeMap[a[0]] ?? 0))
    .slice(0, 5);

  const weekCounts = {};
  climbs.forEach(c => {
    const d = new Date(c.created_at);
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const week = `${d.getFullYear()}-${Math.floor((d - startOfYear) / (7 * 86400000))}`;
    weekCounts[week] = (weekCounts[week] || 0) + 1;
  });
  const weekData = Object.entries(weekCounts).slice(-8);
  const maxWeekVal = Math.max(...weekData.map(w => w[1]), 1);

  const gradeAttempts = {};
  const gradeSends = {};
  climbs.forEach(c => {
    gradeAttempts[c.grade] = (gradeAttempts[c.grade] || 0) + 1;
    if (c.sent) gradeSends[c.grade] = (gradeSends[c.grade] || 0) + 1;
  });
  const sendRateByGrade = Object.entries(gradeAttempts)
    .sort((a, b) => (gradeMap[a[0]] ?? 0) - (gradeMap[b[0]] ?? 0))
    .map(([g, total]) => ({
      grade: g,
      rate: Math.round(((gradeSends[g] || 0) / total) * 100),
      total,
    }));

  const holdSends = {};
  sent.forEach(c => {
    (Array.isArray(c.hold_type) ? c.hold_type : [c.hold_type]).forEach(h => {
      if (h) holdSends[h] = (holdSends[h] || 0) + 1;
    });
  });

  const weakHold = Object.entries(holdCounts)
    .map(([h, total]) => ({ h, rate: Math.round(((holdSends[h] || 0) / total) * 100) }))
    .sort((a, b) => a.rate - b.rate)[0];

  const weakAngle = Object.entries(angleCounts).sort((a, b) => a[1] - b[1])[0];
  const maxHold = Math.max(...Object.values(holdCounts), 1);
  const maxAngle = Math.max(...Object.values(angleCounts), 1);

  // streak
  const allWeekKeys = new Set(climbs.map(c => {
    const d = new Date(c.created_at);
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    return `${d.getFullYear()}-${Math.floor((d - startOfYear) / (7 * 86400000))}`;
  }));
  let streak = 0;
  const nowDate = new Date();
  for (let i = 0; i < 52; i++) {
    const d = new Date(nowDate);
    d.setDate(d.getDate() - i * 7);
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const key = `${d.getFullYear()}-${Math.floor((d - startOfYear) / (7 * 86400000))}`;
    if (allWeekKeys.has(key)) streak++;
    else break;
  }

  const lastClimb = climbs[climbs.length - 1];
  const daysSince = lastClimb
    ? Math.max(0, Math.floor((Date.now() - new Date(lastClimb.created_at).getTime()) / 86400000))
    : null;

  // challenges
  const challenges = [
    { label: "Log your first climb", done: climbs.length >= 1, icon: "🧗" },
    { label: "Log 10 climbs", done: climbs.length >= 10, icon: "📈", progress: `${Math.min(climbs.length, 10)}/10` },
    { label: "Log 50 climbs", done: climbs.length >= 50, icon: "💯", progress: `${Math.min(climbs.length, 50)}/50` },
    { label: "Send a V4 or harder", done: sent.some(c => (gradeMap[c.grade] ?? 0) >= 5), icon: "🎯" },
    { label: "Send a V6 or harder", done: sent.some(c => (gradeMap[c.grade] ?? 0) >= 7), icon: "🔥" },
    { label: "Climb 3 weeks in a row", done: streak >= 3, icon: "📅", progress: `${Math.min(streak, 3)}/3 weeks` },
    { label: "Try all hold types", done: Object.keys(holdCounts).length >= 6, icon: "✋", progress: `${Object.keys(holdCounts).length}/6` },
    { label: "Try all wall angles", done: Object.keys(angleCounts).length >= 4, icon: "📐", progress: `${Object.keys(angleCounts).length}/4` },
    { label: "Achieve 70%+ send rate", done: sendRate >= 70, icon: "⚡", progress: `${sendRate}%` },
    { label: "Send on a slab", done: sent.some(c => (Array.isArray(c.wall_angle) ? c.wall_angle : [c.wall_angle]).includes("slab")), icon: "🏔️" },
  ];

  function Bar({ label, value, max, color = "#ffffff", suffix = "" }) {
    const pct = Math.round((value / max) * 100);
    return (
      <div className="bar-row">
        <span className="bar-label">{label}</span>
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="bar-val">{value}{suffix}</span>
      </div>
    );
  }

  return (
    <div className="analytics">
      <h2 className="tab-title">Analytics</h2>

      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-card-num">{climbs.length}</span>
          <span className="stat-card-label">Total Climbs</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-num">{sent.length}</span>
          <span className="stat-card-label">Sends</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-num">{sendRate}%</span>
          <span className="stat-card-label">Send Rate</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-num">{topGrade}</span>
          <span className="stat-card-label">Top Send</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-num">{streak}w</span>
          <span className="stat-card-label">Streak</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-num" style={{ color: daysSince === 0 ? "#ffffff" : daysSince <= 2 ? "rgba(140,200,255,0.6)" : "rgba(140,200,255,0.35)" }}>{daysSince ?? "—"}</span>
          <span className="stat-card-label">Days Since Climb</span>
        </div>
      </div>

      <div className="analytics-grid">

        {/* Volume */}
        {weekData.length > 0 && (
          <div className="analytics-card">
            <div className="analytics-card-title">Volume — Climbs Per Week</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "140px", padding: "0 4px" }}>
              {weekData.map(([week, count], i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                  <div style={{
                    width: "50%",
                    height: `${(count / maxWeekVal) * 125}px`,
                    background: i === weekData.length - 1 ? "#ffffff" : "rgba(140,200,255,0.3)",
                    borderRadius: "2px 2px 0 0",
                    minHeight: "4px",
                  }} />
                  <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.5)" }}>{count}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem" }}>
              <span className="bar-val">8w ago</span>
              <span className="bar-val">Now</span>
            </div>
          </div>
        )}

        {/* Send rate by grade */}
        <div className="analytics-card">
          <div className="analytics-card-title">Send Rate by Grade</div>
          {sendRateByGrade.map(({ grade, rate }) => (
            <Bar key={grade} label={grade} value={rate} max={100} suffix="%"
              color={rate >= 70 ? "#ffffff" : rate >= 40 ? "rgba(140,200,255,0.5)" : "rgba(140,200,255,0.2)"} />
          ))}
        </div>

        {/* Hold types */}
        <div className="analytics-card">
          <div className="analytics-card-title">Hold Types</div>
          {Object.entries(holdCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <Bar key={k} label={k} value={v} max={maxHold} />
          ))}
        </div>

        {/* Wall angles */}
        <div className="analytics-card">
          <div className="analytics-card-title">Wall Angles</div>
          {Object.entries(angleCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <Bar key={k} label={k} value={v} max={maxAngle} color="#7af5e8" />
          ))}
        </div>

        {/* Grade bubbles */}
        <div className="analytics-card full-width">
          <div className="analytics-card-title">Grades Attempted</div>
          <div className="grade-bubbles">
            {Object.entries(gradeCounts)
              .sort((a, b) => (gradeMap[a[0]] ?? 0) - (gradeMap[b[0]] ?? 0))
              .map(([grade, count]) => (
                <div key={grade} className="grade-bubble">
                  <span className="grade-bubble-grade">{grade}</span>
                  <span className="grade-bubble-count">{count}x</span>
                </div>
              ))}
          </div>
        </div>

        {/* Personal bests */}
        <div className="analytics-card">
          <div className="analytics-card-title">Personal Bests</div>
          {pbList.length === 0 && <div style={{ color: "rgba(255,255,255,0.32)", fontSize: "13px" }}>No sends yet.</div>}
          {pbList.map(([grade, date]) => (
            <div key={grade} className="bar-row">
              <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: "18px", color: "#ffffff", width: "50px" }}>{grade}</span>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)" }}>
                First sent {new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
          ))}
        </div>

        {/* Weakness report */}
        <div className="analytics-card">
          <div className="analytics-card-title">Weakness Report</div>
          <div className="weakness-report">
            {weakHold && (
              <div className="weakness-item">
                <span className="weakness-dot" />
                Lowest send rate on <strong>{weakHold.h}s</strong> — {weakHold.rate}% sent.
              </div>
            )}
            {weakAngle && (
              <div className="weakness-item">
                <span className="weakness-dot" />
                Least climbed angle is <strong>{weakAngle[0]}</strong> — {weakAngle[1]} attempt{weakAngle[1] > 1 ? "s" : ""}.
              </div>
            )}
            <div className="weakness-item">
              <span className="weakness-dot" />
              {sendRate >= 70 ? "You're climbing within your limit — try harder grades." : sendRate >= 40 ? "Good balance of challenge and success." : "You're projecting hard — add easier routes to build volume."}
            </div>
          </div>
        </div>

        {/* Challenge board */}
        <div className="analytics-card full-width">
          <div className="analytics-card-title">Challenge Board</div>
          <div className="challenge-grid">
            {challenges.map((c, i) => (
              <div key={i} className={`challenge-card ${c.done ? "done" : ""}`}>
                <div className="challenge-icon">{c.icon}</div>
                <div className="challenge-label">{c.label}</div>
                {c.progress && !c.done && <div className="challenge-progress">{c.progress}</div>}
                {c.done && <div className="challenge-done">✓ Complete</div>}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}