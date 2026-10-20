// A score ring: a ticked dial around the edge and a solid arc that fills with value / goal.
// color is any CSS color; the number and label sit in the middle.
export default function Ring({ value, goal, size = 140, stroke = 8, color = "#5ef0d8", over = false, top, bottom, note, label, className = "" }) {
  const mid = size / 2;
  const tickR = mid - 3;
  const r = mid - 10 - stroke / 2;
  const c = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(1, Math.max(0, value / goal)) : 0;
  return (
    <span className={`ring${over ? " over" : ""} ${className}`.trim()} style={{ width: size, height: size, "--ring": color }} role={label ? "img" : undefined} aria-label={label}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle cx={mid} cy={mid} r={tickR} className="ring-ticks" strokeWidth={size > 110 ? 5 : 3.5} strokeDasharray={size > 110 ? "1.2 3.2" : "1 2.4"} />
        <circle cx={mid} cy={mid} r={r} className="ring-track" strokeWidth={stroke} />
        {pct > 0 && (
          <circle cx={mid} cy={mid} r={r} className="ring-fill" strokeWidth={stroke} strokeDasharray={`${c * pct} ${c}`} transform={`rotate(-90 ${mid} ${mid})`} />
        )}
      </svg>
      <span className="ring-in">
        <b style={{ fontSize: Math.round(size * (size < 100 ? 0.28 : 0.26)) }}>{top}</b>
        {bottom && <small>{bottom}</small>}
        {note && <em>{note}</em>}
      </span>
    </span>
  );
}
