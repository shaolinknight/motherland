// Sample data for preview links, so every feature can be tried right away. Only runs on a branch
// preview (https://<branch>-motherland.<account>.workers.dev) or with ?demo in the URL, and only when
// that site has no saved progress yet. Each preview link is its own website to the browser, so this
// never touches the real app's progress.
import * as S from './store.js';
import * as C from './course.js';
import { dayKey, uid } from './util.js';

export const isPreview = () =>
  /-motherland\.[^.]+\.workers\.dev$/.test(location.hostname) || new URLSearchParams(location.search).has('demo');

export function seedIfEmpty() {
  if (!isPreview()) return false;
  try { if (localStorage.getItem('motherland.v1')) return false; } catch { return false; }
  S.replace(demoState());
  return true;
}
export const resetDemo = () => S.replace(demoState());

const DAY = 86400000;

function demoState() {
  const now = Date.now(), cards = {}, lessons = {};
  const card = (reps, days, extra = {}) => ({ reps, ivl: Math.max(1, days), ease: 2.5, s: Math.max(1, days), d: 5, due: now + days * DAY, lapses: 0, seen: now - 20 * DAY - Math.random() * DAY, last: now - Math.max(1, days) * DAY, ...extra });
  // Units 0–5 studied through lessons: a mix of due now, due soon and mastered.
  ['u00', 'u01', 'u02', 'u03', 'u04', 'u05'].forEach((u, k) => {
    C.unitItems(u).forEach((it, i) => {
      const r = (i * 7 + k * 3) % 10;
      cards[it.id] = r < 2 ? card(2, -1) : r < 5 ? card(3, 4 + r) : card(5, 25 + r);
    });
    lessons[u] = { at: now - (6 - k) * DAY, done: true };
  });
  // Unit 6 half done → "Continue learning" points here.
  C.unitItems('u06').slice(0, 9).forEach(it => { cards[it.id] = card(1, 1); });
  lessons.u06 = { at: now - DAY, done: false };
  // A leech, a buried card and a suspended card (Word bank → Hidden, Review → Weak spots).
  Object.assign(cards['u03-w2'], { lapses: 8, leech: true, reps: 0, due: now - DAY });
  Object.assign(cards['u03-w3'], { lapses: 3, due: now - DAY });
  Object.assign(cards['u02-w1'], { buriedUntil: now + DAY, edited: now });
  Object.assign(cards['u02-w2'], { suspended: true, edited: now });
  // The old, too-generous placement: a level-3 result plus bulk credit with no marker on units 7–12
  // (all created at one moment), so "Re-check what the test skipped" and "Reset placement" have work.
  const bulk = now - 10 * DAY;
  ['u07', 'u08', 'u09', 'u10', 'u11', 'u12'].forEach(u => C.unitItems(u).forEach(it => {
    cards[it.id] = { reps: 1, ivl: 3, ease: 2.5, due: now + 5 * DAY, lapses: 0, seen: bulk, last: bulk };   // not due yet, like real unreviewed credit
  }));
  const placements = [{ at: bulk, level: 3, label: 'Intermediate', score: 72, c: 21, t: 29,
    levels: { 1: { c: 8, t: 10 }, 2: { c: 7, t: 10 }, 3: { c: 6, t: 9 } },
    skills: { vocab: { c: 9, t: 10 }, reading: { c: 5, t: 6 }, tones: { c: 1, t: 4 }, grammar: { c: 4, t: 6 }, listening: { c: 2, t: 3 } },
    sections: {}, weak: ['Tones'], applied: true }];
  // Your own words (one checked with family) and two decks: one filled from the course, one hand-written.
  const my = (vi, en, extra = {}) => { const id = `my-${uid()}`; return [id, { id, vi, en, north: '', note: '', verified: false, at: now - 3 * DAY, edited: now - 3 * DAY, ...extra }]; };
  const w1 = my('ba má', 'mom and dad', { north: 'bố mẹ', verified: true });
  const w2 = my('ăn cơm chưa', 'have you eaten yet? (a greeting)');
  const w3 = my('thương', 'to love (warmly, Southern)', { note: 'Grandma says it to the kids' });
  const g1 = my('con nhớ ngoại', 'I miss you, Grandma', { deck: 'x' });
  const g2 = my('ngoại khỏe không', 'how are you, Grandma?', { deck: 'x' });
  const g3 = my('con thương ngoại lắm', 'I love you so much, Grandma', { deck: 'x' });
  const myWords = Object.fromEntries([w1, w2, w3, g1, g2, g3]);
  cards[w1[0]] = card(3, 6);
  const speech = `deck-${uid()}`, grandma = `deck-${uid()}`;
  [g1, g2, g3].forEach(([, w]) => { w.deck = grandma; });
  const decks = {
    [speech]: { id: speech, name: 'Wedding speech', items: [...C.unitItems('u06').filter(i => i.kind !== 'grammar').slice(0, 10).map(i => i.id), w2[0]], at: now - 2 * DAY, edited: now - 2 * DAY },
    [grandma]: { id: grandma, name: 'Grandma’s words', items: [g1[0], g2[0], g3[0]], at: now - DAY, edited: now - DAY },
  };
  // One card you edited (shows “✏️ edited”, logged as a flag).
  const edits = { 'u03-w1': { vi: C.item('u03-w1').vi, en: `${C.item('u03-w1').en} (edited in the demo)`, north: '', note: 'Example of an edited card', edited: now - DAY } };
  // 3+ weeks of study with one missed day this week (the streak freeze) and a gap last month.
  const days = {};
  for (let i = 0; i < 26; i++) {
    const d = new Date(now - i * DAY); const k = dayKey(d);
    if (i === 2 || i === 17 || i === 18) continue;
    days[k] = { xp: 40 + ((i * 37) % 90), ms: (8 + (i % 12)) * 60000, c: 12 + (i % 9), t: 15 + (i % 9), words: i % 4 ? 3 : 0, skills: { vocab: { c: 8, t: 9 }, tones: { c: 2, t: 4 }, listening: { c: 2, t: 3 } } };
  }
  const games = {
    match: { best: 24, at: now - 3 * DAY, runs: [{ score: 31, at: now - 9 * DAY }, { score: 24, at: now - 3 * DAY }] },
    speed: { best: 18, at: now - 2 * DAY, runs: [{ score: 12, at: now - 8 * DAY }, { score: 18, at: now - 2 * DAY }] },
  };
  return {
    v: 1, updatedAt: now, lang: 'vi',
    settings: { ...S.settings(), syncUrl: '', syncKey: '', lastBackup: 0, backupSnooze: 0 },
    langs: { vi: { cards, lessons, placements, skills: { vocab: { c: 180, t: 210 }, tones: { c: 30, t: 55 }, listening: { c: 25, t: 40 }, grammar: { c: 40, t: 50 }, reading: { c: 35, t: 45 } }, games, myWords, decks, edits } },
    days,
    flags: [{ id: uid(), at: now - DAY, lang: 'vi', itemId: 'u03-w1', vi: C.item('u03-w1').vi, en: C.item('u03-w1').orig?.en || C.item('u03-w1').en, note: 'Edited on phone: en (example from the demo)', synced: false }],
    pending: [],
  };
}
