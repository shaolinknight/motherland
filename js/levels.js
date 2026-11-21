// Placement scoring rules. No imports, so they're unit-tested directly in Node.

// A level counts as passed with 80% overall AND at least 2/3 of its production questions right.
// Levels must be passed in order. (Before v1.4: 67% overall, recognition-heavy. Too generous.)
export const PASS = 0.8, PASS_PROD = 2 / 3;
export function levelFrom(levels = {}, prod = null) {
  let level = 0;
  for (const l of [1, 2, 3]) {
    const x = levels[l], pr = prod?.[l];
    const ok = x && x.t && x.c / x.t >= PASS && (!pr || !pr.t || pr.c / pr.t >= PASS_PROD);
    if (ok) level = l; else break;
  }
  return level;
}
// The level a result really supports under today's rules (re-scores tests taken before v1.4).
export const effectiveLevel = r => (r ? Math.min(r.level, levelFrom(r.levels, r.levelsProd)) : 0);
