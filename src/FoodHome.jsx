import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { AmountSheet, GoalsSheet } from "./FoodSheets";
import { Gauge } from "./FoodCharts";
import { syncReminderInfo } from "./notify";
import { DAY_MS, MEALS, amountText, dayKey, foodFromLog, foodsError, logRow, logStreak, readGoals, saveGoals, startOfDay, totals, weekStart } from "./food";

const Chevron = ({ left }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={left ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} /></svg>
);
const Gear = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6a.5.5 0 0 0 .1-.6l-1.9-3.3a.5.5 0 0 0-.6-.2l-2.4 1a7.3 7.3 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.4h-3.8a.5.5 0 0 0-.5.4l-.4 2.6a7.3 7.3 0 0 0-1.7 1l-2.4-1a.5.5 0 0 0-.6.2L2.5 8.8a.5.5 0 0 0 .1.6l2 1.6a7.5 7.5 0 0 0 0 2l-2 1.6a.5.5 0 0 0-.1.6l1.9 3.3c.1.2.4.3.6.2l2.4-1c.5.4 1.1.7 1.7 1l.4 2.6c0 .2.3.4.5.4h3.8c.2 0 .5-.2.5-.4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.4 1c.2.1.5 0 .6-.2l1.9-3.3a.5.5 0 0 0-.1-.6zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" /></svg>
);
const Flame = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 3c.8 3 4.5 5 4.5 10a4.5 4.5 0 0 1-9 0c0-2.2 1-3.7 2.1-4.7.2 1.4.8 2.4 1.9 2.9-.4-2.7.1-5.4.5-8.2z" /></svg>
);

const isoDay = d => {
  const x = new Date(d);
  return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// A macro's progress toward its goal: "118 / 160 g" over a bar.
function MacroBar({ label, tone, value, goal }) {
  return (
    <div className="fh-macro">
      <span className="fh-macro-top"><span>{label}</span><span>{Math.round(value)} / {goal} g</span></span>
      <span className="fh-macro-bar"><i className={`ft-${tone}`} style={{ width: `${Math.min(100, goal > 0 ? (value / goal) * 100 : 0)}%` }} /></span>
    </div>
  );
}

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const Plus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
);

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
  const [week, setWeek] = useState([]);
  const [open, setOpen] = useState(null);

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

  // Calories for each day of the shown day's week.
  const weekMs = weekStart(day).getTime();
  useEffect(() => {
    supabase
      .from("food_logs")
      .select("kcal, eaten_at")
      .eq("user_id", user.id)
      .gte("eaten_at", new Date(weekMs).toISOString())
      .lt("eaten_at", new Date(weekMs + 8 * DAY_MS).toISOString())
      .then(({ data }) => setWeek(data || []));
  }, [user, weekMs, logs]);

  const dayLogs = logs.filter(l => dayKey(l.eaten_at) === dayKey(day));
  const t = totals(dayLogs);
  const left = goals.kcal - Math.round(t.kcal);
  const streak = logStreak(dates);

  async function saveEdit({ unit, amount, meal, food }) {
    setSaving(true);
    setSheetError("");
    const row = logRow(food || foodFromLog(editing), unit, amount, meal, new Date(editing.eaten_at));
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

  const weekDays = DAY_LETTERS.map((label, i) => {
    const d = new Date(weekMs + i * DAY_MS + 3 * 3600000);
    const kcal = week.filter(r => dayKey(r.eaten_at) === dayKey(d)).reduce((a, r) => a + (Number(r.kcal) || 0), 0);
    return { label, kcal, sel: dayKey(d) === dayKey(day), future: startOfDay(d) > today };
  });
  const logged = weekDays.filter(d => d.kcal > 0);
  const avg = logged.length ? Math.round(logged.reduce((a, d) => a + d.kcal, 0) / logged.length) : 0;
  const barMax = Math.max(goals.kcal * 1.15, ...weekDays.map(d => d.kcal)) || 1;
  const dm = new Date(day).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const head = isToday ? `Today, ${dm}` : dayMs === today.getTime() - DAY_MS ? `Yesterday, ${dm}` : `${new Date(day).toLocaleDateString(undefined, { weekday: "short" })}, ${dm}`;

  return (
    <div className="lift fd">
      <header className="lh-head">
        <div className="lh-date">
          <button onClick={() => shift(-1)} aria-label="Previous day"><Chevron left /></button>
          <label className="fh-pick">
            <h1>{head}</h1>
            <input
              type="date" aria-label="Pick a day" value={isoDay(day)} max={isoDay(today)}
              onChange={e => e.target.value && onDay(new Date(`${e.target.value}T12:00:00`))}
            />
          </label>
          <button onClick={() => shift(1)} disabled={isToday} aria-label="Next day"><Chevron /></button>
        </div>
        <span className="fh-streak"><Flame />{streak} day streak</span>
      </header>

      {loadError && (
        <div className="lift-card lift-setup">
          <strong>{loadError.title}</strong>
          <p>{loadError.detail}</p>
        </div>
      )}

      <section className="fh-rings">
        <Gauge value={t.kcal} goal={goals.kcal} size={176} stroke={13} top={Math.abs(left).toLocaleString()} bottom={left >= 0 ? "Cal left" : "Cal over"} note={`${Math.round(t.kcal).toLocaleString()} of ${goals.kcal.toLocaleString()} eaten`} />
        <div className="fh-macros">
          <MacroBar label="Protein" tone="p" value={loaded ? t.protein : 0} goal={goals.protein} />
          <MacroBar label="Carbs" tone="c" value={loaded ? t.carbs : 0} goal={goals.carbs} />
          <MacroBar label="Fat" tone="f" value={loaded ? t.fat : 0} goal={goals.fat} />
          <button className="fh-goals" onClick={() => setGoalsOpen(true)}><Gear />Goals</button>
        </div>
      </section>

      <section className="lift-card fh-week">
        <div className="lift-row">
          <h2 className="lift-h2">Calories <span className="fh-dim">{weekMs === weekStart(today).getTime() ? "this week" : "that week"}</span></h2>
          <span className="fh-avg">avg <b>{avg.toLocaleString()}</b></span>
        </div>
        <div className="fh-bars" role="img" aria-label={`Calories each day, goal ${goals.kcal.toLocaleString()}, average ${avg.toLocaleString()}`}>
          <em style={{ bottom: `${(goals.kcal / barMax) * 100}%` }} />
          {weekDays.map((d, i) => (
            <i key={i} className={`${d.sel ? "sel" : ""}${d.kcal > goals.kcal ? " over" : ""}`} style={{ height: `${(d.kcal / barMax) * 100}%` }} />
          ))}
        </div>
        <div className="fh-letters">
          {weekDays.map((d, i) => <span key={i} className={d.sel ? "sel" : ""}>{d.label}</span>)}
        </div>
      </section>

      <section className="lift-card fh-meals">
        {MEALS.map(([meal, name]) => {
          const items = dayLogs.filter(l => l.meal === meal);
          const kcal = Math.round(totals(items).kcal);
          const shown = open === meal;
          return (
            <div key={meal} className="fh-meal">
              <div className="fh-meal-row">
                <button className="fh-meal-main" disabled={!items.length} aria-expanded={items.length ? shown : undefined} onClick={() => setOpen(shown ? null : meal)}>
                  <b>{name}</b>
                  <small>{items.length ? items.map(l => l.name).join(", ") : "Nothing yet"}</small>
                </button>
                {items.length > 0 && <span className="fh-kcal">{kcal.toLocaleString()} <small>cal</small></span>}
                <button className="fh-add" onClick={() => onAdd(meal)} aria-label={`Add food to ${name}`}><Plus /></button>
              </div>
              {shown && (
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
            </div>
          );
        })}
      </section>

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
          onSave={g => { setGoals(g); saveGoals(g); syncReminderInfo(user.id); setGoalsOpen(false); }}
        />
      )}
    </div>
  );
}
