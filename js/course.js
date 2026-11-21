// Loads a language course and turns units into study items.
import vi from '../data/vi.js';
import { lang } from './store.js';
import { isDue, isMastered } from './srs.js';

// Courses that exist today. Others are listed as "coming soon" with their plan.
export const COURSES = { vi };
export const UPCOMING = [
  { code: 'ko', name: 'Korean', native: '한국어', flag: '🇰🇷', plan: 'Hangul first (it takes a few hours), with romanization only as a short bridge.' },
  { code: 'ja', name: 'Japanese', native: '日本語', flag: '🇯🇵', plan: 'Hiragana and katakana first, then words in real script with audio. No long-term rōmaji.' },
  { code: 'es', name: 'Spanish (Mexico)', native: 'Español', flag: '🇲🇽', plan: 'Mexican Spanish vocabulary and voice, same situations as Vietnamese.' },
];

let course, items, byId, byUnit;

export function load(code = 'vi') {
  course = COURSES[code] || vi;
  items = []; byId = new Map(); byUnit = new Map();
  for (const u of course.units) {
    const list = [];
    u.words.forEach(([v, en, north, note], i) => list.push({ id: `${u.id}-w${i}`, unit: u.id, kind: 'word', vi: v, en, north, note, level: u.level }));
    u.phrases.forEach(([v, en], i) => list.push({ id: `${u.id}-p${i}`, unit: u.id, kind: 'phrase', vi: v, en, north: '', note: '', level: u.level }));
    // Grammar points are review items too; vi/en hold the first example for display & flagging.
    (u.grammar || []).forEach((g, i) => list.push({ id: `${u.id}-g${i}`, unit: u.id, kind: 'grammar', vi: g.examples[0][0], en: g.title, point: g, north: '', note: '', level: u.level }));
    list.forEach(it => { items.push(it); byId.set(it.id, it); });
    byUnit.set(u.id, list);
  }
  return course;
}
load();

export const get = () => course;
export const all = () => items;
export const item = id => byId.get(id);
export const unit = id => course.units.find(u => u.id === id);
export const unitItems = id => byUnit.get(id) || [];
export const words = () => items.filter(i => i.kind === 'word');
export const grammarItems = () => items.filter(i => i.kind === 'grammar');
export const vocabItems = () => items.filter(i => i.kind !== 'grammar');

export function cards() { return lang(course.code).cards; }
export const card = id => cards()[id];

// Items you've been introduced to (they have a review card).
export function seenItems() { const c = cards(); return items.filter(i => c[i.id]); }
export function dueItems(now = Date.now()) { const c = cards(); return items.filter(i => c[i.id] && isDue(c[i.id], now)); }
export function masteredCount() { const c = cards(); return items.filter(i => isMastered(c[i.id])).length; }

export function unitProgress(id) {
  const list = unitItems(id), c = cards();
  const learned = list.filter(i => c[i.id]).length;
  return { learned, total: list.length, pct: list.length ? Math.round((learned / list.length) * 100) : 0 };
}

// First unit that still has unseen items.
export function nextUnit() {
  return course.units.find(u => unitProgress(u.id).learned < unitItems(u.id).length) || course.units[course.units.length - 1];
}
