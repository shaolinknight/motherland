// Placement scoring rules. No imports, so they're unit-tested directly in Node.

// A level counts as passed with 80% overall AND at least 2/3 of its production questions right.
// Levels must be passed in order. (Before v1.4: 67% overall, recognition-heavy. Too generous.)
export const PASS = 0.8, PASS_PROD = 2 / 3;
export function levelFrom(levels = {}, prod = null) {
  let level = 0;
  for (const l of [1, 2, 3]) {
    const x = levels[l], pr = prod?.[l];
    const ok = x && x.t && x.c / x.t >= PASS && (!pr || !pr.t || pr.c / pr.t >= PASS_PROD);
    if (ok) level = l; else break;
  }
  return level;
}
// The level a result really supports under today's rules (re-scores tests taken before v1.4).
export const effectiveLevel = r => (r ? Math.min(r.level, levelFrom(r.levels, r.levelsProd)) : 0);

// Adaptive stop: levels are tested in order (12 questions each). Once a level is clearly failed
// (more than half its questions wrong, even before it's finished), harder levels can't be passed,
// so the test ends instead of dragging on.
export function shouldStop(results, blockSizes) {
  for (const [lvl, size] of Object.entries(blockSizes)) {
    const rs = results.filter(r => String(r.level) === String(lvl));
    const wrong = rs.filter(r => !r.correct).length;
    if (wrong > size / 2) return true;
    if (rs.length < size) return false;   // this level isn't finished yet
  }
  return false;
}

// Reset: which cards did placement give you (and so get taken back)? Placement-made cards carry
// placed: true (old test), 2 (v1.4 test) or 'kept' ("I know these"). The very first test's
// "add level units" button left no marker, but it created hundreds of cards at the same moment, so a
// creation time shared by 5+ cards gives them away (lessons create cards one by one, seconds apart).
// Cards you've since reviewed successfully 3+ times stay: you've shown you know them. Test-out cards
// (placed: 'unit') stay too, since you earned those yourself.
export function placementCredit(cards) {
  const bySeen = {};
  for (const c of Object.values(cards)) bySeen[c.seen] = (bySeen[c.seen] || 0) + 1;
  const remove = [], keep = [];
  for (const [id, c] of Object.entries(cards)) {
    const fromTest = c.placed === true || c.placed === 2 || c.placed === 'kept' || (c.placed == null && c.seen > 0 && bySeen[c.seen] >= 5);
    if (!fromTest || c.placed === 'unit') continue;
    (c.reps >= 3 ? keep : remove).push(id);
  }
  return { remove, keep };
}

// What each level means, so a result says what you can do rather than just a label.
export const CAN_DO = [
  { can: 'Sounds and tones, greetings, a few words.', next: 'Introductions, family words, numbers and time.' },
  { can: 'Introduce yourself, talk about family, numbers, time and simple everyday needs.', next: 'Food, markets, getting around, weddings and feelings.' },
  { can: 'Order food, shop, get around, talk about your day and handle wedding basics.', next: 'Longer conversations with elders, work, emergencies, speeches.' },
  { can: 'Hold longer conversations, follow customs, give a short speech, handle problems.', next: 'Keep going with reviews and new units; retake the test to check.' },
];
