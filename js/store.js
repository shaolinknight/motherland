// App state: saved on the phone (localStorage) and optionally mirrored to a Google Sheet.
import { dayKey, uid } from './util.js';
import { streakInfo } from './streak.js';

// The storage key is a contract with the phone (and older backups): it stays 'motherland.v1' forever.
// The *format* inside it is versioned by `v` and upgraded step by step by MIGRATIONS below.
const KEY = 'motherland.v1';
const listeners = new Set();

// Current format version. To change the saved format: bump SCHEMA, add MIGRATIONS[old] that turns a
// version-`old` state into `old + 1`, and add a test with an old-shape fixture (tools/test-logic.mjs).
export const SCHEMA = 2;
const MIGRATIONS = {
  // v1 → v2 (v1.6): v1 grew field by field from v1.1 to v1.5 (FSRS card fields, myWords, edits, decks,
  // tombstones, new settings). Nothing needs converting — every addition was optional — so this step
  // only records that the state has been checked, and fills per-language containers so code can rely
  // on them existing.
  1: s => {
    for (const l of Object.values(s.langs || {})) {
      l.cards ||= {}; l.lessons ||= {}; l.placements ||= []; l.skills ||= {}; l.games ||= {};
      l.myWords ||= {}; l.edits ||= {}; l.decks ||= {}; l.tomb ||= {};
    }
    s.flags ||= []; s.pending ||= []; s.days ||= {}; s.tomb ||= {};
    return { ...s, v: 2 };
  },
};

// Bring any saved state (from storage, a backup file or the Sheet) up to the current format.
// A state from a *newer* app version is left as it is.
export function migrate(s) {
  let out = { ...s, v: s.v || 1 };
  while (out.v < SCHEMA && MIGRATIONS[out.v]) out = MIGRATIONS[out.v](out);
  return out;
}

function defaults() {
  return {
    v: SCHEMA,
    updatedAt: 0,
    deviceId: uid(),
    lang: 'vi',
    settings: {
      showHanoi: true, rate: 0.85, voiceURI: '', forceAudio: false, haptics: true, retention: 0.9, theme: 'auto',
      dailyGoal: 60, newPerLesson: 8, syncUrl: '', syncKey: '', lastSync: 0, syncError: '',
      lastBackup: 0, backupSnooze: 0,
    },
    langs: {},
    days: {},       // { 'YYYY-MM-DD': { xp, ms, c, t, skills: {vocab:{c,t}...} } }
    flags: [],      // reported content problems
    pending: [],    // finished sessions waiting to be sent to the Sheet
  };
}

function langDefaults() {
  return {
    cards: {}, lessons: {}, placements: [],
    skills: {}, games: {}, myWords: {}, edits: {}, decks: {}, tomb: {},
  };
}

let state = load();

function load() {
  if (typeof localStorage === 'undefined') return defaults();   // Node tests import this module
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    if (raw) {
      const s = migrate(JSON.parse(raw));
      const d = defaults();
      return { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) } };
    }
  } catch (e) {
    console.warn('State load failed', e);
    // The next save would overwrite unreadable data; keep a copy so it can still be recovered by hand.
    if (raw) try { localStorage.setItem(`${KEY}.unreadable`, raw); } catch { /* storage full */ }
  }
  return defaults();
}

export const get = () => state;
export const settings = () => state.settings;

export function lang(code = state.lang) {
  if (!state.langs[code]) state.langs[code] = langDefaults();
  const l = state.langs[code];
  for (const [k, v] of Object.entries(langDefaults())) if (l[k] === undefined) l[k] = v;
  return l;
}

let saveTimer;
export function save({ touch = true } = {}) {
  if (touch) state.updatedAt = Date.now();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.error('Save failed', e); }
  }, 50);
  listeners.forEach(fn => fn(state));
}
export function saveNow() {
  clearTimeout(saveTimer);
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.error(e); }
}
export const onChange = fn => listeners.add(fn);

export function replace(next) {
  const keep = { syncUrl: state.settings.syncUrl, syncKey: state.settings.syncKey };
  next = migrate(next);   // backups and Sheet copies may be in an older format
  state = { ...defaults(), ...next, settings: { ...defaults().settings, ...(next.settings || {}), ...keep } };
  saveNow();
  listeners.forEach(fn => fn(state));
}

// Reset progress. resetAt tells the sync merge to drop anything older, so the Sheet's copy can't
// bring the old progress back.
export function reset() {
  const keep = state.settings, now = Date.now();
  state = defaults(); state.settings = { ...state.settings, syncUrl: keep.syncUrl, syncKey: keep.syncKey };
  state.resetAt = now; save();
}

// Remember a deletion so a sync merge doesn't bring it back from another device or the Sheet.
// kind: 'c' card, 'p' placement (id = its time), 'l' lesson record (id = unit) — per language;
// 'f' flag — top level. See merge.js.
export function forget(kind, id, at = Date.now()) {
  const target = kind === 'f' ? state : lang();
  (target.tomb ||= {})[`${kind}:${id}`] = at;
}

// Activity log for the dashboard.
export function day(key = dayKey()) {
  if (!state.days[key]) state.days[key] = { xp: 0, ms: 0, c: 0, t: 0, words: 0, skills: {} };
  return state.days[key];
}

export function recordAnswer(skill, correct) {
  const d = day();
  d.t++; if (correct) d.c++;
  const s = (d.skills[skill] ||= { c: 0, t: 0 }); s.t++; if (correct) s.c++;
  const ls = lang().skills; const L = (ls[skill] ||= { c: 0, t: 0 }); L.t++; if (correct) L.c++;
  if (correct) d.xp += 10;
}
export function addXP(n) { day().xp += n; }
export function addTime(ms) { day().ms += Math.max(0, Math.min(ms, 60 * 60000)); }

export function logSession(activity, { ms = 0, xp = 0, c = 0, t = 0 } = {}) {
  state.pending.push({ id: uid(), at: Date.now(), lang: state.lang, activity, ms, xp, c, t });
  if (state.pending.length > 500) state.pending = state.pending.slice(-500);
}

// Current streak in days (one missed day per week is forgiven; see streak.js).
export const streak = () => streakInfo(state.days).n;
export const streakDetails = () => streakInfo(state.days);

export function flag(item, note) {
  state.flags.push({ id: uid(), at: Date.now(), lang: state.lang, itemId: item.id, vi: item.vi, en: item.en, note: note || '', synced: false });
  save();
}
