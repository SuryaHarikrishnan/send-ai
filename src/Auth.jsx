import { useState } from "react";
import { supabase } from "./supabase";

export default function Auth({ onAuth, initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function handleSubmit() {
    setError("");
    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setConfirmed(true);
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else onAuth(data.user);
    }
    setLoading(false);
  }

  if (confirmed) return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-logo">SEND<span>-AI</span></div>
        <p className="auth-confirm">Check your email to confirm your account, then come back and log in.</p>
        <button className="auth-btn" onClick={() => { setMode("login"); setConfirmed(false); }}>Back to Login</button>
      </div>
    </div>
  );

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-logo">SEND<span>-AI</span></div>
        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Login</button>
          <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Sign Up</button>
        </div>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="auth-input"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="auth-input"
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        {mode === "signup" && (
          <input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="auth-input"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        )}
        {error && <div className="auth-error">{error}</div>}
        <button className="auth-btn" onClick={handleSubmit} disabled={loading}>
          {loading ? "..." : mode === "login" ? "Login" : "Create Account"}
        </button>
      </div>
    </div>
  );
}