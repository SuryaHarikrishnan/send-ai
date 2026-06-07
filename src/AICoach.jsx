import { useState, useEffect } from "react";
import { supabase } from "./supabase";

export default function AICoach({ user }) {
  const [climbs, setClimbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState("");
  const [thinking, setThinking] = useState(false);
  const [mode, setMode] = useState("diagnosis");
  const [goalGrade, setGoalGrade] = useState("");

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

  async function handleAsk() {
    if (climbs.length === 0) return;
    setThinking(true);
    setResponse("");

    const summary = {
      totalClimbs: climbs.length,
      sends: climbs.filter(c => c.sent).length,
      grades: climbs.map(c => c.grade),
      holdTypes: climbs.map(c => c.hold_type),
      angles: climbs.map(c => c.wall_angle),
      styles: climbs.map(c => c.style),
      recentClimbs: climbs.slice(-10),
    };

    const prompt = mode === "diagnosis"
      ? `You are an expert climbing coach. Analyze this climber's data and give a detailed plateau diagnosis. Be specific, direct, and actionable. Use climbing terminology. Identify their weaknesses based on the data patterns.

Climber data: ${JSON.stringify(summary)}

Give:
1. Why they're plateauing (specific reasons based on data)
2. Top 3 weaknesses identified
3. What to focus on next 4 weeks`
      : `You are an expert climbing coach. Create a personalized 4-week training plan for this climber.

Climber data: ${JSON.stringify(summary)}
Goal grade: ${goalGrade || "one grade above current top send"}

Give a structured week-by-week plan with specific exercises, volume, and focus areas. Be specific with climbing drills and training techniques.`;

    try {
        const res = await fetch("/api/coach", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt }),
        });
        const data = await res.json();
        const text = data.text || "Something went wrong.";
        setResponse(text);
    } catch (e) {
      setResponse("Error reaching AI. Try again.");
    }
    setThinking(false);
  }

  if (loading) return <div className="coming-soon">Loading...</div>;
  if (climbs.length < 3) return <div className="coming-soon">Log at least 3 climbs to unlock AI coaching.</div>;

  return (
    <div className="ai-coach">
      <h2 className="tab-title">AI Coach</h2>

      <div className="coach-modes">
        <button className={mode === "diagnosis" ? "active" : ""} onClick={() => { setMode("diagnosis"); setResponse(""); }}>
          Plateau Diagnosis
        </button>
        <button className={mode === "plan" ? "active" : ""} onClick={() => { setMode("plan"); setResponse(""); }}>
          Training Plan
        </button>
      </div>

      {mode === "plan" && (
        <div className="goal-input">
          <label>Goal grade (optional)</label>
          <input
            type="text"
            placeholder="e.g. V6, 5.12a"
            value={goalGrade}
            onChange={e => setGoalGrade(e.target.value)}
            className="auth-input"
            style={{ maxWidth: "200px" }}
          />
        </div>
      )}

      <button className="save-btn" onClick={handleAsk} disabled={thinking}>
        {thinking ? "Analyzing your climbs..." : mode === "diagnosis" ? "Diagnose My Plateau" : "Generate Training Plan"}
      </button>

      {response && (
        <div className="ai-response">
          {response.split("\n").map((line, i) => (
            <p key={i} className={line.startsWith("#") || /^\d\./.test(line) ? "ai-heading" : "ai-line"}>
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}