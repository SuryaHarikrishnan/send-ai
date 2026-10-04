import { useState } from "react";
import { supabase } from "./supabase";
import BodyMap from "./BodyMap";

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

const SAMPLE_SETS = { chest: 8, deltoids: 11, triceps: 7, "upper-back": 18, biceps: 12, trapezius: 6, quadriceps: 8, gluteal: 9, hamstring: 7, calves: 5, "lower-back": 5, abs: 8, forearm: 14 };

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
            <path d="M8 28 L16 4 L24 28" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11 20 L21 20" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="16" cy="4" r="2.5" fill="#ffffff"/>
          </svg>
          SEND<span>-AI</span>
        </div>
        <button className="start-signin" onClick={signInWithGoogle} disabled={loading}>Sign in</button>
      </nav>

      <main className="start-main">
        <section className="start-copy">
          <h1 className="start-headline">
            Every sport.<br />
            One log.<br />
            <span className="start-accent">Keep the streak.</span>
          </h1>
          <p className="start-pitch">
            Lifting, climbing and whatever you train next, logged in a few taps.
            See every muscle you worked across all your sports on one body map,
            and keep your weekly streak going. Free, and it runs right in your browser.
          </p>

          <div className="start-perk">
            Sign in with Google and log your first session in under a minute.
          </div>

          {error && <div className="auth-error start-error">{error}</div>}
          <button className="start-google" onClick={signInWithGoogle} disabled={loading}>
            <GoogleIcon />
            {loading ? "Redirecting..." : "Continue with Google"}
          </button>

          <p className="start-fine">Free to use · no credit card · works on any phone or laptop · <a href="/privacy.html">Privacy</a></p>
        </section>

        <aside className="start-preview" aria-hidden="true">
          <div className="preview-card">
            <div className="preview-label">THIS WEEK</div>
            <div className="preview-stat">5<span>sessions</span></div>
            <div className="preview-sports"><span>3 lifting</span><span>2 climbing</span></div>
            <div className="preview-body"><BodyMap sets={SAMPLE_SETS} mode="week" small /></div>
            <div className="preview-goal">Most worked: <strong>back</strong> and <strong>forearms</strong></div>
          </div>
          <div className="preview-chip chip-top">6 week streak</div>
          <div className="preview-chip chip-bottom">New PR ✓</div>
        </aside>
      </main>
    </div>
  );
}
