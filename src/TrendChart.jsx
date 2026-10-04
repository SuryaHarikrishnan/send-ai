import { useEffect, useRef, useState } from "react";

const PAD = { l: 44, r: 14, t: 14, b: 26 };
const H = 190;

// Round axis ticks: steps of 1, 2, 2.5 or 5 times a power of ten.
function niceTicks(min, max, count = 4) {
  if (min === max) { min -= 5; max += 5; }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

const fmtDate = (t, withDay) =>
  new Date(t).toLocaleDateString(undefined, withDay ? { month: "short", day: "numeric" } : { month: "short" });

// Line chart of one series over time, with a crosshair and tooltip.
// points: [{ t: ms, v: number, pr: bool, detail: string }] oldest first.
export default function TrendChart({ points, unit, label }) {
  const wrap = useRef(null);
  const [w, setW] = useState(320);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!points.length) return <div className="tc" ref={wrap} />;

  const vals = points.map(p => p.v);
  const ticks = niceTicks(Math.min(...vals), Math.max(...vals));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const t0 = points[0].t, t1 = points[points.length - 1].t;
  const span = t1 - t0;
  const iw = w - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const x = t => PAD.l + (span ? ((t - t0) / span) * iw : iw / 2);
  const y = v => PAD.t + ih - ((v - y0) / (y1 - y0 || 1)) * ih;

  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const area = points.length > 1 ? `${line}L${x(t1).toFixed(1)},${PAD.t + ih}L${x(t0).toFixed(1)},${PAD.t + ih}Z` : "";
  const showDots = points.length <= 40;

  const xTicks = span ? [0, 1 / 3, 2 / 3, 1].map(f => t0 + f * span) : [t0];
  const withDay = span < 200 * 86400000;

  function nearest(clientX) {
    const r = wrap.current.getBoundingClientRect();
    const px = clientX - r.left;
    let best = 0;
    points.forEach((p, i) => { if (Math.abs(x(p.t) - px) < Math.abs(x(points[best].t) - px)) best = i; });
    return best;
  }
  function onKey(e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const cur = hover ?? points.length - 1;
    setHover(Math.min(points.length - 1, Math.max(0, cur + (e.key === "ArrowRight" ? 1 : -1))));
  }

  const hp = hover != null ? points[hover] : null;
  const tipLeft = hp ? Math.min(Math.max(x(hp.t), 70), w - 70) : 0;

  return (
    <div className="tc" ref={wrap}>
      <svg
        width={w} height={H} viewBox={`0 0 ${w} ${H}`}
        role="img" aria-label={`${label} over time. Use left and right arrow keys to read each session.`}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
        onPointerMove={e => setHover(nearest(e.clientX))}
        onPointerDown={e => setHover(nearest(e.clientX))}
        onPointerLeave={e => e.pointerType === "mouse" && setHover(null)}
      >
        <defs>
          <linearGradient id="tc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map(v => (
          <g key={v}>
            <line className="tc-grid" x1={PAD.l} x2={w - PAD.r} y1={y(v)} y2={y(v)} />
            <text className="tc-axis" x={PAD.l - 8} y={y(v)} dy="0.32em" textAnchor="end">{v.toLocaleString()}</text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text key={i} className="tc-axis" x={x(t)} y={H - 6}
            textAnchor={xTicks.length === 1 ? "middle" : i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}>
            {fmtDate(t, withDay)}
          </text>
        ))}
        {area && <path d={area} fill="url(#tc-fill)" />}
        {points.length > 1 && <path className="tc-line" d={line} />}
        {hp && <line className="tc-cross" x1={x(hp.t)} x2={x(hp.t)} y1={PAD.t} y2={PAD.t + ih} />}
        {points.map((p, i) =>
          (showDots || p.pr || i === hover || points.length === 1) && (
            <circle key={i} className={`tc-dot${p.pr ? " pr" : ""}${i === hover ? " on" : ""}`} cx={x(p.t)} cy={y(p.v)} r={i === hover ? 6 : 4} />
          ))}
      </svg>
      {hp && (
        <div className="tc-tip" style={{ left: tipLeft, top: Math.max(0, y(hp.v) - 12) }} role="status">
          <small>{new Date(hp.t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</small>
          <b>{hp.v.toLocaleString()} {unit}{hp.pr && <span className="lift-pr">PR</span>}</b>
          {hp.detail && <small>{hp.detail}</small>}
        </div>
      )}
    </div>
  );
}

// Tiny trend line for list rows.
export function Sparkline({ values }) {
  if (values.length < 2) return <svg className="tc-spark" viewBox="0 0 72 28" aria-hidden="true"><circle cx="68" cy="14" r="3" /></svg>;
  const lo = Math.min(...values), hi = Math.max(...values);
  const pts = values.map((v, i) => [4 + (i / (values.length - 1)) * 64, 24 - ((v - lo) / (hi - lo || 1)) * 20]);
  const last = pts[pts.length - 1];
  return (
    <svg className="tc-spark" viewBox="0 0 72 28" aria-hidden="true">
      <polyline points={pts.map(p => p.map(n => n.toFixed(1)).join(",")).join(" ")} />
      <circle cx={last[0]} cy={last[1]} r="3" />
    </svg>
  );
}
