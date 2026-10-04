import { useEffect, useRef, useState } from "react";

// 270° gauge, open at the bottom. Fills with value / goal.
export function Gauge({ value, goal, size = 150, stroke = 14, tone = "kcal", top, bottom }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = c * 0.75;
  const pct = goal > 0 ? value / goal : 0;
  const over = pct > 1;
  const fill = arc * Math.min(1, Math.max(0, pct));
  return (
    <span className={`fg fg-${tone}${over ? " over" : ""}`} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <g transform={`rotate(135 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} className="fg-track" strokeWidth={stroke} strokeDasharray={`${arc} ${c}`} />
          {fill > 0 && (
            <circle cx={size / 2} cy={size / 2} r={r} className="fg-fill" strokeWidth={stroke} strokeDasharray={`${fill} ${c}`} />
          )}
        </g>
      </svg>
      <span className="fg-in">
        <b>{top}</b>
        <small>{bottom}</small>
      </span>
    </span>
  );
}

// Seven bars for a week. A tick on each bar marks the goal.
// days: [{ label, value, today, future, parts?: [{ tone, frac }] }]
export function WeekBars({ days, goal, tone = "kcal" }) {
  const max = Math.max(goal * 1.2, ...days.map(d => d.value)) || 1;
  const goalY = goal ? (goal / max) * 100 : null;
  return (
    <div className="fwb">
      {days.map((d, i) => (
        <div key={i} className={`fwb-col${d.today ? " today" : ""}`}>
          <span className="fwb-bar">
            {d.parts ? (
              d.value > 0 && (
                <span className="fwb-stack">
                  {d.parts.map(p => <i key={p.tone} className={`ft-${p.tone}`} style={{ height: `${p.frac * 100}%` }} />)}
                </span>
              )
            ) : (
              d.value > 0 && <i className={`fwb-fill ft-${tone}${goal && d.value > goal ? " over" : ""}`} style={{ height: `${Math.min(100, (d.value / max) * 100)}%` }} />
            )}
            {goalY != null && !d.parts && <em style={{ bottom: `${goalY}%` }} />}
          </span>
          <span className="fwb-l">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// Solid pie of up to three parts: [{ tone, frac }]
export function Pie({ parts, size = 96 }) {
  const total = parts.reduce((a, p) => a + p.frac, 0);
  const R = size / 2;
  if (!total) return <svg className="fpie" width={size} height={size} aria-hidden="true"><circle cx={R} cy={R} r={R} className="fpie-empty" /></svg>;
  const slices = parts.map((p, i) => {
    const before = parts.slice(0, i).reduce((a, x) => a + x.frac, 0) / total;
    const frac = p.frac / total;
    const a0 = -Math.PI / 2 + before * Math.PI * 2;
    return { tone: p.tone, frac, a0, a1: a0 + frac * Math.PI * 2 };
  });
  return (
    <svg className="fpie" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {slices.map(({ tone, frac, a0, a1 }) => {
        if (frac >= 0.999) return <circle key={tone} cx={R} cy={R} r={R} className={`ft-${tone}`} />;
        if (frac <= 0) return null;
        const d = `M${R},${R} L${R + R * Math.cos(a0)},${R + R * Math.sin(a0)} A${R},${R} 0 ${frac > 0.5 ? 1 : 0} 1 ${R + R * Math.cos(a1)},${R + R * Math.sin(a1)} Z`;
        return <path key={tone} d={d} className={`ft-${tone}`} />;
      })}
    </svg>
  );
}

// Daily bars over a range with a dashed goal line. points: [{ t, v }] oldest first.
export function RangeBars({ points, goal, unit = "cal" }) {
  const wrap = useRef(null);
  const [w, setW] = useState(320);
  const [sel, setSel] = useState(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 180, padR = 44, padB = 24, padT = 26;
  const max = Math.max(goal * 1.25, ...points.map(p => p.v)) || 1;
  const step = max > 4000 ? 1000 : max > 1500 ? 500 : max > 400 ? 100 : max > 150 ? 50 : 25;
  const ticks = [];
  for (let v = step; v < max; v += step) ticks.push(v);
  const thin = (ticks.length > 4 ? ticks.filter((_, i) => i % 2 === 1) : ticks).filter(v => !goal || Math.abs(v - goal) > max * 0.09);
  const n = points.length;
  const plotW = w - padR;
  const bw = plotW / n;
  const y = v => padT + (H - padT - padB) * (1 - v / max);
  const shown = sel ?? (n ? n - 1 : null);
  const fmt = t => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const labels = n ? [0, Math.floor((n - 1) / 2), n - 1] : [];

  function pick(e) {
    const box = e.currentTarget.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - box.left;
    setSel(Math.max(0, Math.min(n - 1, Math.floor(x / bw))));
  }

  return (
    <div className="frb" ref={wrap}>
      <svg width={w} height={H} onMouseMove={pick} onTouchStart={pick} onTouchMove={pick} role="img" aria-label={`Daily ${unit} chart`}>
        {thin.map(v => (
          <g key={v}>
            <line x1={0} x2={plotW} y1={y(v)} y2={y(v)} className="frb-grid" />
            <text x={w - 2} y={y(v) + 4} textAnchor="end" className="frb-axis">{v.toLocaleString()}</text>
          </g>
        ))}
        {points.map((p, i) => p.v > 0 && (
          <rect
            key={p.t} x={i * bw + Math.min(2, bw * 0.15)} width={Math.max(1, bw - Math.min(4, bw * 0.3))}
            y={y(p.v)} height={y(0) - y(p.v)} rx={Math.min(4, bw / 3)}
            className={`frb-bar${i === shown ? " on" : ""}`}
          />
        ))}
        {goal > 0 && (
          <g>
            <line x1={0} x2={plotW} y1={y(goal)} y2={y(goal)} className="frb-goal" />
            <text x={w - 2} y={y(goal) + 4} textAnchor="end" className="frb-axis frb-goal-t">{goal.toLocaleString()}</text>
          </g>
        )}
        {labels.map((i, k) => (
          <text key={k} x={k === 0 ? 0 : k === 2 ? plotW : i * bw + bw / 2} y={H - 4} textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"} className="frb-axis">{fmt(points[i].t)}</text>
        ))}
      </svg>
      {shown != null && points[shown] && (
        <span className="frb-tip" style={{ left: Math.min(Math.max(shown * bw + bw / 2, 34), plotW - 34), top: Math.max(0, y(points[shown].v) - 30) }}>
          {Math.round(points[shown].v).toLocaleString()}
        </span>
      )}
    </div>
  );
}
