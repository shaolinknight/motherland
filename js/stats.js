// Aggregations for the dashboard and leaderboards (all from data already on the phone).
import * as S from './store.js';
import * as C from './course.js';
import { dayKey, weekKeys, pct } from './util.js';
import { longestStreak as longestFrom } from './streak.js';

const empty = () => ({ xp: 0, ms: 0, c: 0, t: 0, words: 0, days: 0 });
function add(a, d) { a.xp += d.xp || 0; a.ms += d.ms || 0; a.c += d.c || 0; a.t += d.t || 0; a.words += d.words || 0; if ((d.xp || 0) > 0) a.days++; return a; }

const mondayOf = key => weekKeys(new Date(`${key}T12:00:00`))[0];
const fmtShort = key => new Date(`${key}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' });

// Periods ranked by XP. kind: 'week' | 'month'
export function periods(kind) {
  const map = new Map();
  for (const [k, d] of Object.entries(S.get().days)) {
    const id = kind === 'week' ? mondayOf(k) : k.slice(0, 7);
    map.set(id, add(map.get(id) || empty(), d));
  }
  const current = kind === 'week' ? mondayOf(dayKey()) : dayKey().slice(0, 7);
  if (!map.has(current)) map.set(current, empty());
  const list = [...map.entries()].map(([id, v]) => ({
    id, ...v, acc: pct(v.c, v.t), current: id === current,
    label: kind === 'week'
      ? `${fmtShort(id)} – ${fmtShort(weekKeys(new Date(`${id}T12:00:00`))[6])}`
      : new Date(`${id}-15T12:00:00`).toLocaleDateString([], { month: 'long', year: 'numeric' }),
  }));
  const ranked = [...list].sort((a, b) => b.xp - a.xp || a.id.localeCompare(b.id));
  ranked.forEach((p, i) => (p.rank = i + 1));
  const chrono = [...list].sort((a, b) => a.id.localeCompare(b.id));
  const cur = chrono.find(p => p.current), prev = chrono[chrono.indexOf(cur) - 1];
  // Fair comparison: last period only up to the same point (same weekday / day of month).
  let prevSoFar = 0;
  if (prev) {
    const t = new Date(); t.setHours(12, 0, 0, 0);
    for (const [k, d] of Object.entries(S.get().days)) {
      const id = kind === 'week' ? mondayOf(k) : k.slice(0, 7);
      if (id !== prev.id) continue;
      const dt = new Date(`${k}T12:00:00`);
      const within = kind === 'week' ? ((dt.getDay() + 6) % 7) <= ((t.getDay() + 6) % 7) : dt.getDate() <= t.getDate();
      if (within) prevSoFar += d.xp || 0;
    }
  }
  return { ranked, cur, prev, prevSoFar, change: prev && prevSoFar ? Math.round(((cur.xp - prevSoFar) / prevSoFar) * 100) : null };
}

export const longestStreak = () => longestFrom(S.get().days);

export function records() {
  const days = Object.entries(S.get().days);
  const bestDay = days.reduce((b, [k, d]) => (d.xp > (b?.xp || 0) ? { k, xp: d.xp } : b), null);
  const mostWords = days.reduce((b, [k, d]) => ((d.words || 0) > (b?.n || 0) ? { k, n: d.words } : b), null);
  const weeks = periods('week').ranked;
  const accWeek = weeks.filter(w => w.t >= 20).sort((a, b) => b.acc - a.acc)[0];
  return {
    bestDay: bestDay && { value: `${bestDay.xp} XP`, when: fmtShort(bestDay.k) },
    bestWeek: weeks[0]?.xp ? { value: `${weeks[0].xp} XP`, when: weeks[0].label } : null,
    streak: (() => { const n = longestStreak(); return { value: `${n} day${n === 1 ? '' : 's'}`, when: `current: ${S.streak()}` }; })(),
    mostWords: mostWords && { value: `${mostWords.n} new`, when: fmtShort(mostWords.k) },
    accuracy: accWeek && { value: `${accWeek.acc}%`, when: accWeek.label },
  };
}

// Cumulative items learned over the last `n` days (from card creation times).
export function growth(n = 30) {
  const cards = C.cards();
  const times = Object.values(cards).map(c => c.seen || 0).sort((a, b) => a - b);
  const out = []; const end = new Date(); end.setHours(23, 59, 59, 999);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end); d.setDate(end.getDate() - i);
    out.push({ key: dayKey(d), n: times.filter(t => t <= d.getTime()).length });
  }
  return out;
}

// Activity grid: last `weeks` weeks, Monday-first columns.
export function heatmap(weeks = 12) {
  const days = S.get().days, cols = [];
  const start = new Date(); start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (weeks - 1) * 7);
  const today = dayKey();
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + w * 7 + i);
      const k = dayKey(d);
      col.push({ k, xp: days[k]?.xp || 0, future: k > today });
    }
    cols.push(col);
  }
  return cols;
}

export function gameBoard(key, n = 10) {
  const runs = S.lang().games[key]?.runs || [];
  const lower = key === 'match';
  return [...runs].sort((a, b) => (lower ? a.score - b.score : b.score - a.score) || a.at - b.at).slice(0, n);
}

export function recentLessons(n = 6) {
  const L = S.lang().lessons;
  return Object.entries(L).filter(([, v]) => v.at).sort((a, b) => b[1].at - a[1].at).slice(0, n)
    .map(([id, v]) => ({ unit: C.unit(id), at: v.at, done: v.done })).filter(x => x.unit);
}
