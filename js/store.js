// App state: saved on the phone (localStorage) and optionally mirrored to a Google Sheet.
import { dayKey, uid } from './util.js';
import { streakInfo } from './streak.js';

const KEY = 'motherland.v1';
const listeners = new Set();

function defaults() {
  return {
    v: 1,
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
    skills: {}, games: {},
  };
}

let state = load();

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
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
  state = { ...defaults(), ...next, settings: { ...defaults().settings, ...(next.settings || {}), ...keep } };
  saveNow();
  listeners.forEach(fn => fn(state));
}

export function reset() { const keep = state.settings; state = defaults(); state.settings = { ...state.settings, syncUrl: keep.syncUrl, syncKey: keep.syncKey }; save(); }

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
