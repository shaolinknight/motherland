// What your latest placement test says to focus on. Lessons read this to tilt their exercise mix,
// Home reads it to suggest a retest. Only reads the store, so any module can import it.
import { lang } from './store.js';

const DAY = 86400000;
export const RETEST_AFTER_DAYS = 28;

export function latestPlacement() {
  const p = lang().placements || [];
  return p[p.length - 1] || null;
}

// Skill → weight for choosing exercise types. 1 = normal. A skill you scored under 60% on comes up
// 3× as often, under 75% 2×. Skills with fewer than 2 test questions don't count (too little evidence).
export function skillWeights(result = latestPlacement()) {
  const w = {};
  for (const [skill, { c, t }] of Object.entries(result?.skills || {})) {
    if (t < 2) continue;
    const r = c / t;
    w[skill] = r < 0.6 ? 3 : r < 0.75 ? 2 : 1;
  }
  return w;
}
export const focusSkills = (result = latestPlacement()) => Object.entries(skillWeights(result)).filter(([, v]) => v > 1).sort((a, b) => b[1] - a[1]).map(([k]) => k);

// Weighted random order (Efraimidis–Spirakis): heavier entries tend to come first, but every entry
// can still come first, so practice stays varied. entries: [{ weight, ... }]
export function weightedOrder(entries, rng = Math.random) {
  return entries.map(e => ({ e, k: Math.pow(rng(), 1 / Math.max(0.01, e.weight)) })).sort((a, b) => b.k - a.k).map(x => x.e);
}

export function daysSincePlacement(now = Date.now()) {
  const r = latestPlacement();
  return r ? Math.floor((now - r.at) / DAY) : null;
}
export const retestDue = (now = Date.now()) => { const d = daysSincePlacement(now); return d != null && d >= RETEST_AFTER_DAYS; };
