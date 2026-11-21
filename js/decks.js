// Custom flashcard decks. A deck is a named list of item IDs: course words/phrases, your own words, or
// cards you wrote yourself inside the deck (stored as My words, so they can be edited and reviewed).
// Studying a deck uses the same review card as everywhere else, so progress is shared.
//   lang().decks = { ['deck-…']: { id, name, items: [itemId], at, edited, deleted? } }
// Deletes leave a tombstone so a sync merge can't bring a deck back.
import * as C from './course.js';
import * as S from './store.js';
import { uid } from './util.js';
import { flash } from './exercises.js';
import { isDue, isHidden } from './srs.js';

const map = () => { const l = S.lang(); return (l.decks ||= {}); };
const touch = d => { d.edited = Date.now(); S.save(); return d; };

export const list = () => Object.values(map()).filter(d => !d.deleted).sort((a, b) => a.at - b.at);
export const get = id => { const d = map()[id]; return d && !d.deleted ? d : null; };

export function create(name) {
  const id = `deck-${uid()}`, now = Date.now();
  map()[id] = { id, name: name.trim() || 'New deck', items: [], at: now, edited: now };
  S.save();
  return map()[id];
}
export const rename = (id, name) => { const d = get(id); if (d && name.trim()) { d.name = name.trim(); touch(d); } };
export const remove = id => { const d = map()[id]; if (d) { d.deleted = true; d.items = []; touch(d); } };

export function add(id, itemIds) {
  const d = get(id); if (!d) return 0;
  const before = d.items.length;
  d.items = [...new Set([...d.items, ...itemIds])];
  touch(d);
  return d.items.length - before;
}
export const removeItem = (id, itemId) => { const d = get(id); if (d) { d.items = d.items.filter(x => x !== itemId); touch(d); } };
export const has = (id, itemId) => !!get(id)?.items.includes(itemId);

// Items that still exist (a deleted My word or an unknown id is skipped quietly).
export const items = id => (get(id)?.items || []).map(C.item).filter(Boolean);

export function stats(id) {
  const cards = C.cards(), its = items(id), now = Date.now();
  return {
    total: its.length,
    due: its.filter(i => cards[i.id] && isDue(cards[i.id], now)).length,
    fresh: its.filter(i => !cards[i.id]).length,
  };
}

// Write a card yourself: it becomes one of your words (so you can edit it and it's reviewed) and joins the deck.
export function newCard(id, { vi, en, north = '', note = '' }) {
  const wid = `my-${uid()}`, now = Date.now();
  C.myWordsMap()[wid] = { id: wid, vi, en, north, note, verified: false, at: now, edited: now, deck: id };
  add(id, [wid]);
  return wid;
}

// Study a deck as flashcards: due cards first, then new ones, then the rest (shuffled), up to `limit`.
// Suspended or buried cards stay out, as in normal reviews.
export function studySteps(id, limit = 40) {
  const cards = C.cards(), now = Date.now();
  const its = items(id).filter(i => !(cards[i.id] && isHidden(cards[i.id], now)));
  const rank = i => (!cards[i.id] ? 1 : isDue(cards[i.id], now) ? 0 : 2);
  return its.map(i => ({ i, r: rank(i), k: Math.random() })).sort((a, b) => a.r - b.r || a.k - b.k)
    .slice(0, limit).map(x => flash(x.i)).filter(Boolean);
}
