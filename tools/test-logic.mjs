// Unit tests for pure logic — run: node tools/test-logic.mjs
import assert from 'node:assert/strict';
import { compare, toneVariants, toneOf, stripTones, syllableDiff } from '../js/vitext.js';
import { newCard, grade, nextInterval, fromSM2, fuzzRange, isDue, tomorrow } from '../js/srs.js';
import fs from 'node:fs';
import { mergeStates } from '../js/merge.js';
import { ankiText } from '../js/ankiexport.js';
import { streakInfo, longestStreak } from '../js/streak.js';
import { spellingProblems } from '../js/vispell.js';
import { skillWeights, focusSkills, weightedOrder } from '../js/focus.js';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('✓', name); };

t('exact answer', () => assert.equal(compare('Xin chào!', 'xin chào'), 'exact'));
t('missing tones = partial', () => assert.equal(compare('xin chao', 'xin chào'), 'tones'));
t('no diacritics at all = partial', () => assert.equal(compare('cam on', 'cảm ơn'), 'letters'));
t('đ without stroke = partial', () => assert.equal(compare('di lam', 'đi làm'), 'letters'));
t('wrong word = wrong', () => assert.equal(compare('tạm biệt', 'xin chào'), 'wrong'));
t('empty = wrong', () => assert.equal(compare('  ', 'xin chào'), 'wrong'));
t('NFD input (iOS keyboard) still exact', () => assert.equal(compare('cảm ơn'.normalize('NFD'), 'cảm ơn'), 'exact'));
t('six variants for open syllable', () => assert.deepEqual(toneVariants('mà'), ['ma', 'má', 'mà', 'mả', 'mã', 'mạ']));
t('stop final only sắc/nặng', () => assert.deepEqual(toneVariants('đẹp'), ['đép', 'đẹp']));
t('ệ recomposes correctly', () => assert.deepEqual(toneVariants('Việt'), ['Viết', 'Việt']));
t('ơ with tone recomposes', () => assert.ok(toneVariants('mới').includes('mỡi')));
t('toneless syllable returns null', () => assert.equal(toneVariants('xin'), null));
t('toneOf', () => { assert.equal(toneOf('mã'), 4); assert.equal(toneOf('ma'), 0); assert.equal(toneOf('mạ'), 5); });
t('stripTones keeps vowel marks', () => assert.equal(stripTones('Việt Nam'), 'Viêt Nam'));
t('syllable diff flags tone-only mistakes', () => {
  const d = syllableDiff('cam ơn', 'cảm ơn');
  assert.equal(d[0].tonesOnly, true); assert.equal(d[1].ok, true);
});
t('SRS: forget = ~10 minutes', () => assert.ok(nextInterval(newCard(), 0) < 0.01));
const mid = () => 0.5;   // fixed "random" so fuzz is repeatable
const D = 86400000;
t('FSRS: first answers give Anki-like intervals (Hard 1d, Good 3d, Easy ~16d)', () => {
  assert.deepEqual([1, 2, 3].map(g => nextInterval(newCard(), g)), [1, 3, 16]);
});
t('FSRS: intervals grow when answered Good on time', () => {
  let c = newCard(), now = 0; const ivls = [];
  for (let i = 0; i < 6; i++) { c = grade(c, 2, now, { rng: mid }); ivls.push(c.ivl); now = c.due; }
  for (let i = 1; i < ivls.length; i++) assert.ok(ivls[i] > ivls[i - 1], ivls.join(','));
});
t('FSRS: Easy > Good > Hard for the same card', () => {
  const c = grade(newCard(), 2, 0, { rng: mid }), at = c.due;
  const [h, g, e] = [1, 2, 3].map(x => nextInterval(c, x, { now: at }));
  assert.ok(h < g && g < e, `${h} ${g} ${e}`);
});
t('FSRS: a lapse lowers stability, raises difficulty, resets reps', () => {
  let c = newCard(), now = 0;
  for (let i = 0; i < 3; i++) { c = grade(c, 2, now, { rng: mid }); now = c.due; }
  const f = grade(c, 0, now);
  assert.ok(f.s < c.s && f.d > c.d); assert.equal(f.reps, 0); assert.equal(f.lapses, 1); assert.ok(f.ivl < 0.01);
});
t('FSRS: difficulty stays within 1–10', () => {
  let c = newCard(), now = 0; for (let i = 0; i < 30; i++) { c = grade(c, 0, now); now += D; } assert.ok(c.d <= 10);
  c = newCard(); now = 0; for (let i = 0; i < 30; i++) { c = grade(c, 3, now, { rng: mid }); now = c.due; } assert.ok(c.d >= 1);
});
t('FSRS: higher desired retention means shorter intervals', () => {
  const c = grade(grade(newCard(), 2, 0, { rng: mid }), 2, 3 * D, { rng: mid });
  assert.ok(nextInterval(c, 2, { now: c.due, retention: 0.95 }) < nextInterval(c, 2, { now: c.due, retention: 0.8 }));
});
t('FSRS: interval never exceeds a year', () => { let c = newCard(), now = 0; for (let i = 0; i < 25; i++) { c = grade(c, 3, now, { rng: mid }); now = c.due; } assert.ok(c.ivl <= 365); });
t('FSRS: old SM-2 card converts (interval → stability, ease → difficulty)', () => {
  const old = { reps: 4, ivl: 20, ease: 2.5, due: 20 * D, lapses: 1, seen: 1, last: 0 };
  const f = fromSM2(old); assert.equal(f.s, 20); assert.equal(f.d, 5);
  assert.ok(fromSM2({ ...old, ease: 1.3 }).d > 8);
  const g = grade(old, 2, 20 * D, { rng: mid });   // graded on time
  assert.ok(g.ivl > 20 && g.reps === 5 && g.lapses === 1 && g.s > 20, JSON.stringify(g));
});
t('fuzz: none under 2.5 days, about ±15% at a week, ±5% at 100 days', () => {
  assert.deepEqual(fuzzRange(2), [2, 2]);
  const [a, b] = fuzzRange(7); assert.ok(a >= 5 && b <= 9 && b - a >= 2);
  const [c, d] = fuzzRange(100); assert.ok(c >= 92 && d <= 108);
});
t('fuzz: cards learned together spread over several days', () => {
  let r = 0; const rng = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  const dues = new Set(Array.from({ length: 20 }, () => grade({ ...newCard(), s: 30, d: 5, reps: 3, last: 0 }, 2, 30 * D, { rng }).ivl));
  assert.ok(dues.size >= 3, [...dues].join(','));
});
t('leech: flagged at 8 lapses, again at 12', () => {
  let c = newCard(); const at = [];
  for (let i = 1; i <= 12; i++) { c = grade({ ...c, leechNew: false }, 0, i * D); if (c.leechNew) at.push(i); }
  assert.deepEqual(at, [8, 12]); assert.ok(c.leech);
});
t('bury/suspend hide a card from reviews', () => {
  const c = { ...newCard(), due: 0 };
  assert.ok(isDue(c, 10)); assert.ok(!isDue({ ...c, suspended: true }, 10));
  assert.ok(!isDue({ ...c, buriedUntil: tomorrow(10) }, 10)); assert.ok(isDue({ ...c, buriedUntil: 5 }, 10));
});

// Sync merge: two devices' progress must combine, not overwrite each other.
const card = (last, reps = 1) => ({ reps, ivl: 1, ease: 2.5, due: last + 1, lapses: 0, seen: 1, last });
const dev = (over) => ({ v: 1, updatedAt: 1, deviceId: 'x', lang: 'vi', settings: { dailyGoal: 60, syncUrl: '', syncKey: '' },
  langs: { vi: { cards: {}, lessons: {}, placements: [], skills: {}, games: {} } }, days: {}, flags: [], pending: [], ...over });
{
  const phone = dev({ updatedAt: 200, deviceId: 'phone', settings: { dailyGoal: 60, syncUrl: 'U', syncKey: 'K' },
    langs: { vi: { cards: { a: card(100), b: card(150, 2) }, lessons: { u01: { at: 5, done: false } }, placements: [{ at: 1, level: 1 }], skills: { tones: { c: 3, t: 5 } }, games: { speed: { best: 9, at: 10, runs: [{ score: 9, at: 10 }] } } } },
    days: { '2026-11-20': { xp: 50, ms: 10, c: 5, t: 6, words: 2, skills: { vocab: { c: 5, t: 6 } } } },
    flags: [{ id: 'f1', synced: true }], pending: [{ id: 'p1' }] });
  const ipad = dev({ updatedAt: 300, deviceId: 'ipad', settings: { dailyGoal: 100, syncUrl: '', syncKey: '' },
    langs: { vi: { cards: { a: card(90), b: card(300, 3), c: card(120) }, lessons: { u01: { at: 9, done: true }, u02: { at: 9 } }, placements: [{ at: 1, level: 1 }, { at: 2, level: 2 }], skills: { tones: { c: 4, t: 4 } }, games: { speed: { best: 12, at: 20, runs: [{ score: 9, at: 10 }, { score: 12, at: 20 }] } } } },
    days: { '2026-11-20': { xp: 30, ms: 40, c: 3, t: 3, words: 1, skills: { vocab: { c: 3, t: 3 } } }, '2026-11-21': { xp: 20, ms: 1, c: 1, t: 1, words: 0, skills: {} } },
    flags: [{ id: 'f1', synced: false }, { id: 'f2', synced: false }] });
  const m = mergeStates(phone, ipad);
  const L = m.langs.vi;
  t('merge: card reviewed later on either device wins', () => { assert.equal(L.cards.a.last, 100); assert.equal(L.cards.b.last, 300); });
  t('merge: cards only on the other device are added', () => assert.ok(L.cards.c));
  t('merge: lessons keep latest and stay done', () => { assert.equal(L.lessons.u01.done, true); assert.ok(L.lessons.u02); });
  t('merge: placements and game runs union without duplicates', () => { assert.equal(L.placements.length, 2); assert.equal(L.games.speed.runs.length, 2); assert.equal(L.games.speed.best, 12); });
  t('merge: day logs take the larger value per field (no double counting)', () => {
    const d = m.days['2026-11-20']; assert.equal(d.xp, 50); assert.equal(d.ms, 40); assert.equal(d.skills.vocab.t, 6); assert.ok(m.days['2026-11-21']);
  });
  t('merge: flags union, synced state kept from this phone', () => { assert.equal(m.flags.length, 2); assert.equal(m.flags.find(f => f.id === 'f1').synced, true); });
  t('merge: newer settings win but sync URL/password stay local', () => { assert.equal(m.settings.dailyGoal, 100); assert.equal(m.settings.syncUrl, 'U'); assert.equal(m.settings.syncKey, 'K'); });
  t('merge: device id and unsent sessions stay local', () => { assert.equal(m.deviceId, 'phone'); assert.deepEqual(m.pending, [{ id: 'p1' }]); });
  t('merge: is symmetric for progress', () => { const r = mergeStates(ipad, phone).langs.vi; assert.deepEqual(Object.keys(r.cards).sort(), ['a', 'b', 'c']); assert.equal(r.cards.b.last, 300); });
  t('merge: a later suspend on the other device wins over an older review', () => {
    const a = { ...card(100), suspended: true, edited: 500 }, b = card(300);
    assert.equal(mergeStates(dev({ langs: { vi: { cards: { x: b } } } }), dev({ langs: { vi: { cards: { x: a } } } })).langs.vi.cards.x.suspended, true);
  });
  t('merge: no remote copy leaves local untouched', () => assert.equal(mergeStates(phone, null), phone));
}

t('Anki export: headers, one tab-separated note per item, grammar skipped, tags', () => {
  const txt = ankiText([
    { id: 'u03-w0', unit: 'u03', kind: 'word', vi: 'đám cưới', en: 'wedding', north: '', note: '' },
    { id: 'u03-w1', unit: 'u03', kind: 'word', vi: 'trái\tcây', en: 'fruit', north: 'quả', note: 'line\nbreak' },
    { id: 'u03-g0', unit: 'u03', kind: 'grammar', vi: 'x', en: 'y' },
  ], { 'u03-w1': { leech: true } });
  const lines = txt.trim().split('\n');
  assert.equal(lines[0], '#separator:tab'); assert.ok(lines.includes('#notetype:Basic (and reversed card)'));
  const notes = lines.filter(l => !l.startsWith('#'));
  assert.equal(notes.length, 2);
  assert.deepEqual(notes[0].split('\t'), ['đám cưới', 'wedding', 'motherland u03 word']);
  const [front, back, tags] = notes[1].split('\t');
  assert.equal(front, 'trái cây'); assert.equal(back, 'fruit · Hanoi: quả · line break'); assert.ok(tags.endsWith('leech'));
});

// Streak freeze: one missed day per Monday–Sunday week is forgiven.
{
  const log = (...keys) => Object.fromEntries(keys.map(k => [k, { xp: 10 }]));
  const wed = new Date('2026-11-18T09:00:00');   // a Wednesday
  t('streak: consecutive days count, today pending does not break it', () => {
    assert.equal(streakInfo(log('2026-11-16', '2026-11-17'), wed).n, 2);
    assert.equal(streakInfo(log('2026-11-16', '2026-11-17', '2026-11-18'), wed).n, 3);
  });
  t('streak: one missed day in a week is frozen, not counted', () => {
    const r = streakInfo(log('2026-11-14', '2026-11-15', '2026-11-17'), wed);   // missed Mon 16th
    assert.equal(r.n, 3); assert.deepEqual(r.frozen, ['2026-11-16']); assert.equal(r.freezeLeft, false);
  });
  t('streak: two missed days in the same week break it', () => {
    assert.equal(streakInfo(log('2026-11-10', '2026-11-11', '2026-11-14'), new Date('2026-11-15T09:00:00')).n, 1);
  });
  t('streak: a freeze in a past week leaves this week\'s freeze ready', () => {
    const r = streakInfo(log('2026-11-12', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17'), wed);   // missed Fri 13th
    assert.equal(r.n, 5); assert.equal(r.freezeLeft, true);
  });
  t('streak: no activity → 0, and leading missed days are not counted', () => {
    assert.equal(streakInfo({}, wed).n, 0);
    assert.equal(streakInfo(log('2026-11-10'), wed).n, 0);
  });
  t('longest streak bridges one missed day per week', () => {
    assert.equal(longestStreak(log('2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06')), 4);
    assert.equal(longestStreak(log('2026-11-02', '2026-11-05')), 1);
  });
}

t('spelling: valid Vietnamese passes, impossible spellings are caught', () => {
  assert.deepEqual(spellingProblems('ba má, cảm ơn nghen'), []);
  assert.equal(spellingProblems('ci').length, 1);          // k- before i
  assert.equal(spellingProblems('mat').length, 1);         // -t needs sắc/nặng
  assert.equal(spellingProblems('mãá').length >= 1, true); // two tone marks
  assert.deepEqual(spellingProblems('wifi ok'), []);       // allowed loanwords
});
t('merge: deleted My words stay deleted across devices', () => {
  const w = { id: 'my-1', vi: 'ba', en: 'dad', at: 1, edited: 1 };
  const a = dev({ langs: { vi: { cards: {}, myWords: { 'my-1': { ...w, deleted: true, edited: 9 } } } } });
  const b = dev({ langs: { vi: { cards: {}, myWords: { 'my-1': w, 'my-2': { ...w, id: 'my-2' } } } } });
  const m = mergeStates(b, a).langs.vi.myWords; assert.equal(m['my-1'].deleted, true); assert.ok(m['my-2']);
});

// Content contract: item IDs come from positions, so units are only ever appended.
const BASE_SIZES = '6/4 16/7 16/6 18/6 16/6 16/8 16/7 17/7 18/6 16/6 20/6 18/7 17/6 15/6 16/6 16/6 17/6 16/6 16/6 16/6 15/6 16/6 15/6 15/6 15/6 12/6 12/6 12/6 12/6 12/6 12/6 12/6';   // u00–u31 (everything shipped through v1.3)
{
  const vi = (await import('../data/vi.js')).default;
  t('units are in order (u00, u01, …) with no gaps', () => assert.deepEqual(vi.units.map(u => u.id), Array.from({ length: vi.units.length }, (_, i) => `u${String(i).padStart(2, '0')}`)));
  t('shipped units keep their size (append-only)', () => {
    // Word/phrase counts of every shipped unit; a change here would shift item IDs and break progress.
    const sizes = vi.units.slice(0, 32).map(u => `${u.words.length}/${u.phrases.length}`).join(' ');
    assert.equal(sizes, BASE_SIZES);
  });
  t('new units are marked as needing a family check', () => assert.ok(vi.units.slice(25).every(u => u.review === true)));
  t('every new unit has a grammar point with 3+ drills', () => assert.ok(vi.units.slice(25).every(u => u.grammar.length && u.grammar.every(g => g.drills.length >= 3))));
}

t('placement focus: weak skills weigh 3×, shaky 2×, thin evidence ignored', () => {
  const r = { skills: { tones: { c: 1, t: 4 }, listening: { c: 2, t: 3 }, vocab: { c: 9, t: 10 }, grammar: { c: 0, t: 1 } } };
  assert.deepEqual(skillWeights(r), { tones: 3, listening: 2, vocab: 1 });
  assert.deepEqual(focusSkills(r), ['tones', 'listening']);
  assert.deepEqual(skillWeights(null), {});
});
t('placement focus: heavier exercise types come first more often, lighter ones still appear', () => {
  let seed = 1; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let heavyFirst = 0, lightFirst = 0;
  for (let i = 0; i < 2000; i++) { const top = weightedOrder([{ n: 'a', weight: 3 }, { n: 'b', weight: 1 }], rng)[0].n; top === 'a' ? heavyFirst++ : lightFirst++; }
  assert.ok(heavyFirst > 1350 && heavyFirst < 1650, `${heavyFirst}`);   // expected 75%
  assert.ok(lightFirst > 0);
});

{
  const { COURSES, UPCOMING } = await import('../js/course.js?palette');
  const css = fs.readFileSync('css/app.css', 'utf8');
  t('palettes: Vietnamese uses the :root defaults; ko/ja/es have light + dark blocks', () => {
    assert.ok(COURSES.vi && /--brand: #C8102E/.test(css));
    for (const { code } of UPCOMING) {
      assert.ok(css.includes(`:root[data-lang="${code}"] {`), `${code}: no light palette`);
      assert.ok(css.includes(`:root[data-lang="${code}"][data-theme="dark"]`), `${code}: no dark palette`);
    }
  });
}
{
  const { levelFrom, effectiveLevel, shouldStop, placementCredit } = await import('../js/levels.js');
  t('placement v1.4: a level needs 80% overall', () => {
    assert.equal(levelFrom({ 1: { c: 8, t: 10 }, 2: { c: 7, t: 10 } }), 1);
    assert.equal(levelFrom({ 1: { c: 7, t: 10 } }), 0);
  });
  t('placement v1.4: and 2/3 of its production questions', () => {
    assert.equal(levelFrom({ 1: { c: 9, t: 10 } }, { 1: { c: 1, t: 3 } }), 0);   // guessed the recognition ones
    assert.equal(levelFrom({ 1: { c: 9, t: 10 } }, { 1: { c: 2, t: 3 } }), 1);
  });
  t('placement v1.4: levels must be passed in order', () => assert.equal(levelFrom({ 1: { c: 5, t: 10 }, 2: { c: 10, t: 10 } }), 0));
  const R = (level, correct) => ({ level, correct });
  t('adaptive test: keeps going while a level is passable', () => {
    assert.equal(shouldStop([...Array(10)].map(() => R(1, true)), { 1: 12, 2: 12, 3: 12 }), false);
  });
  t('adaptive test: stops once a level has more than half wrong', () => {
    const rs = [...Array(12)].map(() => R(1, true)).concat([...Array(7)].map(() => R(2, false)));
    assert.equal(shouldStop(rs, { 1: 12, 2: 12, 3: 12 }), true);
  });
  t('reset: takes back placement credit, keeps well-reviewed words and test-outs', () => {
    const cards = {
      a: { seen: 100, reps: 1, placed: 2 },          // v1.4 test credit → back to lessons
      b: { seen: 100, reps: 4, placed: 2 },          // reviewed 3+ times → stays
      c: { seen: 200, reps: 1, placed: 'unit' },     // tested out → stays (not listed)
      ...Object.fromEntries([...Array(6)].map((_, i) => [`old${i}`, { seen: 300, reps: 1 }])),   // old bulk button, no marker
      lesson: { seen: 400, reps: 1 },                // a normal lesson card → never touched
    };
    const { remove, keep } = placementCredit(cards);
    assert.deepEqual(remove.sort(), ['a', 'old0', 'old1', 'old2', 'old3', 'old4', 'old5']);
    assert.deepEqual(keep, ['b']);
  });
  t('placement v1.4: an old generous result is re-scored down', () => {
    // 70% at every level used to mean Intermediate (level 3); under 80% it's Beginner.
    assert.equal(effectiveLevel({ level: 3, levels: { 1: { c: 7, t: 10 }, 2: { c: 7, t: 10 }, 3: { c: 7, t: 10 } } }), 0);
    assert.equal(effectiveLevel({ level: 2, levels: { 1: { c: 9, t: 10 }, 2: { c: 7, t: 10 } } }), 1);
  });
}
{
  const C = await import('../js/course.js?edits');
  const it = C.item('u03-w0'), orig = it.en;
  t('card edit: your text is laid over the course item', () => {
    C.editsMap()['u03-w0'] = { vi: it.vi, en: 'my wedding', north: '', note: 'from Grandma', edited: 5 };
    C.applyEdits();
    assert.equal(C.item('u03-w0').en, 'my wedding'); assert.equal(C.item('u03-w0').note, 'from Grandma'); assert.equal(C.item('u03-w0').edited, true);
  });
  t('card edit: restoring brings the original back', () => {
    C.editsMap()['u03-w0'] = { reset: true, edited: 9 }; C.applyEdits();
    assert.equal(C.item('u03-w0').en, orig); assert.equal(C.item('u03-w0').edited, false);
  });
  t('card edit: grammar items are never edited', () => {
    C.editsMap()['u03-g0'] = { en: 'x', edited: 1 }; C.applyEdits(); assert.notEqual(C.item('u03-g0').en, 'x');
  });
  t('merge: newer card edit (or restore) wins across devices', () => {
    const a = dev({ langs: { vi: { cards: {}, edits: { 'u03-w0': { en: 'old', edited: 1 } } } } });
    const b = dev({ langs: { vi: { cards: {}, edits: { 'u03-w0': { reset: true, edited: 2 } } } } });
    assert.equal(mergeStates(a, b).langs.vi.edits['u03-w0'].reset, true);
  });
}
// Shipping checks: a module missing from the service worker breaks offline use, and one missing from
// the preload list brings back the slow import waterfall.
const modules = ['js', 'data'].flatMap(d => fs.readdirSync(d).filter(f => f.endsWith('.js')).map(f => `${d}/${f}`));
const sw = fs.readFileSync('sw.js', 'utf8'), html = fs.readFileSync('index.html', 'utf8');
t('every module is cached by the service worker', () => modules.forEach(m => assert.ok(sw.includes(`'./${m}'`), `${m} missing from FILES in sw.js`)));
t('every module is preloaded', () => modules.forEach(m => assert.ok(html.includes(`<link rel="modulepreload" href="${m}">`), `${m} missing from modulepreload in index.html`)));
t('service worker shell is not the redirecting /index.html', () => assert.ok(!sw.includes("'./index.html'")));

// State contract: a v1.1 save (no haptics setting) must load with progress intact and new defaults filled in.
const v11 = { v: 1, updatedAt: 1700000000000, deviceId: 'old', lang: 'vi',
  settings: { showHanoi: false, rate: 0.7, voiceURI: '', forceAudio: false, dailyGoal: 100, newPerLesson: 8, syncUrl: 'https://x', syncKey: 'k', lastSync: 1, syncError: '' },
  langs: { vi: { cards: { 'u03-w0': { reps: 2, ivl: 3, ease: 2.5, due: 1, lapses: 0, seen: 2, last: 1 } }, lessons: {}, placements: [], skills: {}, games: {} } },
  days: { '2026-11-01': { xp: 40, ms: 1, c: 4, t: 5, words: 2, skills: {} } }, flags: [], pending: [] };
const mem = { 'motherland.v1': JSON.stringify(v11) };
globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } };
const S = await import('../js/store.js?v11');   // fresh instance that reads the stubbed storage
t('v1.1 state loads: progress kept', () => { assert.equal(S.lang().cards['u03-w0'].reps, 2); assert.equal(S.get().days['2026-11-01'].xp, 40); });
t('v1.1 state loads: user settings kept, haptics defaults on', () => {
  const st = S.settings(); assert.equal(st.showHanoi, false); assert.equal(st.dailyGoal, 100); assert.equal(st.syncKey, 'k'); assert.equal(st.haptics, true);
});
t('saving keeps the storage key and shape', () => { S.saveNow(); const back = JSON.parse(mem['motherland.v1']); assert.equal(back.v, 1); assert.equal(back.settings.haptics, true); assert.ok(back.langs.vi.cards['u03-w0']); });
mem['motherland.v1'] = '{not json';
const S2 = await import('../js/store.js?corrupt');   // fresh module instance reads storage again
t('corrupted storage: app starts with a fresh state', () => { assert.equal(S2.get().v, 1); assert.deepEqual(S2.get().langs, {}); });
t('corrupted storage: the unreadable data is kept, not overwritten', () => assert.equal(mem['motherland.v1.unreadable'], '{not json'));
console.log(`\n${n} tests passed`);
