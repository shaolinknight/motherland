// Streaks with a weekly freeze: one missed day per Monday–Sunday week is forgiven, so a single busy
// day doesn't wipe out a long streak. Frozen days keep the streak alive but don't add to it.
// Computed from the day log (no stored state), so it syncs and merges for free.
import { dayKey } from './util.js';

const noon = d => { const x = new Date(d); x.setHours(12, 0, 0, 0); return x; };
const shift = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const weekOf = d => dayKey(shift(d, -((d.getDay() + 6) % 7)));   // Monday's key

// → { n: current streak, frozen: [day keys bridged by a freeze], freezeLeft: unused this week }
export function streakInfo(days, today = new Date()) {
  const active = d => (days[dayKey(d)]?.xp || 0) > 0;
  const t = noon(today);
  let d = active(t) ? t : shift(t, -1);   // today isn't over yet, so it can't break the streak
  const used = new Set(), frozen = [];
  let n = 0, pending = [];
  const earliest = Object.keys(days).sort()[0];
  for (let guard = 0; guard < 4000 && earliest && dayKey(d) >= earliest; guard++, d = shift(d, -1)) {
    if (active(d)) { n++; frozen.push(...pending); pending = []; continue; }
    const w = weekOf(d);
    if (used.has(w)) break;
    used.add(w); pending.push(dayKey(d));   // only counts if there's activity before it
  }
  const thisWeek = weekOf(t);
  return { n, frozen, freezeLeft: !frozen.some(k => weekOf(noon(new Date(`${k}T12:00:00`))) === thisWeek) };
}

// Longest run ever, with the same one-freeze-per-week rule.
export function longestStreak(days) {
  const keys = Object.keys(days).filter(k => days[k].xp > 0).sort();
  if (!keys.length) return 0;
  let best = 0, run = 0;
  const used = new Set();
  for (let d = noon(new Date(`${keys[0]}T12:00:00`)), end = noon(new Date(`${keys[keys.length - 1]}T12:00:00`)); d <= end; d = shift(d, 1)) {
    if ((days[dayKey(d)]?.xp || 0) > 0) { run++; best = Math.max(best, run); continue; }
    const w = weekOf(d);
    if (used.has(w)) { run = 0; continue; }
    used.add(w);   // frozen: the run survives this day
  }
  return best;
}
