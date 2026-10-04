import { useState } from "react";
import { supabase } from "./supabase";

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
    </svg>
  );
}

const WEEK = [
  { day: "M", sends: 2 },
  { day: "T", sends: 0 },
  { day: "W", sends: 4 },
  { day: "T", sends: 1 },
  { day: "F", sends: 0 },
  { day: "S", sends: 5 },
  { day: "S", sends: 3 },
];

export default function Auth() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    // On success the browser redirects to Google, so we only land here on failure.
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <div className="start">
      <nav className="start-nav">
        <div className="logo">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <path d="M8 28 L16 4 L24 28" stroke="#c8f57a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11 20 L21 20" stroke="#c8f57a" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="16" cy="4" r="2.5" fill="#c8f57a"/>
          </svg>
          SEND<span>-AI</span>
        </div>
        <button className="start-signin" onClick={signInWithGoogle} disabled={loading}>Sign in</button>
      </nav>

      <main className="start-main">
        <section className="start-copy">
          <h1 className="start-headline">
            LOG CLIMBS.<br />
            TRACK PROGRESS.<br />
            <span className="start-accent">SEND HARDER.</span>
          </h1>
          <p className="start-pitch">
            Track your sessions, see which holds and angles are holding you back,
            and get a training plan from an AI coach that knows your climbing.
            Works right in your browser.
          </p>

          <div className="start-perk">
            🧗 Sign in with Google and get your first AI training plan after your first session.
          </div>

          {error && <div className="auth-error start-error">{error}</div>}
          <button className="start-google" onClick={signInWithGoogle} disabled={loading}>
            <GoogleIcon />
            {loading ? "Redirecting..." : "Continue with Google"}
          </button>

          <p className="start-fine">Free to use · no credit card · works on any phone or laptop</p>
        </section>

        <aside className="start-preview" aria-hidden="true">
          <div className="preview-card">
            <div className="preview-label">THIS WEEK</div>
            <div className="preview-stat">15<span>sends</span></div>
            <div className="preview-chart">
              {WEEK.map((d, i) => (
                <div key={i} className="preview-col">
                  <div className="preview-bar" style={{ height: `${10 + d.sends * 16}px` }} />
                  <div className="preview-day">{d.day}</div>
                </div>
              ))}
            </div>
            <div className="preview-goal">Top send <strong>V5</strong> · next goal V6</div>
          </div>
          <div className="preview-chip chip-top">+3 sends</div>
          <div className="preview-chip chip-bottom">New PR ✓</div>
        </aside>
      </main>
    </div>
  );
}
