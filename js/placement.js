// Placement test + diagnostics: finds your level and what to work on.
import * as C from './course.js';
import * as S from './store.js';
import { mcq, tone, gdrill, build, run } from './exercises.js';
import { audioAvailable } from './speech.js';
import { sample, shuffle, pct, toast } from './util.js';
import { latestPlacement } from './focus.js';
import { levelFrom, effectiveLevel, shouldStop, placementCredit, CAN_DO } from './levels.js';
export { CAN_DO };
export { effectiveLevel };

const SKILL_NAMES = { vocab: 'Vocabulary', reading: 'Reading', grammar: 'Grammar', listening: 'Listening', tones: 'Tones', speaking: 'Speaking' };
export const skillName = k => SKILL_NAMES[k] || k;

function levelItems(level, kind) {
  return C.all().filter(i => i.level === level && i.kind === kind && !i.review);   // only checked content is tested
}

// Exercise types where you have to come up with the Vietnamese yourself (or hear tones), so a lucky
// guess is much less likely than in "what does this mean?" questions.
export const PRODUCTION = new Set(['mcq:en2vi', 'build', 'tone', 'dict']);
const isProd = r => PRODUCTION.has(r.ex);

// v1.4: harder than before. Per level: 2 recognition words, 3 “pick the Vietnamese”, 2 sentence
// builds, 1 phrase meaning, 1 tone, 2 grammar drills (+1 listening). Every question has “I don’t know”.
export function buildTest() {
  const steps = [];
  steps.blockSizes = {};
  const audio = audioAvailable(C.get().speechLang);
  for (const lvl of [1, 2, 3]) {
    const block = [];
    const words = shuffle(levelItems(lvl, 'word')), phrases = shuffle(levelItems(lvl, 'phrase'));
    words.slice(0, 2).forEach(i => block.push(mcq(i, 'vi2en')));
    words.slice(2, 5).forEach(i => block.push(mcq(i, 'en2vi')));
    phrases.filter(i => i.vi.split(/\s+/).length <= 8).slice(0, 2).forEach(i => block.push(build(i)));
    phrases.slice(2, 3).forEach(i => block.push(mcq(i, 'vi2en')));
    for (const i of words.slice(5)) { const t = tone(i); if (t) { block.push(t); break; } }
    sample(levelItems(lvl, 'grammar'), 2).forEach(i => { const d = gdrill(i); if (d) block.push(d); });
    if (audio) words.slice(-1).forEach(i => block.push(mcq(i, 'audio2en')));
    const b = shuffle(block.filter(Boolean));
    steps.blockSizes[lvl] = b.length;
    steps.push(...b);   // levels in order (1, 2, 3) so the test can stop once one is clearly failed
  }
  return steps;
}


export function start(onDone) {
  const steps = buildTest();
  run({ title: 'Placement test', steps, test: true, activity: 'placement', stopWhen: rs => shouldStop(rs, steps.blockSizes), onFinish: out => {
    if (out.early && out.results.length < 6) return onDone && onDone(null);
    const result = score(out.results);
    result.seeded = seedKnown(out.results, result.level);
    S.lang().placements.push(result);
    S.logSession('placement', { ms: out.ms, c: out.c, t: out.t });
    S.save();
    onDone && onDone(result);
  } });
}

export function score(results) {
  const by = (key) => {
    const m = {};
    results.forEach(r => { const k = r[key]; if (k == null) return; (m[k] ||= { c: 0, t: 0 }); m[k].t++; if (r.correct) m[k].c++; });
    return m;
  };
  const levels = by('level');
  const levelsProd = {};
  results.filter(isProd).forEach(r => { if (r.level == null) return; (levelsProd[r.level] ||= { c: 0, t: 0 }); levelsProd[r.level].t++; if (r.correct) levelsProd[r.level].c++; });
  const level = levelFrom(levels, levelsProd);
  const skills = by('skill');
  const sectionsRaw = {};
  results.forEach(r => { const u = C.unit(r.unit); if (!u) return; const k = u.section; (sectionsRaw[k] ||= { c: 0, t: 0 }); sectionsRaw[k].t++; if (r.correct) sectionsRaw[k].c++; });
  // Lowest-scoring first, capped so the list stays actionable.
  const low = (m, name, max) => Object.entries(m).filter(([, v]) => v.t >= 2 && v.c / v.t < 0.6)
    .sort((a, b) => a[1].c / a[1].t - b[1].c / b[1].t).slice(0, max).map(([k]) => name(k));
  const weak = [...low(skills, skillName, 3), ...low(sectionsRaw, k => `${k} topics`, 2)];
  const c = results.filter(r => r.correct).length;
  return { at: Date.now(), level, label: C.get().levels[level], score: pct(c, results.length), c, t: results.length, levels, levelsProd, skills, sections: sectionsRaw, weak, v: 2 };
}

// Words you *produced* correctly (picked the Vietnamese, built the sentence, chose the tone) in a level
// you passed are "clearly known": they go into reviews with a short first interval, so FSRS confirms
// them within days. Recognition answers ("what does this mean?") could be guesses, so they don't count.
export function seedKnown(results, level, now = Date.now()) {
  const cards = C.cards(); let n = 0;
  for (const r of results) {
    if (!r.correct || !r.id || !isProd(r) || r.level > level || cards[r.id] || C.item(r.id)?.kind === 'grammar') continue;
    cards[r.id] = { reps: 1, ivl: 2, ease: 2.5, s: 2, d: 5, due: now + (1 + Math.random() * 2) * 86400000, lapses: 0, seen: now, last: now, placed: 2 };
    n++;
  }
  return n;
}

// ── Test out of one unit ───────────────────────────────────────────────────
// Instead of skipping whole levels, prove a single unit: up to 10 production questions from it (pick
// the Vietnamese, build the sentence, grammar). 85%+ moves every unseen item of the unit into reviews.
export const TEST_OUT_PASS = 0.85;
export function testOutSteps(unitId) {
  const list = C.unitItems(unitId);
  const vocab = shuffle(list.filter(i => i.kind !== 'grammar')).slice(0, 8)
    .map(i => (i.kind === 'phrase' && i.vi.split(/\s+/).length <= 8 ? build(i) : mcq(i, 'en2vi')));
  const gram = list.filter(i => i.kind === 'grammar').map(i => gdrill(i));
  return shuffle([...vocab, ...gram].filter(Boolean)).slice(0, 10);
}
export function testOut(unitId, onDone) {
  run({ title: 'Test out', steps: testOutSteps(unitId), test: true, activity: `testout:${unitId}`, onFinish: out => {
    if (out.early) { onDone && onDone(null); return; }
    const ratio = out.t ? out.c / out.t : 0, passed = ratio >= TEST_OUT_PASS;
    let n = 0;
    if (passed) {
      const cards = C.cards(), now = Date.now();
      C.unitItems(unitId).forEach(i => {
        if (cards[i.id]) return;
        cards[i.id] = { reps: 1, ivl: 2, ease: 2.5, s: 2, d: 5, due: now + (1 + Math.random() * 2) * 86400000, lapses: 0, seen: now, last: now, placed: 'unit' };
        n++;
      });
      S.lang().lessons[unitId] = { at: now, done: true, testedOut: true };
    }
    S.logSession(`testout:${unitId}`, { ms: out.ms, c: out.c, t: out.t });
    S.save();
    onDone && onDone({ passed, n, pct: Math.round(ratio * 100) });
  } });
}

// ── Re-check what a placement skipped ──────────────────────────────────────
// Cards the pre-v1.4 placement (or its "add level units" button) created that you've never reviewed:
// created and last-touched at the same moment, one rep, no misses. Real lesson cards start with
// last = 0, and any review moves last on, so those never match. Credit from the stricter v1.4 test
// (placed: 2) or a unit test-out (placed: 'unit') was earned under the new rules and isn't listed.
export function unreviewedSkipped() {
  const cards = C.cards();
  return Object.entries(cards).filter(([, c]) => c.last > 0 && c.seen === c.last && c.reps === 1 && !c.lapses
    && c.placed !== 2 && c.placed !== 'unit').map(([id]) => id);
}
// Put them back into lessons: remove those cards (nothing was learned on them) and reopen their units.
export function unskip() {
  const ids = unreviewedSkipped(), cards = C.cards(), lessons = S.lang().lessons, units = new Set();
  ids.forEach(id => { units.add(C.item(id)?.unit); delete cards[id]; });
  units.forEach(u => { if (lessons[u]) lessons[u].done = false; });
  const r = latestPlacement(); if (r) r.skipsChecked = Date.now();
  S.save();
  return ids.length;
}

export function recommendation(result) {
  if (!result) return null;
  const units = C.get().units;
  const target = Math.min(effectiveLevel(result) + 1, 3);
  const open = u => u.level >= target && C.unitProgress(u.id).learned < C.unitItems(u.id).length;
  // Prefer units a native speaker has checked; new "needs family check" units come after.
  return units.find(u => open(u) && !u.review) || units.find(open) || C.nextUnit();
}

// Units the result says you might already know: unfinished units at or below your level. They're
// suggestions for Test out, never credited automatically.
export function mightKnow(result, max = 8) {
  const lvl = effectiveLevel(result);
  return C.get().units.filter(u => u.level <= lvl && !u.review && C.unitProgress(u.id).learned < C.unitItems(u.id).length).slice(0, max);
}

// Reset placement: delete every result and take back what placement marked as known (see
// placementCredit in levels.js). Units reopen so lessons teach those words properly.
export function resetPreview() { return placementCredit(C.cards()); }
export function resetPlacement() {
  const { remove, keep } = placementCredit(C.cards());
  const cards = C.cards(), lessons = S.lang().lessons, units = new Set();
  remove.forEach(id => { units.add(C.item(id)?.unit); delete cards[id]; });
  units.forEach(u => {
    if (!lessons[u]) return;
    const left = C.unitItems(u).some(i => cards[i.id]);
    if (left) lessons[u].done = false; else delete lessons[u];
  });
  S.lang().placements = [];
  S.save();
  return { removed: remove.length, kept: keep.length };
}

// What Home's "Continue learning" offers: a unit you're partway through (most recent first), otherwise
// where your latest placement says to start, otherwise the first unfinished unit.
export function continueUnit() {
  const lessons = S.lang().lessons || {};
  const inProgress = Object.entries(lessons)
    .filter(([id, v]) => !v.done && id !== 'my' && C.unit(id) && C.unitProgress(id).learned < C.unitItems(id).length)
    .sort((a, b) => (b[1].at || 0) - (a[1].at || 0))[0];
  if (inProgress) return C.unit(inProgress[0]);
  const r = latestPlacement();
  return r ? recommendation(r) : C.nextUnit();
}
