import { BODY_PATHS } from "./bodyPaths";
import { MUSCLE_NAMES, findExercise } from "./lifting";
import "./MuscleThumb.css";

const SKIN = new Set(["head", "hair", "hands", "feet", "ankles", "knees", "neck", "tibialis"]);
const LOWER = new Set(["gluteal", "hamstring", "quadriceps", "adductors", "calves"]);
const ON_SIDE = Object.fromEntries(Object.entries(BODY_PATHS).map(([side, parts]) => [side, new Set(parts.map(([slug]) => slug))]));
// Where each figure sits in bodyPaths' drawing, and the slices for upper and lower body.
const LEFT = { front: 53, back: 773 };
const WIDTH = 622;
const ROWS = { upper: [96, 700], lower: [620, 720], full: [96, 1245] };

// One figure with the muscles an exercise works lit up, like the pictures in exercise guides:
// main muscles in full red, helpers paler. It shows the side (front or back) where the main
// muscles are, zoomed to the upper or lower body when that's all the exercise works.
export default function MuscleThumb({ name, size = 56 }) {
  const info = findExercise(name);
  if (!info) return <span className="mt mt-none" style={{ width: size, height: size }} aria-hidden="true" />;
  const primary = new Set(info.primary);
  const secondary = new Set(info.secondary);
  const count = side => info.primary.filter(m => ON_SIDE[side].has(m)).length * 2 + info.secondary.filter(m => ON_SIDE[side].has(m)).length;
  // Traps show on both sides but read much better from behind.
  const side = count("back") + (primary.has("trapezius") ? 1 : 0) > count("front") ? "back" : "front";
  const lower = info.primary.every(m => LOWER.has(m));
  const upper = info.primary.every(m => !LOWER.has(m));
  const [top, height] = ROWS[lower ? "lower" : upper ? "upper" : "full"];
  const fill = slug => (SKIN.has(slug) ? "mt-skin" : primary.has(slug) ? "mt-p" : secondary.has(slug) ? "mt-s" : "mt-m");
  return (
    <span className="mt" style={{ width: size, height: size }} role="img" aria-label={`Works ${info.primary.map(m => MUSCLE_NAMES[m]).join(", ")}`}>
      <svg viewBox={`${LEFT[side]} ${top} ${WIDTH} ${height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {BODY_PATHS[side].map(([slug, paths]) => paths.map((d, i) => <path key={slug + i} d={d} className={fill(slug)} />))}
      </svg>
    </span>
  );
}
