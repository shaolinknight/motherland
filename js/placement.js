// Placement test + diagnostics: finds your level and what to work on.
import * as C from './course.js';
import * as S from './store.js';
import { mcq, tone, gdrill, run } from './exercises.js';
import { audioAvailable } from './speech.js';
import { sample, shuffle, pct } from './util.js';

const SKILL_NAMES = { vocab: 'Vocabulary', reading: 'Reading', grammar: 'Grammar', listening: 'Listening', tones: 'Tones', speaking: 'Speaking' };
export const skillName = k => SKILL_NAMES[k] || k;

function levelItems(level, kind) {
  return C.all().filter(i => i.level === level && i.kind === kind && !i.review);   // only checked content is tested
}

export function buildTest() {
  const steps = [];
  for (const lvl of [1, 2, 3]) {
    const block = [];
    sample(levelItems(lvl, 'word'), 3).forEach(i => block.push(mcq(i, 'vi2en')));
    sample(levelItems(lvl, 'phrase'), 2).forEach(i => block.push(mcq(i, 'vi2en')));
    for (const i of shuffle(levelItems(lvl, 'word'))) { const t = tone(i); if (t) { block.push(t); break; } }
    sample(levelItems(lvl, 'grammar'), 2).forEach(i => { const d = gdrill(i); if (d) block.push(d); });
    if (audioAvailable(C.get().speechLang)) sample(levelItems(lvl, 'word'), 1).forEach(i => block.push(mcq(i, 'audio2en')));
    steps.push(...shuffle(block));
  }
  return steps;
}

export function start(onDone) {
  run({ title: 'Placement test', steps: buildTest(), test: true, activity: 'placement', onFinish: out => {
    if (out.early && out.results.length < 6) return onDone && onDone(null);
    const result = score(out.results);
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
  let level = 0;
  for (const l of [1, 2, 3]) { const x = levels[l]; if (x && x.t && x.c / x.t >= 0.67) level = l; else break; }
  const skills = by('skill');
  const sectionsRaw = {};
  results.forEach(r => { const u = C.unit(r.unit); if (!u) return; const k = u.section; (sectionsRaw[k] ||= { c: 0, t: 0 }); sectionsRaw[k].t++; if (r.correct) sectionsRaw[k].c++; });
  // Lowest-scoring first, capped so the list stays actionable.
  const low = (m, name, max) => Object.entries(m).filter(([, v]) => v.t >= 2 && v.c / v.t < 0.6)
    .sort((a, b) => a[1].c / a[1].t - b[1].c / b[1].t).slice(0, max).map(([k]) => name(k));
  const weak = [...low(skills, skillName, 3), ...low(sectionsRaw, k => `${k} topics`, 2)];
  const c = results.filter(r => r.correct).length;
  return { at: Date.now(), level, label: C.get().levels[level], score: pct(c, results.length), c, t: results.length, levels, skills, sections: sectionsRaw, weak };
}

// Units the placement says you already know → put them into review (not "mastered").
export function applyLevel(level) {
  if (!level) return 0;
  const cards = C.cards(); let n = 0; const now = Date.now();
  C.get().units.filter(u => u.level <= level).forEach(u => C.unitItems(u.id).forEach(i => {
    if (cards[i.id]) return;
    const days = 1 + Math.random() * 5;
    cards[i.id] = { reps: 1, ivl: 3, ease: 2.5, due: now + days * 86400000, lapses: 0, seen: now, last: now };
    n++;
  }));
  S.save();
  return n;
}

export function recommendation(result) {
  if (!result) return null;
  const units = C.get().units;
  const target = Math.min(result.level + 1, 3);
  return units.find(u => u.level >= target && C.unitProgress(u.id).learned < C.unitItems(u.id).length) || C.nextUnit();
}
