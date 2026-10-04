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
        ctx.strokeStyle = `rgba(170,215,255,${0.04 * opacity})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // lit segments — only up to current progress
        for (let i = 0; i < segmentIndex && i < holds.length - 1; i++) {
          ctx.beginPath();
          ctx.moveTo(holds[i].x, holds[i].y);
          ctx.lineTo(holds[i + 1].x, holds[i + 1].y);
          ctx.strokeStyle = `rgba(170,215,255,${0.5 * opacity})`;
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
          ctx.strokeStyle = `rgba(170,215,255,${0.5 * opacity})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // holds — only light up once line has fully reached them
        holds.forEach((h, i) => {
          ctx.beginPath();
          ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
          if (h.lit) {
            ctx.fillStyle = `rgba(170,215,255,${0.55 * opacity})`;
            ctx.fill();
          } else if (i === segmentIndex) {
            // leading hold — pulse as line approaches
            const pulse = progress > 0.85 ? (progress - 0.85) / 0.15 : 0;
            ctx.fillStyle = `rgba(170,215,255,${pulse * opacity})`;
            ctx.fill();
          } else {
            ctx.strokeStyle = `rgba(255,255,255,${0.12 * opacity})`;
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
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (checking) return <div style={{ background: "#062a63", minHeight: "100vh" }} />;
  if (user) return <Dashboard user={user} />;

  return (
    <div className="root start-root">
      <div className="grain" />
      <RouteCanvas />
      <Auth />
    </div>
  );
}
