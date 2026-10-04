import { useEffect, useRef, useState } from "react";

const ROW = 40;   // height of one wheel row in px
const SHOWN = 5;  // rows visible in each wheel

// One iOS-style scroll wheel. Snaps to a row and reports the row under the band.
function Wheel({ count, value, onChange, label }) {
  const ref = useRef(null);
  const timer = useRef(0);
  const [live, setLive] = useState(value);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = value * ROW;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const i = Math.max(0, Math.min(count - 1, Math.round(ref.current.scrollTop / ROW)));
    setLive(i);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(i), 80);
  };

  const step = (d) => {
    const i = Math.max(0, Math.min(count - 1, live + d));
    ref.current.scrollTo({ top: i * ROW, behavior: "smooth" });
  };

  return (
    <div className="dp-col">
      <div
        className="dp-wheel" ref={ref} onScroll={onScroll} tabIndex={0}
        role="spinbutton" aria-label={label} aria-valuemin={0} aria-valuemax={count - 1} aria-valuenow={live}
        onKeyDown={e => {
          if (e.key === "ArrowUp") { e.preventDefault(); step(-1); }
          if (e.key === "ArrowDown") { e.preventDefault(); step(1); }
        }}
      >
        {Array.from({ length: count }, (_, i) => {
          const d = Math.abs(i - live);
          return (
            <div
              key={i} className={`dp-item${d === 0 ? " on" : ""}`}
              style={{ opacity: d === 0 ? 1 : Math.max(0.15, 0.6 - d * 0.18), transform: `scale(${d === 0 ? 1 : Math.max(0.82, 1 - d * 0.07)})` }}
              onClick={() => ref.current.scrollTo({ top: i * ROW, behavior: "smooth" })}
            >{i}</div>
          );
        })}
      </div>
      <span className="dp-unit">{label}</span>
    </div>
  );
}

// Bottom sheet with hours + minutes wheels, like the iPhone Clock timer.
export default function DurationPicker({ minutes, onDone, onCancel }) {
  const start = minutes > 0 ? minutes : 60;
  const [h, setH] = useState(Math.min(5, Math.floor(start / 60)));
  const [m, setM] = useState(start % 60);

  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="sheet-wrap" onClick={onCancel}>
      <div className="sheet dp" role="dialog" aria-label="Workout length" onClick={e => e.stopPropagation()}>
        <span className="sheet-grab" />
        <div className="dp-head">
          <button onClick={onCancel}>Cancel</button>
          <b>Workout length</b>
          <button className="dp-done" onClick={() => onDone(h * 60 + m)}>Done</button>
        </div>
        <div className="dp-wheels" style={{ height: ROW * SHOWN }}>
          <div className="dp-band" style={{ height: ROW, top: ROW * 2 }} />
          <Wheel count={6} value={h} onChange={setH} label="hours" />
          <Wheel count={60} value={m} onChange={setM} label="min" />
        </div>
      </div>
    </div>
  );
}
