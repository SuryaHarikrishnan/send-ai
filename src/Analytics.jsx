import { useState, useEffect } from "react";
import { supabase } from "./supabase";

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

  const holdCounts = {};
  const angleCounts = {};
  const gradeCounts = {};

  climbs.forEach(c => {
    holdCounts[c.hold_type] = (holdCounts[c.hold_type] || 0) + 1;
    angleCounts[c.wall_angle] = (angleCounts[c.wall_angle] || 0) + 1;
    gradeCounts[c.grade] = (gradeCounts[c.grade] || 0) + 1;
  });

  const topGrade = sent.length > 0 ? sent[sent.length - 1].grade : "N/A";

  function Bar({ label, value, max, color = "#c8f57a" }) {
    const pct = Math.round((value / max) * 100);
    return (
      <div className="bar-row">
        <span className="bar-label">{label}</span>
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="bar-val">{value}</span>
      </div>
    );
  }

  const maxHold = Math.max(...Object.values(holdCounts));
  const maxAngle = Math.max(...Object.values(angleCounts));

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
      </div>

      <div className="analytics-grid">
        <div className="analytics-card">
          <div className="analytics-card-title">Hold Types</div>
          {Object.entries(holdCounts).map(([k, v]) => (
            <Bar key={k} label={k} value={v} max={maxHold} />
          ))}
        </div>

        <div className="analytics-card">
          <div className="analytics-card-title">Wall Angles</div>
          {Object.entries(angleCounts).map(([k, v]) => (
            <Bar key={k} label={k} value={v} max={maxAngle} color="#7af5e8" />
          ))}
        </div>

        <div className="analytics-card full-width">
          <div className="analytics-card-title">Grades Attempted</div>
          <div className="grade-bubbles">
            {Object.entries(gradeCounts).map(([grade, count]) => (
              <div key={grade} className="grade-bubble">
                <span className="grade-bubble-grade">{grade}</span>
                <span className="grade-bubble-count">{count}x</span>
              </div>
            ))}
          </div>
        </div>

        <div className="analytics-card full-width">
          <div className="analytics-card-title">Weakness Report</div>
          <div className="weakness-report">
            {(() => {
              const weakHold = Object.entries(holdCounts).sort((a, b) => a[1] - b[1])[0];
              const weakAngle = Object.entries(angleCounts).sort((a, b) => a[1] - b[1])[0];
              const sentByHold = {};
              climbs.filter(c => c.sent).forEach(c => {
                sentByHold[c.hold_type] = (sentByHold[c.hold_type] || 0) + 1;
              });
              const lowestSendHold = Object.entries(holdCounts)
                .map(([h, total]) => ({ h, rate: (sentByHold[h] || 0) / total }))
                .sort((a, b) => a.rate - b.rate)[0];

              return (
                <>
                  <div className="weakness-item">
                    <span className="weakness-dot" />
                    You've climbed <strong>{weakHold[0]}s</strong> the least — only {weakHold[1]} time{weakHold[1] > 1 ? "s" : ""}. Add more to your sessions.
                  </div>
                  <div className="weakness-item">
                    <span className="weakness-dot" />
                    Your weakest angle is <strong>{weakAngle[0]}</strong> — {weakAngle[1]} attempt{weakAngle[1] > 1 ? "s" : ""}. Prioritize this.
                  </div>
                  <div className="weakness-item">
                    <span className="weakness-dot" />
                    Lowest send rate on <strong>{lowestSendHold.h}s</strong> — {Math.round(lowestSendHold.rate * 100)}% send rate. Focus here.
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}