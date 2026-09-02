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
  const [authMode, setAuthMode] = useState("login");
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

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
  if (showAuth) return <Auth onAuth={(user) => setUser(user)} initialMode={authMode} />;

  function openAuth(mode) {
    setAuthMode(mode);
    setShowAuth(true);
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
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button className="login-nav-btn" onClick={() => openAuth("login")}>Log In</button>
          <button className="cta-primary nav-cta" onClick={() => openAuth("signup")}>Get Started</button>
        </div>
      </nav>

      <div className="hero">
        <div className="hero-content">
          <div className="eyebrow">AI-Powered Climbing Coach</div>
          <h1>TRAIN<br />SMARTER.<br /><span className="accent">SEND</span><br />HARDER.</h1>
          <p className="hero-sub">
            Log your sessions. Understand your weaknesses. Get a personalized training plan. Never plateau again.
          </p>

          <div className="hero-ctas">
            <button className="cta-primary" onClick={() => openAuth("signup")}>Get Started Free</button>
            <a href="#showcase" className="cta-secondary">See What It Does</a>
          </div>
          <div className="sub-note">Free to use. No credit card required.</div>

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

      <div className="showcase" id="showcase">
        <div className="showcase-label">What you can do with Send-AI</div>
        <div className="showcase-title">Everything below is live. Not a mockup of what's coming — what's already here.</div>

        <div className="showcase-row">
          <div className="showcase-text">
            <div className="showcase-eyebrow">Log Climbs</div>
            <h3>Track Every Session</h3>
            <p>Log grade, style, wall angle, hold type, attempts, and whether you sent it — right after you get off the wall. Your climbing history, structured and searchable, not scattered across notes and memory.</p>
          </div>
          <div className="showcase-visual">
            <div className="mockup-frame">
              <div className="home-card-title" style={{ marginBottom: "1rem" }}>Recent Climbs</div>
              <div className="recent-climb-row">
                <span className="recent-grade">V5</span>
                <span className="recent-meta">boulder · overhang · crimp</span>
                <span className="recent-sent sent">✓ Sent</span>
              </div>
              <div className="recent-climb-row">
                <span className="recent-grade">V4</span>
                <span className="recent-meta">boulder · vertical · sloper</span>
                <span className="recent-sent sent">✓ Sent</span>
              </div>
              <div className="recent-climb-row">
                <span className="recent-grade">V6</span>
                <span className="recent-meta">boulder · cave · pinch</span>
                <span className="recent-sent unsent">✗ Unsent</span>
              </div>
            </div>
          </div>
        </div>

        <div className="showcase-row reverse">
          <div className="showcase-text">
            <div className="showcase-eyebrow">AI Coaching</div>
            <h3>Know Why You're Stuck</h3>
            <p>Send-AI analyzes your logged climbs to diagnose exactly why you're plateauing, then builds a personalized 4-week training plan to break through it — grounded in your data, not generic advice.</p>
          </div>
          <div className="showcase-visual">
            <div className="mockup-frame">
              <div className="ai-response" style={{ border: "none", background: "transparent", padding: 0 }}>
                <p className="ai-heading">WHY YOU'RE PLATEAUING</p>
                <p className="ai-line">You're sending overhangs at a 78% rate but crimps are dragging you down at 31% — that's your ceiling, not your grade.</p>
                <p className="ai-heading">TOP 3 WEAKNESSES</p>
                <p className="ai-line">1. Crimp strength — low send rate on small holds.</p>
                <p className="ai-line">2. Slab confidence — barely attempted.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="showcase-row">
          <div className="showcase-text">
            <div className="showcase-eyebrow">Analytics</div>
            <h3>See The Real Pattern</h3>
            <p>Send rate by grade, hold type, and wall angle — surfaced automatically from your logs. Find out you're crushing overhangs but avoiding slab before it costs you a season.</p>
          </div>
          <div className="showcase-visual">
            <div className="mockup-frame">
              <div className="analytics-card-title" style={{ marginBottom: "1.25rem" }}>Send Rate by Grade</div>
              <div className="bar-row">
                <span className="bar-label">V3</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: "85%", background: "#c8f57a" }} /></div>
                <span className="bar-val">85%</span>
              </div>
              <div className="bar-row">
                <span className="bar-label">V4</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: "60%", background: "rgba(200,245,122,0.5)" }} /></div>
                <span className="bar-val">60%</span>
              </div>
              <div className="bar-row">
                <span className="bar-label">V5</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: "30%", background: "rgba(200,245,122,0.2)" }} /></div>
                <span className="bar-val">30%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="showcase-row reverse">
          <div className="showcase-text">
            <div className="showcase-eyebrow">Stay Plugged In</div>
            <h3>Climbing News, Curated</h3>
            <p>Daily gear drops, first ascents, and a hand-picked video of the week — pulled from top climbing publications so you don't have to go looking for it.</p>
          </div>
          <div className="showcase-visual">
            <div className="mockup-frame">
              <div className="article-card" style={{ cursor: "default" }}>
                <div className="article-image" style={{ background: "rgba(200,245,122,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "#c8f57a", fontSize: "20px" }}>📰</div>
                <div className="article-body">
                  <div className="article-meta">Curated · Daily</div>
                  <div className="article-title">Gear drops, first ascents, and community news</div>
                  <div className="article-desc">Refreshed every day from top climbing publications, right inside the app.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <button className="cta-primary" onClick={() => openAuth("signup")}>Get Started Free</button>
        </div>
      </div>

      <div className="bottom-bar">
        <span>© 2026 Send-AI</span>
        <span>Log climbs. Get coached. Send harder.</span>
      </div>
    </div>

  );
}

