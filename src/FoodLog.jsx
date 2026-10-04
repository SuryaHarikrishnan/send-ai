import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import BarcodeScanner from "./BarcodeScanner";
import { AmountSheet, CustomSheet, Thumb } from "./FoodSheets";
import { COMMON_FOODS, COMMON_GROUPS, DAY_MS, MEALS, amountText, dayLabel, eatenAt, MEAL_NAMES, foodsError, logRow, lookupBarcode, mealForNow, mealSingular, nutrition, recentFoods, searchFoods } from "./food";

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

const CalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /></svg>
);

const shortDay = d => {
  const label = dayLabel(d);
  return label.length > 9 ? label : label.slice(0, 3) === "Yes" || label === "Today" ? label : label.slice(0, 3);
};

// One food as a card: picture or emoji, name, brand, calories per amount, quick add.
function FoodCard({ food, unit, amount, when, onOpen, onQuick, added }) {
  const u = unit || food.defaultUnit;
  const a = amount ?? food.defaultAmount;
  const n = nutrition(food, u, a);
  return (
    <div className="fl-item">
      <button className="fl-item-main" onClick={onOpen}>
        <Thumb food={food} size={50} />
        <span className="fl-item-txt">
          <b>{food.name}</b>
          {food.brand && <span className="fl-brand">{food.brand}</span>}
          <small>
            <span className="fl-nw">{n.kcal.toLocaleString()} cals per {amountText(food, u, a)}</span>
            {when && <span className="fl-when"> · <CalIcon />{shortDay(when)}</span>}
          </small>
        </span>
      </button>
      <button className={`fl-plus${added ? " added" : ""}`} onClick={onQuick} aria-label={`Add ${food.name}`}>
        {added ? <CheckIcon /> : <PlusIcon />}
      </button>
    </div>
  );
}

const STEP = 10;

export default function FoodLog({ user, day, meal: meal0, onDone }) {
  const [meal, setMeal] = useState(meal0 || mealForNow());
  const [history, setHistory] = useState([]);
  const [histError, setHistError] = useState(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("Fruit");
  const [tab, setTab] = useState("all");
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
  const [more, setMore] = useState({ key: "" });
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
    flash(`Added ${food.name} to ${MEAL_NAMES[m]}`);
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
        setScanStatus({ kind: "notfound", code, title: "Barcode not found.", detail: `Barcode ${code} isn't in Open Food Facts or the USDA database yet. Copy the numbers from the label and it'll be one tap next time.` });
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

  const keyOf = f => `${f.source}:${f.barcode || f.name}|${f.brand || ""}`;
  const card = (f, extra = {}) => {
    const k = extra.k || keyOf(f);
    return (
      <FoodCard
        key={k} food={f} unit={extra.unit} amount={extra.amount} when={extra.when}
        onOpen={() => { setSheetError(""); setPicked({ food: f, unit: extra.unit, amount: extra.amount }); }}
        onQuick={() => quickAdd(f, extra.unit || f.defaultUnit, extra.amount ?? f.defaultAmount, k)}
        added={quickDone.includes(k)}
      />
    );
  };
  const recentCards = list => list.map(r => card(r.food, { k: r.key, unit: r.last.unit, amount: Number(r.last.amount), when: r.last.eaten_at }));
  const showRecent = tab !== "common";
  // While searching on All, the database results replace the common foods list.
  const showCommon = tab === "common" || (tab === "all" && !q);
  const showRemote = tab === "all" && q.length >= 3;

  // Each list starts short and grows by STEP per "Show more" tap. A new search, tab or group starts short again.
  const moreKey = `${tab}|${q}|${group}`;
  const taps = more.key === moreKey ? more : {};
  const limit = (list, first) => first + (taps[list] || 0) * STEP;
  const showMore = list => setMore({ ...taps, key: moreKey, [list]: (taps[list] || 0) + 1 });
  const moreButton = (list, total, first) =>
    total > limit(list, first) && (
      <button className="fl-more" onClick={() => showMore(list)}>
        Show more <small>({total - limit(list, first)})</small>
      </button>
    );
  const recentFirst = tab === "mine" ? 15 : q ? 3 : 5;
  const remoteFirst = 6;
  const commonFirst = tab === "common" ? 12 : q ? 3 : 6;

  return (
    <div className="lift fl">
      <div className="fl-top">
        <span className={`fl-count${added.length ? " on" : ""}`} aria-label={`${added.length} added`}>{added.length}</span>
        <label className="fl-input">
          <SearchIcon />
          <input
            type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search"
            autoComplete="off" autoCorrect="off" enterKeyHint="search" aria-label="Search foods" autoFocus
          />
        </label>
        <button className="fl-done" onClick={() => onDone(day)} aria-label="Done"><CheckIcon /></button>
      </div>

      <label className="fl-to">
        Adding to
        <b>{mealSingular(meal)}</b>
        <select value={meal} onChange={e => setMeal(e.target.value)} aria-label="Meal">
          {MEALS.map(([id]) => <option key={id} value={id}>{mealSingular(id)}</option>)}
        </select>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        <span>· {dayLabel(day)}</span>
      </label>

      <div className="fl-tabs" role="tablist" aria-label="Food lists">
        {[["all", "All"], ["mine", "My Foods"], ["common", "Common"]].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {histError && (
        <div className="lift-card lift-setup">
          <strong>{histError.title}</strong>
          <p>{histError.detail}</p>
        </div>
      )}

      {showRecent && recentHits.length > 0 && (
        <>
          {(q || tab === "all") && <h2 className="fl-sec">{q ? "My foods" : "Recent"}</h2>}
          {recentCards(recentHits.slice(0, limit("recent", recentFirst)))}
          {moreButton("recent", recentHits.length, recentFirst)}
        </>
      )}
      {tab === "mine" && recentHits.length === 0 && !histError && (
        <p className="fl-hint">{q ? `Nothing you've logged matches "${q}".` : "Foods you log show up here, so the next time is one tap."}</p>
      )}

      {showRemote && (
        <>
          <h2 className="fl-sec">Food database</h2>
          {remoteShown.loading && [0, 1, 2].map(i => <div key={i} className="fl-item fl-skel"><i /><span><b /><small /></span></div>)}
          {!remoteShown.loading && remoteShown.error && <p className="fl-hint">{remoteShown.error}</p>}
          {!remoteShown.loading && !remoteShown.error && remoteShown.list.length === 0 && <p className="fl-hint">No foods in the database match "{q}".</p>}
          {!remoteShown.loading && remoteShown.list.slice(0, limit("remote", remoteFirst)).map(f => card(f))}
          {!remoteShown.loading && moreButton("remote", remoteShown.list.length, remoteFirst)}
          {!remoteShown.loading && remoteShown.list.some(f => f.source === "fatsecret") && (
            <p className="fl-credit"><a href="https://www.fatsecret.com" target="_blank" rel="noreferrer">Powered by fatsecret</a></p>
          )}
        </>
      )}

      {showCommon && (
        <>
          {(tab === "all" || q) && commonHits.length > 0 && <h2 className="fl-sec">Common foods</h2>}
          {!q && (
            <div className="ep-chips fl-chips" role="group" aria-label="Food group">
              {COMMON_GROUPS.map(g => (
                <button key={g} className={group === g ? "on" : ""} aria-pressed={group === g} onClick={() => setGroup(g)}>{g}</button>
              ))}
            </div>
          )}
          {commonHits.slice(0, limit("common", commonFirst)).map(f => card(f))}
          {moreButton("common", commonHits.length, commonFirst)}
          {tab === "common" && q && commonHits.length === 0 && <p className="fl-hint">No common foods match "{q}".</p>}
        </>
      )}

      <button className="fl-create" onClick={() => { setSheetError(""); setCustom({ name: q.length >= 2 ? q[0].toUpperCase() + q.slice(1) : "" }); }}>
        <PlusIcon />
        <span><b>{q ? `Create "${q}"` : "Create a food"}</b><small>Type in calories and macros from the label</small></span>
      </button>
      <div className="fl-fab-space" />

      <button className="fl-fab" onClick={() => { setScanStatus(null); setScanning(true); }}>
        <ScanIcon /><span>Scan barcode</span>
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
