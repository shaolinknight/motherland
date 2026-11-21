// Loads a language course and turns units into study items.
import vi from '../data/vi.js';
import { lang, onChange } from './store.js';
import { isDue, isMastered, isHidden } from './srs.js';

// Courses that exist today. Others are listed as "coming soon" with their plan.
export const COURSES = { vi };
export const UPCOMING = [
  { code: 'ko', name: 'Korean', native: '한국어', flag: '🇰🇷', plan: 'Hangul first (it takes a few hours), with romanization only as a short bridge.' },
  { code: 'ja', name: 'Japanese', native: '日本語', flag: '🇯🇵', plan: 'Hiragana and katakana first, then words in real script with audio. No long-term rōmaji.' },
  { code: 'es', name: 'Spanish (Mexico)', native: 'Español', flag: '🇲🇽', plan: 'Mexican Spanish vocabulary and voice, same situations as Vietnamese.' },
];

let course, items, byId, byUnit;

// ── Your edits to course cards ─────────────────────────────────────────────
// lang().edits = { [itemId]: { vi?, en?, north?, note?, edited, reset? } }. The course data is never
// changed; edits are laid over the items at load and whenever the state changes (e.g. after a sync).
// A reset leaves a tombstone ({ reset: true }) so a sync merge can't bring an old edit back.
const EDITABLE = ['vi', 'en', 'north', 'note'];
let applied = new Set();
export function editsMap() { const l = lang(course.code); return (l.edits ||= {}); }
export function applyEdits() {
  const e = lang(course.code).edits || {};
  for (const id of applied) {
    const it = byId.get(id);
    if (it && (!e[id] || e[id].reset)) { Object.assign(it, it.orig); it.edited = false; applied.delete(id); }
  }
  for (const [id, v] of Object.entries(e)) {
    const it = byId.get(id);
    if (!it || v.reset || it.kind === 'grammar') continue;
    it.orig ||= Object.fromEntries(EDITABLE.map(k => [k, it[k]]));
    Object.assign(it, it.orig, Object.fromEntries(EDITABLE.filter(k => typeof v[k] === 'string').map(k => [k, v[k]])));
    it.edited = true; applied.add(id);
  }
}

export function load(code = 'vi') {
  course = COURSES[code] || vi;
  items = []; byId = new Map(); byUnit = new Map();
  for (const u of course.units) {
    const list = [];
    u.words.forEach(([v, en, north, note], i) => list.push({ id: `${u.id}-w${i}`, unit: u.id, kind: 'word', vi: v, en, north, note, level: u.level }));
    u.phrases.forEach(([v, en], i) => list.push({ id: `${u.id}-p${i}`, unit: u.id, kind: 'phrase', vi: v, en, north: '', note: '', level: u.level }));
    // Grammar points are review items too; vi/en hold the first example for display & flagging.
    (u.grammar || []).forEach((g, i) => list.push({ id: `${u.id}-g${i}`, unit: u.id, kind: 'grammar', vi: g.examples[0][0], en: g.title, point: g, north: '', note: '', level: u.level }));
    // review: content not yet checked by a native speaker (shown as “Needs family check”).
    if (u.review) list.forEach(it => { it.review = true; });
    list.forEach(it => { items.push(it); byId.set(it.id, it); });
    byUnit.set(u.id, list);
  }
  applied = new Set();
  applyEdits();
  return course;
}
load();
onChange(() => applyEdits());   // re-apply after sync merges or restores

// ── My words: your own entries, stored per language in lang().myWords as
//   { [id]: { id: 'my-…', vi, en, north, note, verified, at, edited, deleted? } }
// IDs are random ('my-…'), never positional, so they can't collide with course items. Deleting
// leaves a tombstone so a sync merge with another device can't bring the word back.
export const MY_UNIT = { id: 'my', icon: '📝', title: 'My words', vi: 'Từ của tôi', level: 1, section: 'My words' };
export function myWordsMap() { const l = lang(course.code); return (l.myWords ||= {}); }
export function myItems() {
  return Object.values(myWordsMap()).filter(w => !w.deleted).sort((a, b) => a.at - b.at).map(w => ({
    id: w.id, unit: 'my', kind: w.vi.trim().split(/\s+/).length > 2 ? 'phrase' : 'word',
    vi: w.vi, en: w.en, north: w.north || '', note: w.note || '', level: 1, mine: true, verified: !!w.verified,
  }));
}
// Course items plus your own: everything that can have a review card.
const studyItems = () => [...items, ...myItems()];

export const get = () => course;
export const all = () => items;   // course content only (placement test, wrong-answer choices, word of the day)
export const item = id => byId.get(id) || (id?.startsWith('my-') ? myItems().find(i => i.id === id) : undefined);
export const unit = id => (id === 'my' ? MY_UNIT : course.units.find(u => u.id === id));
export const unitItems = id => (id === 'my' ? myItems() : byUnit.get(id) || []);
export const words = () => items.filter(i => i.kind === 'word');
export const grammarItems = () => items.filter(i => i.kind === 'grammar');
export const vocabItems = () => items.filter(i => i.kind !== 'grammar');

export function cards() { return lang(course.code).cards; }
export const card = id => cards()[id];

// Items you've been introduced to (they have a review card).
export function seenItems() { const c = cards(); return studyItems().filter(i => c[i.id]); }
// Seen items that aren't buried or suspended: what practice modes may draw from.
export function activeItems(now = Date.now()) { const c = cards(); return studyItems().filter(i => c[i.id] && !isHidden(c[i.id], now)); }
// Items you keep missing: leeches first, then most lapses.
export function weakItems(n = 12) {
  const c = cards();
  return activeItems().filter(i => c[i.id].lapses > 0)
    .sort((a, b) => (c[b.id].leech ? 1 : 0) - (c[a.id].leech ? 1 : 0) || c[b.id].lapses - c[a.id].lapses).slice(0, n);
}
export function dueItems(now = Date.now()) { const c = cards(); return studyItems().filter(i => c[i.id] && isDue(c[i.id], now)); }
export function masteredCount() { const c = cards(); return studyItems().filter(i => isMastered(c[i.id])).length; }

export function unitProgress(id) {
  const list = unitItems(id), c = cards();
  const learned = list.filter(i => c[i.id]).length;
  return { learned, total: list.length, pct: list.length ? Math.round((learned / list.length) * 100) : 0 };
}

// First unit that still has unseen items.
export function nextUnit() {
  return course.units.find(u => unitProgress(u.id).learned < unitItems(u.id).length) || course.units[course.units.length - 1];
}
