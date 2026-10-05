// Boulder (V) and rope (YDS) grades on one difficulty scale, so "Top Send"
// can pick the hardest climb whichever kind it was. Rough, commonly used
// equivalents: V0 ≈ 5.10b, V4 ≈ 5.12b/c, V6 ≈ 5.13a/b, V10 ≈ 5.14b.
const YDS = ["5.6","5.7","5.8","5.9","5.10a","5.10b","5.10c","5.10d","5.11a","5.11b","5.11c","5.11d","5.12a","5.12b","5.12c","5.12d","5.13a","5.13b","5.13c","5.13d","5.14a","5.14b","5.14c","5.14d","5.15a","5.15b","5.15c","5.15d"];
const V = { VB: 2.5, V0: 4.5, V1: 7.5, V2: 9.5, V3: 11.5, V4: 13.5, V5: 15.5, V6: 16.5, V7: 18, V8: 19, V9: 20, V10: 21, V11: 22, V12: 23, V13: 24, V14: 25, V15: 26, V16: 27, V17: 28 };

export function gradeRank(grade) {
  if (grade in V) return V[grade];
  const i = YDS.indexOf(grade);
  return i < 0 ? -1 : i;
}

// The hardest grade among sent climbs, or null when nothing was sent.
export function topSend(climbs) {
  let best = null;
  for (const c of climbs) {
    if (c.sent && (best === null || gradeRank(c.grade) > gradeRank(best))) best = c.grade;
  }
  return best;
}
