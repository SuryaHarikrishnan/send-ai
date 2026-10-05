import { useEffect, useState } from "react";
import { MEALS, PHOTO_LIMIT, amountText, customFood, foodEmoji, mealSingular, nutrition, photoFood } from "./food";

export const FoodIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21c-4.5 0-7.5-3.8-7.5-8.2 0-3.4 2.3-5.3 4.6-5.3 1.3 0 2.1.5 2.9.5s1.6-.5 2.9-.5c2.3 0 4.6 1.9 4.6 5.3 0 4.4-3 8.2-7.5 8.2zM12 7.5c0-2 1-3.5 3-4" /></svg>
);
const Close = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>;

// Every food gets an emoji, never a product photo, so lists look even.
export function Thumb({ food, size = 46 }) {
  return <span className="fd-thumb fd-thumb-emoji" style={{ width: size, height: size, fontSize: size * 0.62 }} aria-hidden="true">{foodEmoji(food)}</span>;
}

function useEscape(fn) {
  useEffect(() => {
    const onKey = e => e.key === "Escape" && fn();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fn]);
}

function Sheet({ label, onCancel, children }) {
  useEscape(onCancel);
  return (
    <div className="sheet-wrap" onClick={onCancel}>
      <div className="sheet fd-sheet" role="dialog" aria-modal="true" aria-label={label} onClick={e => e.stopPropagation()}>
        <span className="sheet-grab" />
        {children}
      </div>
    </div>
  );
}

function MealChips({ meal, onChange }) {
  return (
    <div className="fd-meals" role="group" aria-label="Meal">
      {MEALS.map(([id]) => (
        <button key={id} className={meal === id ? "on" : ""} aria-pressed={meal === id} onClick={() => onChange(id)}>{mealSingular(id)}</button>
      ))}
    </div>
  );
}

function Macros({ n }) {
  return (
    <div className="fd-macro-tiles">
      <div><b>{Math.round(n.protein)}<small> g</small></b><span><i className="fd-dot p" />Protein</span></div>
      <div><b>{Math.round(n.carbs)}<small> g</small></b><span><i className="fd-dot c" />Carbs</span></div>
      <div><b>{Math.round(n.fat)}<small> g</small></b><span><i className="fd-dot f" />Fat</span></div>
    </div>
  );
}

const isWeightUnit = u => u && ["g", "oz", "ml", "floz"].includes(u.id);
const stepFor = u => (u?.id === "g" || u?.id === "ml" ? 10 : u?.id === "oz" || u?.id === "floz" ? 1 : 0.5);
const roundFor = (u, v) => (u.id === "g" || u.id === "ml" ? Math.round(v) : isWeightUnit(u) ? Math.round(v * 10) / 10 : Math.max(0.25, Math.round(v * 4) / 4));

// Pick how much of a food, see its calories and macros, then add or save it.
export function AmountSheet({ food, unit: unit0, amount: amount0, meal: meal0, editing, saving, error, onSave, onDelete, onCancel }) {
  const [unitId, setUnitId] = useState(unit0 || food.defaultUnit || food.units[0].id);
  const [amount, setAmount] = useState(String(amount0 ?? food.defaultAmount ?? 1));
  const [meal, setMeal] = useState(meal0);
  const [confirm, setConfirm] = useState(false);
  const unit = food.units.find(u => u.id === unitId) || food.units[0];
  const n = nutrition(food, unit.id, amount);
  const valid = Number(amount) > 0;

  function changeUnit(next) {
    const to = food.units.find(u => u.id === next);
    if (unit.g && to.g && Number(amount) > 0) setAmount(String(roundFor(to, (Number(amount) * unit.g) / to.g)));
    else if (!isWeightUnit(to)) setAmount("1");
    setUnitId(next);
  }
  function bump(dir) {
    const s = stepFor(unit);
    const v = Number(amount) || 0;
    const next = dir > 0 ? Math.floor(v / s + 1e-9) * s + s : Math.ceil(v / s - 1e-9) * s - s;
    setAmount(String(Math.max(isWeightUnit(unit) ? 1 : 0.25, Math.round(next * 100) / 100)));
  }

  return (
    <Sheet label={food.name} onCancel={onCancel}>
      <div className="fd-sh-head">
        <Thumb food={food} size={52} />
        <div className="fd-sh-name">
          <b>{food.name}</b>
          {food.brand && <small>{food.brand}</small>}
        </div>
        <button className="fd-x" onClick={onCancel} aria-label="Close"><Close /></button>
      </div>

      <div className="fd-sh-cal">
        <b>{n.kcal.toLocaleString()}</b><span>calories</span>
        <em>{amountText(food, unit.id, amount || 0)}{unit.g && !isWeightUnit(unit) ? ` · ${Math.round(unit.g * (Number(amount) || 0))} ${food.units.some(u => u.id === "ml") ? "ml" : "g"}` : ""}</em>
      </div>
      <Macros n={n} />

      <div className="fd-amt">
        <div className="fd-amt-row">
          <button onClick={() => bump(-1)} aria-label="Less">−</button>
          <input
            type="number" inputMode="decimal" min="0" step="any" value={amount} aria-label="Amount"
            onChange={e => setAmount(e.target.value)} onFocus={e => e.target.select()}
          />
          <button onClick={() => bump(1)} aria-label="More">+</button>
        </div>
        <div className="fd-units" role="group" aria-label="Unit">
          {food.units.map(u => (
            <button key={u.id} className={u.id === unit.id ? "on" : ""} aria-pressed={u.id === unit.id} onClick={() => changeUnit(u.id)}>
              {u.label}{u.hint ? <small>{u.hint}</small> : null}
            </button>
          ))}
        </div>
      </div>

      <MealChips meal={meal} onChange={setMeal} />

      {error && <p className="wl-error">{error}</p>}
      <button className="fd-primary" disabled={!valid || saving} onClick={() => onSave({ unit: unit.id, amount: Number(amount), meal })}>
        {saving ? "Saving…" : editing ? "Save" : `Add to ${mealSingular(meal)}`}
      </button>
      {editing && (
        confirm ? (
          <div className="fd-del-ask">
            <span>Remove from your log?</span>
            <button onClick={onDelete} disabled={saving}>Remove</button>
            <button onClick={() => setConfirm(false)}>Keep</button>
          </div>
        ) : (
          <button className="fd-del" onClick={() => setConfirm(true)}>Remove from log</button>
        )
      )}
      {food.source === "off" && <p className="fd-src">Nutrition from Open Food Facts{food.barcode ? ` · ${food.barcode}` : ""}</p>}
      {food.source === "fatsecret" && <p className="fd-src"><a href="https://www.fatsecret.com" target="_blank" rel="noreferrer">Powered by fatsecret</a></p>}
      {food.source === "usda" && <p className="fd-src">Nutrition from USDA FoodData Central{food.barcode ? ` · ${food.barcode}` : ""}</p>}
      {food.source === "common" && <p className="fd-src">Typical values for this food</p>}
      {food.source === "photo" && <p className="fd-src">AI estimate from a meal photo</p>}
    </Sheet>
  );
}

// Type in a food from its label: calories and macros per serving.
export function CustomSheet({ initial, meal: meal0, saving, error, onSave, onCancel }) {
  const [f, setF] = useState({ name: "", brand: "", serving: "", kcal: "", protein: "", carbs: "", fat: "", ...initial });
  const [meal, setMeal] = useState(meal0);
  const set = k => e => setF(x => ({ ...x, [k]: e.target.value }));
  const fromMacros = Math.round((Number(f.protein) || 0) * 4 + (Number(f.carbs) || 0) * 4 + (Number(f.fat) || 0) * 9);
  const kcal = f.kcal === "" ? fromMacros : Number(f.kcal);
  const nums = ["kcal", "protein", "carbs", "fat"].map(k => Number(f[k]) || 0);
  const problem = nums.some(v => v < 0) ? "Calories and macros can't be negative."
    : kcal > 5000 ? `${kcal.toLocaleString()} calories in one serving looks like a typo.`
    : nums.slice(1).some(v => v > 500) ? "Over 500 g of a macro in one serving looks like a typo." : "";
  const valid = f.name.trim() && (f.kcal !== "" || fromMacros > 0) && !problem;

  return (
    <Sheet label="Create a food" onCancel={onCancel}>
      <div className="fd-sh-title">
        <h2>Create a food</h2>
        <button className="fd-x" onClick={onCancel} aria-label="Close"><Close /></button>
      </div>
      {f.barcode && <p className="fd-sh-note">Barcode {f.barcode} isn't in our food databases yet. Copy the numbers from the label and it'll be in your recent foods next time.</p>}
      <div className="fd-form">
        <label className="fd-wide">Name<input value={f.name} onChange={set("name")} placeholder="Chicken burrito bowl" maxLength={80} autoFocus={!f.name} /></label>
        <label>Brand<input value={f.brand} onChange={set("brand")} placeholder="Optional" maxLength={60} /></label>
        <label>Serving<input value={f.serving} onChange={set("serving")} placeholder="bowl, bar, slice" maxLength={30} /></label>
        <p className="fd-form-h">Per serving</p>
        <label>Calories<input type="number" inputMode="decimal" min="0" value={f.kcal} onChange={set("kcal")} placeholder={fromMacros ? String(fromMacros) : "0"} /></label>
        <label>Protein (g)<input type="number" inputMode="decimal" min="0" value={f.protein} onChange={set("protein")} placeholder="0" /></label>
        <label>Carbs (g)<input type="number" inputMode="decimal" min="0" value={f.carbs} onChange={set("carbs")} placeholder="0" /></label>
        <label>Fat (g)<input type="number" inputMode="decimal" min="0" value={f.fat} onChange={set("fat")} placeholder="0" /></label>
      </div>
      <MealChips meal={meal} onChange={setMeal} />
      {(problem || error) && <p className="wl-error">{problem || error}</p>}
      <button
        className="fd-primary" disabled={!valid || saving}
        onClick={() => onSave(customFood({ ...f, kcal }), meal)}
      >
        {saving ? "Saving…" : `Add to ${mealSingular(meal)}`}
      </button>
    </Sheet>
  );
}

const SHAPES = {
  kcal: <path d="M12 3c.8 3 4.5 5 4.5 10a4.5 4.5 0 0 1-9 0c0-2.2 1-3.7 2.1-4.7.2 1.4.8 2.4 1.9 2.9-.4-2.7.1-5.4.5-8.2z" />,
  protein: <path d="M12 5l7.5 13h-15z" />,
  carbs: <path d="M12 4.5l7.6 5.5-2.9 9h-9.4l-2.9-9z" />,
  fat: <path d="M8 4.5h8l4 7.5-4 7.5H8l-4-7.5z" />,
};

// Daily calorie and macro targets, laid out like a settings list.
export function GoalsSheet({ goals, onSave, onCancel }) {
  const [g, setG] = useState(() => Object.fromEntries(Object.entries(goals).map(([k, v]) => [k, String(v)])));
  const set = k => e => setG(x => ({ ...x, [k]: e.target.value }));
  const macroKcal = Math.round((Number(g.protein) || 0) * 4 + (Number(g.carbs) || 0) * 4 + (Number(g.fat) || 0) * 9);
  const valid = ["kcal", "protein", "carbs", "fat"].every(k => Number(g[k]) > 0);
  const row = (k, name, unit, tone) => (
    <label className="fg-row" key={k}>
      <span className={`fg-ic ft-bg-${tone}`}><svg viewBox="0 0 24 24">{SHAPES[k]}</svg></span>
      <span className="fg-txt"><b>{name}</b><small>{Number(g[k]) > 0 ? `${Number(g[k]).toLocaleString()}${unit} goal` : "No goal"}</small></span>
      <input type="number" inputMode="numeric" min="0" value={g[k]} onChange={set(k)} aria-label={`${name} goal`} />
      <span className="fg-unit">{unit.trim()}</span>
    </label>
  );

  return (
    <Sheet label="Daily goals" onCancel={onCancel}>
      <div className="fd-sh-bar">
        <button className="fd-x round" onClick={onCancel} aria-label="Close"><Close /></button>
        <h2>Daily Goals</h2>
        <span />
      </div>
      <p className="fg-h">Budget</p>
      <div className="fg-list">{row("kcal", "Calories", " cals", "k")}</div>
      <p className="fg-h">My Nutrients</p>
      <div className="fg-list">
        {row("protein", "Protein", "g", "p")}
        {row("carbs", "Carbohydrates", "g", "c")}
        {row("fat", "Fat", "g", "f")}
      </div>
      <p className="fd-sh-note">Your macros add up to {macroKcal.toLocaleString()} calories. Each meal suggests a share of these: breakfast 20%, lunch 25%, dinner 35%, snacks 20%.</p>
      <button
        className="fd-primary" disabled={!valid}
        onClick={() => onSave(Object.fromEntries(Object.entries(g).map(([k, v]) => [k, Math.round(Number(v))])))}
      >
        Save goals
      </button>
    </Sheet>
  );
}

const SIZES = [[0.5, "½"], [1, "1×"], [1.5, "1½"], [2, "2×"]];

// What the AI saw in a meal photo. Untick what's wrong, resize portions, then add them all.
export function PhotoSheet({ photo, meal: meal0, saving, error, onSave, onRetake, onCancel }) {
  const [meal, setMeal] = useState(meal0);
  const [picks, setPicks] = useState({}); // index -> { off, size }
  const foods = (photo.items || []).map(photoFood);
  const chosen = foods.map((f, i) => ({ food: f, size: picks[i]?.size ?? 1, on: !picks[i]?.off })).filter(x => x.on);
  const total = chosen.reduce((t, x) => {
    const n = nutrition(x.food, "serving", x.size);
    return { kcal: t.kcal + n.kcal, protein: t.protein + n.protein, carbs: t.carbs + n.carbs, fat: t.fat + n.fat };
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const set = (i, v) => setPicks(p => ({ ...p, [i]: { ...p[i], ...v } }));
  const left = photo.remaining ?? null;

  return (
    <Sheet label="Meal photo" onCancel={onCancel}>
      <div className="fd-sh-title">
        <h2>Meal photo</h2>
        <button className="fd-x" onClick={onCancel} aria-label="Close"><Close /></button>
      </div>
      <div className={`fph-pic${photo.status === "loading" ? " busy" : ""}`}>
        <img src={photo.url} alt="Your meal" />
        {photo.status === "loading" && <span className="fph-scan" />}
      </div>

      {photo.status === "loading" && <p className="fph-msg">Looking at your food…</p>}

      {photo.status === "error" && (
        <>
          <p className="fph-msg">{photo.error}</p>
          {photo.reason && <p className="fd-src">Details: {photo.reason}</p>}
          {photo.remaining !== 0 && <button className="fd-primary" onClick={onRetake}>Try another photo</button>}
        </>
      )}

      {photo.status === "done" && foods.length === 0 && (
        <>
          <p className="fph-msg">Couldn't spot any food in that photo. It didn't count toward your daily photos.</p>
          {photo.model && <p className="fd-src">Checked by {photo.model}</p>}
          <button className="fd-primary" onClick={onRetake}>Try another photo</button>
        </>
      )}

      {photo.status === "done" && foods.length > 0 && (
        <>
          <div className="fd-sh-cal">
            <b>{Math.round(total.kcal).toLocaleString()}</b><span>calories</span>
            <em>{chosen.length} of {foods.length} {foods.length === 1 ? "item" : "items"}</em>
          </div>
          <Macros n={total} />
          <div className="fph-list">
            {foods.map((f, i) => {
              const on = !picks[i]?.off;
              const size = picks[i]?.size ?? 1;
              const n = nutrition(f, "serving", size);
              return (
                <div key={i} className={`fph-item${on ? "" : " off"}`}>
                  <button className="fph-row" onClick={() => set(i, { off: on })} aria-pressed={on} aria-label={`${on ? "Remove" : "Include"} ${f.name}`}>
                    <span className={`fph-check${on ? " on" : ""}`}>{on && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}</span>
                    <Thumb food={f} size={40} />
                    <span className="fph-txt">
                      <b>{f.name}</b>
                      <small>{f.units[0].hint}</small>
                    </span>
                    <span className="fph-cal">{n.kcal}<small> cal</small></span>
                  </button>
                  {on && (
                    <div className="fph-sizes" role="group" aria-label={`Portion of ${f.name}`}>
                      {SIZES.map(([v, label]) => (
                        <button key={v} className={size === v ? "on" : ""} aria-pressed={size === v} onClick={() => set(i, { size: v })}>{label}</button>
                      ))}
                      <span>{Math.round(n.protein)}P · {Math.round(n.carbs)}C · {Math.round(n.fat)}F</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <MealChips meal={meal} onChange={setMeal} />
          {error && <p className="wl-error">{error}</p>}
          <button className="fd-primary" disabled={!chosen.length || saving} onClick={() => onSave(chosen.map(x => ({ food: x.food, amount: x.size })), meal)}>
            {saving ? "Saving…" : `Add ${chosen.length} ${chosen.length === 1 ? "item" : "items"} to ${mealSingular(meal)}`}
          </button>
          <p className="fd-src">AI estimate, so check portions before adding.{left != null ? ` ${left} of ${PHOTO_LIMIT} photos left today.` : ""}</p>
        </>
      )}
    </Sheet>
  );
}
