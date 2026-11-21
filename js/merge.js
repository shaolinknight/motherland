// Combine this phone's progress with the copy in the Google Sheet, piece by piece, instead of
// letting the newer save replace everything. Pure function (no DOM), so it is unit-tested in Node.
//
// Rules, in order of how much they matter:
// - Review cards: keep whichever copy was reviewed most recently (then the one with more reviews).
//   A card studied on the iPad and a different card studied on the iPhone both survive.
// - Day logs: per day, per number, keep the larger value. Both devices hold cumulative copies of
//   the same log after a sync, so adding them would double-count. The cost: if both devices study
//   on the same day *without syncing in between*, that day shows the bigger of the two, not the sum.
// - Lists with IDs (flags, placements, game runs, my words): union, no duplicates.
// - Settings and anything unknown: the newer save wins. The sync URL/password always stay local.
// - Pending session rows are never in the Sheet's copy; the local queue is kept as is.
// - Deletions are remembered as dated tombstones (`tomb`: 'c:<card>', 'p:<placement time>',
//   'l:<unit>' per language; 'f:<flag>' at the top), and a full "Reset progress" sets `resetAt`.
//   Without them a union merge would bring deleted things back from the Sheet's older copy
//   (that's how a placement reset kept undoing itself). Anything changed *after* its tombstone
//   (e.g. a word learned again later) survives.

const byNewer = (a, b) => ((b?.updatedAt || 0) > (a?.updatedAt || 0) ? b : a);

// A card's latest change: created (`seen`), reviewed (`last`) or buried/suspended (`edited`).
const touched = c => Math.max(c.last || 0, c.edited || 0, c.seen || 0);
const TOMB_DAYS = 365;   // tombstones older than this are dropped to keep the state small
const mergeTombs = (a = {}, b = {}, now = Date.now()) => {
  const out = {};
  for (const [k, v] of [...Object.entries(a), ...Object.entries(b)]) if (now - v < TOMB_DAYS * 86400000) out[k] = Math.max(out[k] || 0, v);
  return out;
};
const alive = (tomb, key, time) => !(tomb[key] >= (time || 0));
function newerCard(a, b) {
  if (!a) return b; if (!b) return a;
  if (touched(b) !== touched(a)) return touched(b) > touched(a) ? b : a;
  if ((b.reps || 0) !== (a.reps || 0)) return (b.reps || 0) > (a.reps || 0) ? b : a;
  return (b.lapses || 0) > (a.lapses || 0) ? b : a;
}

function mergeMap(a = {}, b = {}, pick) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in out ? pick(out[k], v) : v;
  return out;
}

const unionBy = (a = [], b = [], key) => {
  const seen = new Map();
  [...a, ...b].forEach(x => { const k = key(x); if (!seen.has(k)) seen.set(k, x); });
  return [...seen.values()];
};

// Numbers: max. Nested objects (e.g. skills: { tones: { c, t } }): merge the same way.
function maxDeep(a, b) {
  if (a == null) return b; if (b == null) return a;
  if (typeof a === 'number' && typeof b === 'number') return Math.max(a, b);
  if (typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)) {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = maxDeep(out[k], v);
    return out;
  }
  return b;
}

// The more recent record wins, including done: false (a unit reopened by a placement reset).
function mergeLessons(a, b) {
  return mergeMap(a, b, (x, y) => ((y.at || 0) > (x.at || 0) ? y : x));
}

function mergeGames(a, b) {
  return mergeMap(a, b, (x, y) => {
    const runs = unionBy(x.runs, y.runs, r => `${r.at}:${r.score}`).sort((p, q) => p.at - q.at).slice(-200);
    // Which "best" is better depends on the game (time: lower; score: higher). Whichever was set
    // most recently was a new record when it was set, so it is the true best.
    const best = (y.at || 0) > (x.at || 0) ? y : x;
    return { ...x, ...y, best: best.best, at: best.at, runs };
  });
}

function mergeLang(a = {}, b = {}, newer, resetAt = 0) {
  const out = { ...(newer === b ? { ...a, ...b } : { ...b, ...a }) };   // unknown fields: newer wins
  const tomb = out.tomb = mergeTombs(a.tomb, b.tomb);
  out.cards = Object.fromEntries(Object.entries(mergeMap(a.cards, b.cards, newerCard))
    .filter(([id, c]) => alive(tomb, `c:${id}`, touched(c)) && touched(c) >= resetAt));
  out.lessons = Object.fromEntries(Object.entries(mergeLessons(a.lessons, b.lessons))
    .filter(([u, l]) => alive(tomb, `l:${u}`, l.at) && (l.at || 0) >= resetAt));
  out.placements = unionBy(a.placements, b.placements, p => p.at)
    .filter(p => alive(tomb, `p:${p.at}`, p.at) && p.at >= resetAt).sort((p, q) => p.at - q.at);
  out.skills = maxDeep(a.skills || {}, b.skills || {});
  out.games = mergeGames(a.games, b.games);
  const newerEdit = (x, y) => ((y.edited || 0) > (x.edited || 0) ? y : x);
  if (a.myWords || b.myWords) out.myWords = mergeMap(a.myWords, b.myWords, newerEdit);
  if (a.edits || b.edits) out.edits = mergeMap(a.edits, b.edits, newerEdit);
  if (a.decks || b.decks) out.decks = mergeMap(a.decks, b.decks, newerEdit);
  return out;
}

export function mergeStates(local, remote) {
  if (!remote) return local;
  if (!local) return remote;
  const newer = byNewer(local, remote);
  const out = { ...(newer === remote ? { ...local, ...remote } : { ...remote, ...local }) };
  out.settings = { ...newer.settings, syncUrl: local.settings?.syncUrl || '', syncKey: local.settings?.syncKey || '',
    lastSync: local.settings?.lastSync || 0, syncError: local.settings?.syncError || '' };
  out.deviceId = local.deviceId;
  out.lang = local.lang;
  out.updatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0);
  const resetAt = out.resetAt = Math.max(local.resetAt || 0, remote.resetAt || 0);
  const langs = {};
  for (const code of new Set([...Object.keys(local.langs || {}), ...Object.keys(remote.langs || {})])) {
    const a = local.langs?.[code], b = remote.langs?.[code];
    // A language present on one side only still goes through mergeLang, so its tombstones/reset apply.
    langs[code] = mergeLang(a || {}, b || {}, newer === remote ? (b || {}) : (a || {}), resetAt);
  }
  out.langs = langs;
  const resetDay = resetAt ? new Date(resetAt).toISOString().slice(0, 10) : '';
  out.days = Object.fromEntries(Object.entries(mergeMap(local.days, remote.days, maxDeep)).filter(([k]) => !resetDay || k >= resetDay));
  const tomb = out.tomb = mergeTombs(local.tomb, remote.tomb);
  out.flags = unionBy(local.flags, remote.flags, f => f.id).filter(f => alive(tomb, `f:${f.id}`, f.at) && (f.at || 0) >= resetAt).map(f => {
    const l = local.flags?.find(x => x.id === f.id);
    return l ? { ...f, synced: l.synced || f.synced } : f;
  });
  out.pending = local.pending || [];
  return out;
}
