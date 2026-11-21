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

const byNewer = (a, b) => ((b?.updatedAt || 0) > (a?.updatedAt || 0) ? b : a);

// A card's latest change: a review (`last`) or a bury/suspend (`edited`).
const touched = c => Math.max(c.last || 0, c.edited || 0);
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

function mergeLessons(a, b) {
  return mergeMap(a, b, (x, y) => ({ ...((y.at || 0) > (x.at || 0) ? y : x), done: !!(x.done || y.done) }));
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

function mergeLang(a = {}, b = {}, newer) {
  const out = { ...(newer === b ? { ...a, ...b } : { ...b, ...a }) };   // unknown fields: newer wins
  out.cards = mergeMap(a.cards, b.cards, newerCard);
  out.lessons = mergeLessons(a.lessons, b.lessons);
  out.placements = unionBy(a.placements, b.placements, p => p.at).sort((p, q) => p.at - q.at);
  out.skills = maxDeep(a.skills || {}, b.skills || {});
  out.games = mergeGames(a.games, b.games);
  if (a.myWords || b.myWords) out.myWords = mergeMap(a.myWords, b.myWords, (x, y) => ((y.edited || 0) > (x.edited || 0) ? y : x));
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
  const langs = {};
  for (const code of new Set([...Object.keys(local.langs || {}), ...Object.keys(remote.langs || {})])) {
    const a = local.langs?.[code], b = remote.langs?.[code];
    langs[code] = a && b ? mergeLang(a, b, newer === remote ? b : a) : (a || b);
  }
  out.langs = langs;
  out.days = mergeMap(local.days, remote.days, maxDeep);
  out.flags = unionBy(local.flags, remote.flags, f => f.id).map(f => {
    const l = local.flags?.find(x => x.id === f.id);
    return l ? { ...f, synced: l.synced || f.synced } : f;
  });
  out.pending = local.pending || [];
  return out;
}
