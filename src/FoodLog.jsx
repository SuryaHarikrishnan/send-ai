import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import BarcodeScanner from "./BarcodeScanner";
import { AmountSheet, CustomSheet, Thumb } from "./FoodSheets";
import { COMMON_FOODS, COMMON_GROUPS, DAY_MS, MEALS, amountText, dayLabel, eatenAt, foodsError, logRow, lookupBarcode, mealForNow, mealSingular, nutrition, recentFoods, searchFoods } from "./food";

const ScanIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M8 9v6M11 9v6M14 9v6M17 9v6" /></svg>
);
const SearchIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>;
const PlusIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 6v12M6 12h12" /></svg>;
const CheckIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;

const matches = (food, words) => {
  const hay = `${food.name} ${food.brand || ""}`.toLowerCase();
  return words.every(w => hay.includes(w));
};

function FoodRow({ food, detail, onOpen, onQuick, added }) {
  return (
    <div className="fl-row">
      <button className="fl-row-main" onClick={onOpen}>
        <Thumb food={food} size={42} />
        <span className="fl-row-txt">
          <b>{food.name}</b>
          <small>{detail}</small>
        </span>
      </button>
      {onQuick && (
        <button className={`fl-quick${added ? " added" : ""}`} onClick={onQuick} aria-label={`Add ${food.name}`}>
          {added ? <CheckIcon /> : <PlusIcon />}
        </button>
      )}
    </div>
  );
}

const defaultDetail = f => {
  const n = nutrition(f, f.defaultUnit, f.defaultAmount);
  return [f.brand, `${amountText(f, f.defaultUnit, f.defaultAmount)} · ${n.kcal.toLocaleString()} cal`].filter(Boolean).join(" · ");
};

export default function FoodLog({ user, day, meal: meal0, onDone }) {
  const [meal, setMeal] = useState(meal0 || mealForNow());
  const [history, setHistory] = useState([]);
  const [histError, setHistError] = useState(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("Fruit");
  const [remote, setRemote] = useState({ q: "", list: [], loading: false, error: "" });
  const [picked, setPicked] = useState(null);
  const [custom, setCustom] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sheetError, setSheetError] = useState("");
  const [added, setAdded] = useState([]);
  const [toast, setToast] = useState("");
  const [quickDone, setQuickDone] = useState([]);
  const toastTimer = useRef(0);

  useEffect(() => {
    supabase
      .from("food_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("eaten_at", new Date(Date.now() - 90 * DAY_MS).toISOString())
      .order("eaten_at", { ascending: false })
      .limit(400)
      .then(({ data, error }) => {
        if (error) setHistError(foodsError(error));
        setHistory(data || []);
      });
  }, [user]);

  // Open Food Facts search, after a short pause in typing.
  const q = query.trim();
  useEffect(() => {
    if (q.length < 3) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setRemote(r => ({ ...r, q, loading: true, error: "" }));
      searchFoods(q, ctl.signal)
        .then(list => setRemote({ q, list, loading: false, error: "" }))
        .catch(e => { if (e.name !== "AbortError") setRemote({ q, list: [], loading: false, error: e.message || "Search failed." }); });
    }, 550);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  const recent = recentFoods(history);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const recentHits = q ? recent.filter(r => matches(r.food, words)) : recent;
  const commonHits = q ? COMMON_FOODS.filter(f => matches(f, words)) : COMMON_FOODS.filter(f => f.group === group);
  const remoteShown = q.length >= 3 && remote.q === q ? remote : { list: [], loading: q.length >= 3, error: "" };

  function flash(text) {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }

  async function addLog(food, unit, amount, m) {
    setSaving(true);
    setSheetError("");
    const row = logRow(food, unit, amount, m, eatenAt(day, m));
    const { data, error } = await supabase.from("food_logs").insert({ user_id: user.id, ...row }).select().single();
    setSaving(false);
    if (error) {
      const e = foodsError(error);
      const msg = e.title.startsWith("Couldn't") ? `Couldn't add it: ${error.message}` : `${e.title} ${e.detail}`;
      setSheetError(msg);
      return false;
    }
    setHistory(h => [data, ...h]);
    setAdded(a => [...a, data.id]);
    setMeal(m);
    flash(`Added ${food.name} to ${mealSingular(m)}`);
    return true;
  }

  async function quickAdd(food, unit, amount, key) {
    if (saving) return;
    const ok = await addLog(food, unit, amount, meal);
    if (ok) setQuickDone(k => [...k, key]);
    else flash("Couldn't add it. Check your connection and try again.");
  }

  const closeScanner = useCallback(() => { setScanning(false); setScanStatus(null); }, []);
  async function onCode(code) {
    setScanStatus({ kind: "looking", code });
    try {
      const food = await lookupBarcode(code);
      if (!food) {
        setScanStatus({ kind: "notfound", code, title: "Not in Open Food Facts yet.", detail: `Nobody has added barcode ${code}. Copy the numbers from the label and it'll be one tap next time.` });
        return;
      }
      if (!food.per100) {
        setScanStatus({ kind: "notfound", code, food, title: food.name, detail: "Found it, but it has no nutrition facts yet. Copy them from the label." });
        return;
      }
      closeScanner();
      setSheetError("");
      setPicked({ food });
    } catch (e) {
      setScanStatus({ kind: "error", code, detail: e.message || "Check your connection and try again." });
    }
  }
  function manualFromScan(code, food) {
    closeScanner();
    setSheetError("");
    setCustom({ barcode: code, name: food?.name || "", brand: food?.brand || "" });
  }

  const dayText = dayLabel(day);

  return (
    <div className="lift fl">
      <header className="lift-head">
        <div>
          <p className="lift-date">{dayText === "Today" ? "Today" : dayText}</p>
          <h1 className="lift-title">Add food</h1>
        </div>
        <button className="lift-start" onClick={() => onDone(day)}>{added.length ? `Done · ${added.length}` : "Done"}</button>
      </header>

      <div className="fd-meals fl-meals" role="group" aria-label="Meal">
        {MEALS.map(([id]) => (
          <button key={id} className={meal === id ? "on" : ""} aria-pressed={meal === id} onClick={() => setMeal(id)}>{mealSingular(id)}</button>
        ))}
      </div>

      <div className="fl-search">
        <label className="fl-input">
          <SearchIcon />
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search foods or brands" autoComplete="off" enterKeyHint="search" aria-label="Search foods" />
        </label>
        <button className="fl-scan" onClick={() => { setScanStatus(null); setScanning(true); }}><ScanIcon />Scan</button>
      </div>

      {histError && (
        <div className="lift-card lift-setup">
          <strong>{histError.title}</strong>
          <p>{histError.detail}</p>
        </div>
      )}

      {recentHits.length > 0 && (
        <section className="lift-card fl-card">
          <h2 className="fl-h">{q ? "Your foods" : "Recent"}</h2>
          {recentHits.slice(0, q ? 6 : 12).map(r => {
            const l = r.last;
            const n = nutrition(r.food, l.unit, l.amount);
            return (
              <FoodRow
                key={r.key} food={r.food}
                detail={[r.food.brand, `${amountText(r.food, l.unit, l.amount)} · ${n.kcal.toLocaleString()} cal`].filter(Boolean).join(" · ")}
                onOpen={() => { setSheetError(""); setPicked({ food: r.food, unit: l.unit, amount: Number(l.amount) }); }}
                onQuick={() => quickAdd(r.food, l.unit, Number(l.amount), r.key)}
                added={quickDone.includes(r.key)}
              />
            );
          })}
        </section>
      )}

      {!q && recent.length === 0 && !histError && (
        <p className="fl-hint">Scan a barcode or search for a food. Anything you log shows up here for one-tap re-logging.</p>
      )}

      {q.length >= 3 && (
        <section className="lift-card fl-card">
          <h2 className="fl-h">Open Food Facts</h2>
          {remoteShown.loading && [0, 1, 2].map(i => <div key={i} className="fl-skel"><i /><span><b /><small /></span></div>)}
          {!remoteShown.loading && remoteShown.error && <p className="fl-none">{remoteShown.error}</p>}
          {!remoteShown.loading && !remoteShown.error && remoteShown.list.length === 0 && <p className="fl-none">No packaged foods match "{q}".</p>}
          {!remoteShown.loading && remoteShown.list.map((f, i) => (
            <FoodRow key={`${f.barcode}-${i}`} food={f} detail={defaultDetail(f)} onOpen={() => { setSheetError(""); setPicked({ food: f }); }} />
          ))}
        </section>
      )}

      {(commonHits.length > 0 || !q) && (
        <section className="lift-card fl-card">
          <h2 className="fl-h">Common foods</h2>
          {!q && (
            <div className="ep-chips fl-chips" role="group" aria-label="Food group">
              {COMMON_GROUPS.map(g => (
                <button key={g} className={group === g ? "on" : ""} aria-pressed={group === g} onClick={() => setGroup(g)}>{g}</button>
              ))}
            </div>
          )}
          {commonHits.map(f => (
            <FoodRow key={f.name} food={f} detail={defaultDetail(f)} onOpen={() => { setSheetError(""); setPicked({ food: f }); }} />
          ))}
        </section>
      )}

      <button className="fl-create" onClick={() => { setSheetError(""); setCustom({ name: q.length >= 2 ? q[0].toUpperCase() + q.slice(1) : "" }); }}>
        <PlusIcon />
        <span><b>{q ? `Create "${q}"` : "Create a food"}</b><small>Type in calories and macros from the label</small></span>
      </button>

      {toast && <div className="fl-toast" role="status">{toast}</div>}

      {picked && (
        <AmountSheet
          food={picked.food} unit={picked.unit} amount={picked.amount} meal={meal}
          saving={saving} error={sheetError}
          onCancel={() => setPicked(null)}
          onSave={async ({ unit, amount, meal: m }) => { if (await addLog(picked.food, unit, amount, m)) setPicked(null); }}
        />
      )}
      {custom && (
        <CustomSheet
          initial={custom} meal={meal} saving={saving} error={sheetError}
          onCancel={() => setCustom(null)}
          onSave={async (food, m) => { if (await addLog(food, "serving", 1, m)) { setCustom(null); setQuery(""); } }}
        />
      )}
      {scanning && (
        <BarcodeScanner
          status={scanStatus}
          onCode={onCode}
          onRetry={() => setScanStatus(null)}
          onManual={manualFromScan}
          onClose={closeScanner}
        />
      )}
    </div>
  );
}
