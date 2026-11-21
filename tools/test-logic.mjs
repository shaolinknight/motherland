// Unit tests for pure logic — run: node tools/test-logic.mjs
import assert from 'node:assert/strict';
import { compare, toneVariants, toneOf, stripTones, syllableDiff } from '../js/vitext.js';
import { newCard, grade, nextInterval, fromSM2, fuzzRange, isDue, tomorrow } from '../js/srs.js';
import fs from 'node:fs';
import { mergeStates } from '../js/merge.js';
import { ankiText } from '../js/ankiexport.js';
import { streakInfo, longestStreak } from '../js/streak.js';

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
const S = await import('../js/store.js');
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
