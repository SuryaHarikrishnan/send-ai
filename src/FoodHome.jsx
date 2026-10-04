import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { AmountSheet, GoalsSheet } from "./FoodSheets";
import { DAY_MS, MEALS, amountText, dayKey, dayLabel, foodFromLog, foodsError, logRow, readGoals, saveGoals, startOfDay, totals, weekStart } from "./food";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

const Chevron = ({ left }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={left ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} /></svg>
);
const Plus = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 6v12M6 12h12" /></svg>;
const Scan = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M8 9v6M11 9v6M14 9v6M17 9v6" /></svg>
);

// Progress ring. pct is 0..1+, over the goal it turns sky blue.
function Ring({ pct, size, stroke, children, className = "" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const over = pct > 1;
  return (
    <span className={`fd-ring ${className}`} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="fd-ring-track" strokeWidth={stroke} />
        {pct > 0 && (
          <circle
            cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke}
            className={`fd-ring-fill${over ? " over" : ""}`}
            strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, pct))}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <span className="fd-ring-in">{children}</span>
    </span>
  );
}

function MacroBar({ label, cls, value, goal }) {
  return (
    <div className="fd-mb">
      <span className="fd-mb-l"><i className={`fd-dot ${cls}`} />{label}</span>
      <span className="fd-mb-t"><i className={cls} style={{ width: `${Math.min(1, value / goal) * 100}%` }} /></span>
      <span className="fd-mb-v"><b>{Math.round(value)}</b> / {goal} g</span>
    </div>
  );
}

export default function FoodHome({ user, day, onDay, onAdd, onScan }) {
  const [logs, setLogs] = useState([]);
  const [loaded, setLoaded] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [goals, setGoals] = useState(readGoals);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sheetError, setSheetError] = useState("");
  const [goalsOpen, setGoalsOpen] = useState(false);

  const start = weekStart(day);
  const startMs = start.getTime();

  useEffect(() => {
    let live = true;
    supabase
      .from("food_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("eaten_at", new Date(startMs).toISOString())
      .lt("eaten_at", new Date(startMs + 7 * DAY_MS + 3600000).toISOString())
      .order("eaten_at", { ascending: true })
      .then(({ data, error }) => {
        if (!live) return;
        setLoadError(error ? foodsError(error) : null);
        setLogs(data || []);
        setLoaded(startMs);
      });
    return () => { live = false; };
  }, [user, startMs]);

  const today = startOfDay(new Date());
  const dayLogs = logs.filter(l => dayKey(l.eaten_at) === dayKey(day));
  const t = totals(dayLogs);
  const left = goals.kcal - Math.round(t.kcal);
  const days = DAY_LETTERS.map((letter, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const kcal = totals(logs.filter(l => dayKey(l.eaten_at) === date.toDateString())).kcal;
    return { letter, date, kcal, today: date.getTime() === today.getTime(), future: date > today, sel: date.toDateString() === dayKey(day) };
  });
  const thisWeek = startMs === weekStart(today).getTime();

  async function saveEdit({ unit, amount, meal }) {
    setSaving(true);
    setSheetError("");
    const food = foodFromLog(editing);
    const row = logRow(food, unit, amount, meal, new Date(editing.eaten_at));
    delete row.eaten_at;
    const { data, error } = await supabase.from("food_logs").update(row).eq("id", editing.id).select().single();
    setSaving(false);
    if (error) { setSheetError(`Couldn't save: ${error.message}`); return; }
    setLogs(ls => ls.map(l => (l.id === editing.id ? data : l)));
    setEditing(null);
  }
  async function removeEntry() {
    setSaving(true);
    const { error } = await supabase.from("food_logs").delete().eq("id", editing.id);
    setSaving(false);
    if (error) { setSheetError(`Couldn't remove: ${error.message}`); return; }
    setLogs(ls => ls.filter(l => l.id !== editing.id));
    setEditing(null);
  }

  if (loaded === null) return <div className="coming-soon">Loading...</div>;

  const shift = n => {
    const d = new Date(day);
    d.setDate(d.getDate() + n * 7);
    onDay(d > today ? today : d);
  };

  return (
    <div className="lift fd">
      <header className="lift-head">
        <div>
          <p className="lift-date">{new Date(day).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="lift-title">{dayLabel(day)}</h1>
        </div>
        <div className="fd-head-btns">
          <button className="fd-scan-btn" onClick={() => onScan("snack")} aria-label="Scan a barcode"><Scan /></button>
          <button className="lift-start" onClick={() => onAdd(null)}><Plus />Log food</button>
        </div>
      </header>

      {loadError && (
        <div className="lift-card lift-setup">
          <strong>{loadError.title}</strong>
          <p>{loadError.detail}</p>
        </div>
      )}

      <section className="lift-card fd-week">
        <div className="lift-row">
          <h2 className="fd-week-h">{thisWeek ? "This week" : `Week of ${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}</h2>
          <div className="fd-week-nav">
            <button onClick={() => shift(-1)} aria-label="Previous week"><Chevron left /></button>
            <button onClick={() => shift(1)} disabled={thisWeek} aria-label="Next week"><Chevron /></button>
          </div>
        </div>
        <div className="lift-days">
          {days.map(d => (
            <button
              key={d.date.getTime()}
              className={`lift-day fd-day${d.today ? " today" : ""}${d.sel ? " sel" : ""}`}
              disabled={d.future}
              aria-label={`${d.date.toDateString()}, ${Math.round(d.kcal)} calories`}
              aria-pressed={d.sel}
              onClick={() => onDay(d.date)}
            >
              <span className="lift-dn">{d.today ? "Today" : d.letter}</span>
              <Ring pct={d.kcal / goals.kcal} size={40} stroke={4} className="fd-ring-sm">{d.date.getDate()}</Ring>
            </button>
          ))}
        </div>
      </section>

      <section className="lift-card fd-sum">
        <div className="fd-sum-top">
          <Ring pct={t.kcal / goals.kcal} size={140} stroke={13}>
            <b>{Math.abs(left).toLocaleString()}</b>
            <small>{left >= 0 ? "left" : "over"}</small>
          </Ring>
          <div className="fd-sum-stats">
            <div><span>Goal</span><b>{goals.kcal.toLocaleString()}</b></div>
            <div><span>Eaten</span><b>{Math.round(t.kcal).toLocaleString()}</b></div>
            <button className="fd-goal-btn" onClick={() => setGoalsOpen(true)}>Edit goals</button>
          </div>
        </div>
        <div className="fd-mbs">
          <MacroBar label="Protein" cls="p" value={t.protein} goal={goals.protein} />
          <MacroBar label="Carbs" cls="c" value={t.carbs} goal={goals.carbs} />
          <MacroBar label="Fat" cls="f" value={t.fat} goal={goals.fat} />
        </div>
      </section>

      {MEALS.map(([meal, name]) => {
        const items = dayLogs.filter(l => l.meal === meal);
        const kcal = Math.round(totals(items).kcal);
        return (
          <section key={meal} className={`lift-card fd-meal${items.length ? "" : " empty"}`}>
            <div className="fd-meal-head">
              <div>
                <h2 className="lift-h2">{name}</h2>
                <p className="lift-sub">{items.length ? `${kcal.toLocaleString()} cal` : "Nothing logged"}</p>
              </div>
              <button className="fd-add" onClick={() => onAdd(meal)} aria-label={`Add to ${name}`}><Plus /></button>
            </div>
            {items.length > 0 && (
              <div className="fd-entries">
                {items.map(l => (
                  <button key={l.id} className="fd-entry" onClick={() => { setSheetError(""); setEditing(l); }}>
                    <span className="fd-entry-name">
                      <b>{l.name}</b>
                      <small>{[l.brand, amountText(foodFromLog(l), l.unit, l.amount)].filter(Boolean).join(" · ")}</small>
                    </span>
                    <span className="fd-entry-cal">{Math.round(l.kcal).toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {editing && (
        <AmountSheet
          food={foodFromLog(editing)} unit={editing.unit} amount={Number(editing.amount)} meal={editing.meal}
          editing saving={saving} error={sheetError}
          onSave={saveEdit} onDelete={removeEntry} onCancel={() => setEditing(null)}
        />
      )}
      {goalsOpen && (
        <GoalsSheet
          goals={goals}
          onCancel={() => setGoalsOpen(false)}
          onSave={g => { setGoals(g); saveGoals(g); setGoalsOpen(false); }}
        />
      )}
    </div>
  );
}
