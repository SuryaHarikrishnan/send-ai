import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { AmountSheet, GoalsSheet } from "./FoodSheets";
import { Gauge } from "./FoodCharts";
import { DAY_MS, MEALS, MEAL_SPLIT, amountText, dayKey, foodFromLog, foodsError, logRow, logStreak, readGoals, saveGoals, startOfDay, totals } from "./food";

const Chevron = ({ left }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={left ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} /></svg>
);
const Calendar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /><path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" strokeWidth="2.6" /></svg>
);
const Gear = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6a.5.5 0 0 0 .1-.6l-1.9-3.3a.5.5 0 0 0-.6-.2l-2.4 1a7.3 7.3 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.4h-3.8a.5.5 0 0 0-.5.4l-.4 2.6a7.3 7.3 0 0 0-1.7 1l-2.4-1a.5.5 0 0 0-.6.2L2.5 8.8a.5.5 0 0 0 .1.6l2 1.6a7.5 7.5 0 0 0 0 2l-2 1.6a.5.5 0 0 0-.1.6l1.9 3.3c.1.2.4.3.6.2l2.4-1c.5.4 1.1.7 1.7 1l.4 2.6c0 .2.3.4.5.4h3.8c.2 0 .5-.2.5-.4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.4 1c.2.1.5 0 .6-.2l1.9-3.3a.5.5 0 0 0-.1-.6zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" /></svg>
);
const Flame = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 3c.8 3 4.5 5 4.5 10a4.5 4.5 0 0 1-9 0c0-2.2 1-3.7 2.1-4.7.2 1.4.8 2.4 1.9 2.9-.4-2.7.1-5.4.5-8.2z" /></svg>
);
const Target = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>
);

const isoDay = d => {
  const x = new Date(d);
  return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// Macro bar with a tick at the goal, like a fuel gauge with headroom.
function MacroCol({ label, tone, value, goal }) {
  const scale = goal * 1.28;
  return (
    <div className="fm">
      <span className="fm-l">{label}</span>
      <span className="fm-bar">
        <i className={`ft-${tone}`} style={{ width: `${Math.min(100, (value / scale) * 100)}%` }} />
        <em style={{ left: `${(goal / scale) * 100}%` }} />
      </span>
      <span className="fm-v"><b>{Math.round(value)}</b> / {goal}g</span>
    </div>
  );
}

export default function FoodHome({ user, day, onDay, onAdd }) {
  const [logs, setLogs] = useState([]);
  const [dates, setDates] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [goals, setGoals] = useState(readGoals);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sheetError, setSheetError] = useState("");
  const [goalsOpen, setGoalsOpen] = useState(false);

  const dayMs = startOfDay(day).getTime();
  const today = startOfDay(new Date());
  const isToday = dayMs === today.getTime();

  useEffect(() => {
    let live = true;
    supabase
      .from("food_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("eaten_at", new Date(dayMs).toISOString())
      .lt("eaten_at", new Date(dayMs + DAY_MS).toISOString())
      .order("eaten_at", { ascending: true })
      .then(({ data, error }) => {
        if (!live) return;
        setLoadError(error ? foodsError(error) : null);
        setLogs(data || []);
        setLoaded(true);
      });
    return () => { live = false; };
  }, [user, dayMs]);

  // Just the timestamps of the last few months, for the streak.
  useEffect(() => {
    supabase
      .from("food_logs")
      .select("eaten_at")
      .eq("user_id", user.id)
      .gte("eaten_at", new Date(Date.now() - 120 * DAY_MS).toISOString())
      .order("eaten_at", { ascending: false })
      .limit(3000)
      .then(({ data }) => setDates((data || []).map(r => r.eaten_at)));
  }, [user, logs.length]);

  const dayLogs = logs.filter(l => dayKey(l.eaten_at) === dayKey(day));
  const t = totals(dayLogs);
  const left = goals.kcal - Math.round(t.kcal);
  const streak = logStreak(dates);

  async function saveEdit({ unit, amount, meal }) {
    setSaving(true);
    setSheetError("");
    const row = logRow(foodFromLog(editing), unit, amount, meal, new Date(editing.eaten_at));
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

  const shift = n => onDay(new Date(dayMs + n * DAY_MS + 3 * 3600000));

  return (
    <div className="lift fd">
      <div className="fd-date">
        <button onClick={() => shift(-1)} aria-label="Previous day"><Chevron left /></button>
        <label className="fd-date-mid">
          <Calendar />
          <span>{isToday ? "Today" : new Date(day).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
          <input
            type="date" aria-label="Pick a day" value={isoDay(day)} max={isoDay(today)}
            onChange={e => e.target.value && onDay(new Date(`${e.target.value}T12:00:00`))}
          />
        </label>
        <button onClick={() => shift(1)} disabled={isToday} aria-label="Next day"><Chevron /></button>
      </div>

      {loadError && (
        <div className="lift-card lift-setup">
          <strong>{loadError.title}</strong>
          <p>{loadError.detail}</p>
        </div>
      )}

      <section className="lift-card fd-budget">
        <div className="lift-row">
          <h2 className="fd-budget-h">Budget: {goals.kcal.toLocaleString()} cals</h2>
          <button className="fd-gear" onClick={() => setGoalsOpen(true)} aria-label="Edit goals"><Gear /></button>
        </div>
        <div className="fd-budget-mid">
          <div className="fd-side"><span>Food</span><b>{Math.round(t.kcal).toLocaleString()}</b></div>
          <Gauge value={t.kcal} goal={goals.kcal} size={140} stroke={13} top={Math.abs(left).toLocaleString()} bottom={left >= 0 ? "Under" : "Over"} />
          <div className="fd-side"><span>Streak</span><b>{streak}<small> {streak === 1 ? "day" : "days"}</small></b></div>
        </div>
        <div className="fd-macros">
          <MacroCol label="Protein" tone="p" value={loaded ? t.protein : 0} goal={goals.protein} />
          <MacroCol label="Carbs" tone="c" value={loaded ? t.carbs : 0} goal={goals.carbs} />
          <MacroCol label="Fat" tone="f" value={loaded ? t.fat : 0} goal={goals.fat} />
        </div>
      </section>

      {MEALS.map(([meal, name]) => {
        const items = dayLogs.filter(l => l.meal === meal);
        const mt = totals(items);
        const split = MEAL_SPLIT[meal];
        const sug = { kcal: Math.round(goals.kcal * split), protein: Math.round(goals.protein * split), carbs: Math.round(goals.carbs * split), fat: Math.round(goals.fat * split) };
        return (
          <section key={meal} className="lift-card fd-meal">
            <h2 className="lift-h2">{name}</h2>
            <div className="fd-meal-lines">
              {items.length ? (
                <>
                  <p><Flame /><span><b>{Math.round(mt.kcal).toLocaleString()}</b> of {sug.kcal.toLocaleString()} calories suggested</span></p>
                  <p><Target /><span>{Math.round(mt.protein)}g protein · {Math.round(mt.carbs)}g carbs · {Math.round(mt.fat)}g fat</span></p>
                </>
              ) : (
                <>
                  <p><Flame /><span>{sug.kcal.toLocaleString()} calories suggested</span></p>
                  <p><Target /><span>{sug.protein}g protein · {sug.carbs}g carbs · {sug.fat}g fat</span></p>
                </>
              )}
            </div>
            {items.length > 0 && (
              <div className="fd-entries">
                {items.map(l => (
                  <button key={l.id} className="fd-entry" onClick={() => { setSheetError(""); setEditing(l); }}>
                    <span className="fd-entry-name">
                      <b>{l.name}</b>
                      <small>{[l.brand, amountText(foodFromLog(l), l.unit, l.amount)].filter(Boolean).join(" · ")}</small>
                    </span>
                    <span className="fd-entry-cal">{Math.round(l.kcal).toLocaleString()}<small> cal</small></span>
                  </button>
                ))}
              </div>
            )}
            <button className="fd-addfood" onClick={() => onAdd(meal)}>Add Food</button>
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
