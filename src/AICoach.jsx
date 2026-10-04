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

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ mode, goalGrade }),
      });
      const data = await res.json();
      setResponse(data.text || data.error || "Something went wrong.");
    } catch {
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
          {response.split("\n").filter(l => l.trim()).map((line, i) => (
            <p key={i} className={line === line.toUpperCase() && line.length > 3 ? "ai-heading" : "ai-line"}>
          {line}
        </p>
      ))}
    </div>
  )}
    </div>
  );
}