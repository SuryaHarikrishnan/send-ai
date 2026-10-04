import { useState } from "react";
import { EXERCISES, GROUPS, MUSCLE_NAMES, findExercise, groupOf } from "./lifting";

// Search the library, filter by muscle group, recent lifts first.
export default function ExercisePicker({ recent, taken, onAdd }) {
  const [query, setQuery] = useState("");
  const [chosen, setGroup] = useState(null);
  // Recent lifts load after the page opens, so the default follows them until a chip is tapped.
  const group = chosen ?? (recent.length ? "Recent" : "All");

  const q = query.trim().toLowerCase();
  const recentList = recent.map(n => findExercise(n) || { name: n, primary: [], secondary: [] });
  let list;
  if (q) {
    const words = q.split(/\s+/);
    const pool = [...recentList.filter(e => !findExercise(e.name)), ...EXERCISES];
    list = pool
      .filter(e => {
        const hay = `${e.name} ${e.primary.map(m => MUSCLE_NAMES[m]).join(" ")}`.toLowerCase();
        return words.every(w => hay.includes(w));
      })
      // Names that start with the search come first.
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)));
  } else if (group === "Recent") list = recentList;
  else if (group === "All") list = [...EXERCISES].sort((a, b) => a.name.localeCompare(b.name));
  else list = EXERCISES.filter(e => groupOf(e) === group);

  const exact = q && [...EXERCISES, ...recentList].some(e => e.name.toLowerCase() === q);
  const chips = [...(recent.length ? ["Recent"] : []), "All", ...Object.keys(GROUPS)];

  function add(name) {
    onAdd(name);
    setQuery("");
  }

  return (
    <section className="lift-card ep">
      <label htmlFor="ep-search" className="lift-h2">Add exercise</label>
      <input
        id="ep-search"
        type="search"
        value={query}
        placeholder={`Search ${EXERCISES.length} exercises`}
        autoComplete="off"
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && q) add(list[0] && !exact ? list[0].name : query); }}
      />
      {!q && (
        <div className="ep-chips" role="group" aria-label="Muscle group">
          {chips.map(c => (
            <button key={c} className={group === c ? "on" : ""} aria-pressed={group === c} onClick={() => setGroup(c)}>{c}</button>
          ))}
        </div>
      )}
      <div className="ep-list">
        {list.map(e => {
          const added = taken.has(e.name.toLowerCase());
          return (
            <button key={e.name} className="ep-row" onClick={() => add(e.name)}>
              <span>
                <b>{e.name}</b>
                <small>{e.primary.length ? e.primary.map(m => MUSCLE_NAMES[m]).join(" · ") : "Custom"}</small>
              </span>
              <span className={`ep-plus${added ? " added" : ""}`} aria-label={added ? "Already added, add again" : "Add"}>{added ? "✓" : "+"}</span>
            </button>
          );
        })}
        {q && !exact && (
          <button className="ep-row ep-custom" onClick={() => add(query)}>
            <span><b>Add "{query.trim()}"</b><small>As your own exercise</small></span>
            <span className="ep-plus">+</span>
          </button>
        )}
      </div>
    </section>
  );
}
