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

const LIFT_SETS = { chest: 7, deltoids: 7, triceps: 6, abs: 1 };
const CLIMB_GRADES = [["V2", 2], ["V3", 3], ["V4", 3], ["V5", 1]];
const MACROS = [["Protein", 142, 80], ["Carbs", 196, 62], ["Fat", 58, 45]];

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
          <img className="logo-mark" src="/logo.png" width="30" height="30" alt="" />
          <span className="wordmark">SENDIT</span>
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

        <aside className="deck" aria-label="Sports you can track">
          <div className="deck-card deck-lift">
            <div className="deck-top"><span className="deck-sport">Lifting</span><span className="deck-when">Today</span></div>
            <div className="deck-big">Push day</div>
            <div className="deck-body"><BodyMap sets={LIFT_SETS} mode="workout" small /></div>
            <div className="deck-line">Bench press 4 × 8 · 165 lb <span className="deck-pr">PR</span></div>
          </div>

          <div className="deck-card deck-climb">
            <div className="deck-top"><span className="deck-sport">Climbing</span><span className="deck-when">Sat</span></div>
            <div className="deck-big">9 <small>sends</small></div>
            <div className="deck-grades">
              {CLIMB_GRADES.map(([g, n]) => (
                <div key={g}><i style={{ height: `${n * 10}px` }} /><span>{g}</span></div>
              ))}
            </div>
            <div className="deck-line">Top send <b>V5</b></div>
          </div>

          <div className="deck-card deck-run">
            <div className="deck-top"><span className="deck-sport">Running</span><span className="deck-soon">Soon</span></div>
            <div className="deck-big">5.2 <small>km</small></div>
            <svg className="deck-route" viewBox="0 0 200 70" preserveAspectRatio="none" aria-hidden="true">
              <path d="M6 58 C30 58 28 18 58 20 S90 54 116 44 S140 8 166 14 S192 40 194 30" />
              <circle cx="6" cy="58" r="4" /><circle cx="194" cy="30" r="4" />
            </svg>
            <div className="deck-line">26:41 · 5:08 per km</div>
          </div>

          <div className="deck-card deck-food">
            <div className="deck-top"><span className="deck-sport">Food</span><span className="deck-soon">Soon</span></div>
            <div className="deck-big">1,840 <small>kcal</small></div>
            <div className="deck-macros">
              {MACROS.map(([name, g, pct]) => (
                <div key={name}><span>{name}</span><i><b style={{ width: `${pct}%` }} /></i><span>{g} g</span></div>
              ))}
            </div>
          </div>

          <div className="deck-chip">6 week streak</div>
        </aside>
      </main>
    </div>
  );
}
