import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import Auth from "./Auth";
import "./App.css";
import Dashboard from "./Dashboard";

function RouteCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    function resize() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    const NUM_ROUTES = 8;
    let routes = [];

    function generateRoute(forceX) {
      const numHolds = 14 + Math.floor(Math.random() * 6);
      const xBase = forceX !== undefined ? forceX : 40 + Math.random() * (canvas.width - 80);
      const holds = Array.from({ length: numHolds }, (_, i) => ({
        x: Math.max(20, Math.min(canvas.width - 20, xBase + (Math.random() - 0.5) * 100)),
        y: canvas.height - 40 - (i * (canvas.height - 80) / (numHolds - 1)),
        r: 3 + Math.random() * 4,
        lit: false,
      }));
      return { holds, segmentIndex: 0, progress: 0, fadeOut: false, opacity: 1 };
    }

    // spawn routes evenly across width
    for (let i = 0; i < NUM_ROUTES; i++) {
      const xBase = (canvas.width / NUM_ROUTES) * i + (canvas.width / NUM_ROUTES / 2);
      const r = generateRoute(xBase);
      // stagger start positions
      const startAt = Math.floor(Math.random() * r.holds.length * 0.6);
      r.segmentIndex = startAt;
      for (let j = 0; j < startAt; j++) r.holds[j].lit = true;
      routes.push(r);
    }

    let animId;

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      routes.forEach((route, ri) => {
        const { holds, segmentIndex, progress, opacity } = route;

        // base line — full route faint
        ctx.beginPath();
        ctx.moveTo(holds[0].x, holds[0].y);
        holds.forEach(h => ctx.lineTo(h.x, h.y));
        ctx.strokeStyle = `rgba(200,245,122,${0.04 * opacity})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // lit segments — only up to current progress
        for (let i = 0; i < segmentIndex && i < holds.length - 1; i++) {
          ctx.beginPath();
          ctx.moveTo(holds[i].x, holds[i].y);
          ctx.lineTo(holds[i + 1].x, holds[i + 1].y);
          ctx.strokeStyle = `rgba(200,245,122,${0.5 * opacity})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // currently animating segment
        if (segmentIndex < holds.length - 1) {
          const from = holds[segmentIndex];
          const to = holds[segmentIndex + 1];
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(from.x + (to.x - from.x) * progress, from.y + (to.y - from.y) * progress);
          ctx.strokeStyle = `rgba(200,245,122,${0.5 * opacity})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // holds — only light up once line has fully reached them
        holds.forEach((h, i) => {
          ctx.beginPath();
          ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
          if (h.lit) {
            ctx.fillStyle = `rgba(200,245,122,${0.55 * opacity})`;
            ctx.fill();
          } else if (i === segmentIndex) {
            // leading hold — pulse as line approaches
            const pulse = progress > 0.85 ? (progress - 0.85) / 0.15 : 0;
            ctx.fillStyle = `rgba(200,245,122,${pulse * opacity})`;
            ctx.fill();
          } else {
            ctx.strokeStyle = `rgba(240,237,230,${0.12 * opacity})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });

        // advance animation
        if (!route.fadeOut) {
          route.progress += 0.022;
          if (route.progress >= 1) {
            route.progress = 0;
            // light up the hold the line just reached
            if (route.segmentIndex + 1 < holds.length) {
              holds[route.segmentIndex + 1].lit = true;
            }
            route.segmentIndex++;
            if (route.segmentIndex >= holds.length - 1) {
              route.fadeOut = true;
            }
          }
        } else {
          route.opacity -= 0.012;
          if (route.opacity <= 0) {
            // respawn at same x zone to keep coverage symmetric
            const xBase = (canvas.width / NUM_ROUTES) * ri + (canvas.width / NUM_ROUTES / 2);
            routes[ri] = generateRoute(xBase + (Math.random() - 0.5) * 60);
          }
        }
      });

      animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="route-canvas" />;
}

export default function App() {
  const [showAuth, setShowAuth] = useState(false);
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setChecking(false);
    });
    supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
  }, []);

  if (checking) return <div style={{ background: "#0a0a0a", minHeight: "100vh" }} />;
  if (user) return <Dashboard user={user} />;
  if (showAuth) return <Auth onAuth={(user) => setUser(user)} />;

  async function handleJoin() {
    if (!email || !email.includes("@")) {
      setError(true);
      setTimeout(() => setError(false), 1500);
      return;
    }
    try {
      await fetch("https://tally.so/r/vGzOQ8", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch (e) {
      console.error(e);
    }
    setSubmitted(true);
  }

  return (
    <div className="root">
      <div className="grain" />
      <RouteCanvas />

      <nav>
        <div className="logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M8 28 L16 4 L24 28" stroke="#c8f57a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11 20 L21 20" stroke="#c8f57a" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="16" cy="4" r="2.5" fill="#c8f57a"/>
          </svg>
          SEND<span>-AI</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button className="login-nav-btn" onClick={() => setShowAuth(true)}>Login</button>
          <div className="stealth-badge">
            <div className="dot" />
            Stealth
          </div>
        </div>
      </nav>

      <div className="hero">
        <div className="hero-content">
          <div className="eyebrow">AI-Powered Climbing Coach</div>
          <h1>TRAIN<br />SMARTER.<br /><span className="accent">SEND</span><br />HARDER.</h1>
          <p className="hero-sub">
            Log your sessions. Understand your weaknesses. Get a personalized training plan. Never plateau again.
          </p>

          {!submitted ? (
            <>
              <div className="waitlist">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={error ? "input-error" : ""}
                />
                <button onClick={handleJoin}>Join Waitlist</button>
              </div>
              <div className="sub-note">Early access. No spam. We're building in stealth.</div>
            </>
          ) : (
            <div className="success-msg">✓ You're on the list. We'll be in touch.</div>
          )}

          <div className="stats">
            <div className="stat"><span className="stat-num">VB→V17</span><span className="stat-label">All grades</span></div>
            <div className="stat-divider" />
            <div className="stat"><span className="stat-num">AI</span><span className="stat-label">Coached</span></div>
            <div className="stat-divider" />
            <div className="stat"><span className="stat-num">0→</span><span className="stat-label">Your next grade</span></div>
          </div>
        </div>
      </div>

      <div className="divider" />

      <div className="features">
        <div className="features-label">What we're building</div>
        <div className="features-grid">
          {[
            { icon: "📈", title: "Session Logging", desc: "Track routes, grades, attempts, hold types, and how you felt. Your data, structured." },
            { icon: "🧠", title: "Plateau Diagnosis", desc: "AI analyzes your history and tells you exactly why you're stuck and what to fix." },
            { icon: "📅", title: "Training Plans", desc: "Periodized plans built around your goal grade, timeline, and weak points." },
            { icon: "📰", title: "Climbing News", desc: "Gear drops, first ascents, V17s. The climbing world, summarized daily." },
            { icon: "🏆", title: "Pro Tracker", desc: "Follow the world's best. Recent ascents, rankings, and notable sends." },
            { icon: "📊", title: "Route Analytics", desc: "See which styles you crush and which you avoid. Fix the gaps, not the symptoms." },
            { icon: "🗺️", title: "Crag Finder", desc: "Discover new crags near you with AI-curated route recommendations based on your level." },
            { icon: "💪", title: "Strength Tracking", desc: "Log hangboard sessions, campus board reps, and finger strength benchmarks over time." },
          ].map((f) => (
            <div className="feature" key={f.title}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bottom-bar">
        <span>© 2026 Send-AI</span>
        <span>Building something real for climbers</span>
      </div>
    </div>

  );
}

