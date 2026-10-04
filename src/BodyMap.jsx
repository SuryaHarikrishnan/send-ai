import { BODY_PATHS, BODY_VIEWBOX } from "./bodyPaths";
import { MUSCLE_NAMES } from "./lifting";
import "./Lift.css";

const NOT_MUSCLE = new Set(["head", "hair", "hands", "feet", "ankles", "knees", "neck", "tibialis"]);

// How bright a muscle is: 0 untouched, 3 most worked.
function level(value, mode) {
  if (!value) return 0;
  if (mode === "week") return value >= 10 ? 3 : value >= 5 ? 2 : 1;
  return value >= 4 ? 3 : value >= 2 ? 2 : 1;
}

function Side({ side, sets, mode, selected, onSelect, small }) {
  return (
    <svg viewBox={BODY_VIEWBOX[side]} className="bm-svg" role="img" aria-label={`${side} of body`}>
      {BODY_PATHS[side].map(([slug, paths]) => {
        const isMuscle = !NOT_MUSCLE.has(slug) && MUSCLE_NAMES[slug];
        const cls = slug === "hair" ? "bm-hair" : isMuscle ? `bm-m bm-l${level(sets[slug], mode)}` : "bm-skin";
        const sel = selected === slug ? " bm-sel" : "";
        return paths.map((d, i) => (
          <path
            key={slug + i}
            d={d}
            className={cls + sel}
            onClick={isMuscle && !small && onSelect ? () => onSelect(slug) : undefined}
          />
        ));
      })}
    </svg>
  );
}

export default function BodyMap({ sets, mode = "week", selected, onSelect, small = false }) {
  return (
    <div className={small ? "bm bm-small" : "bm"}>
      <div className="bm-side">
        <Side side="front" sets={sets} mode={mode} selected={selected} onSelect={onSelect} small={small} />
        {!small && <span className="bm-label">Front</span>}
      </div>
      <div className="bm-side">
        <Side side="back" sets={sets} mode={mode} selected={selected} onSelect={onSelect} small={small} />
        {!small && <span className="bm-label">Back</span>}
      </div>
    </div>
  );
}
