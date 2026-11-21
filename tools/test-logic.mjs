// Unit tests for pure logic — run: node tools/test-logic.mjs
import assert from 'node:assert/strict';
import { compare, toneVariants, toneOf, stripTones, syllableDiff } from '../js/vitext.js';
import { newCard, grade, nextInterval } from '../js/srs.js';
import fs from 'node:fs';
import { mergeStates } from '../js/merge.js';

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
t('SRS: intervals grow', () => {
  let c = newCard(); const ivls = [];
  for (let i = 0; i < 5; i++) { c = grade(c, 2, 0); ivls.push(c.ivl); }
  for (let i = 1; i < ivls.length; i++) assert.ok(ivls[i] > ivls[i - 1], ivls.join(','));
});
t('SRS: lapse resets reps and lowers ease', () => {
  let c = grade(grade(newCard(), 2), 2); const e = c.ease;
  c = grade(c, 0); assert.equal(c.reps, 0); assert.equal(c.lapses, 1); assert.ok(c.ease < e);
});
t('SRS: ease never below 1.3', () => { let c = newCard(); for (let i = 0; i < 30; i++) c = grade(c, 0); assert.ok(c.ease >= 1.3); });

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
  t('merge: no remote copy leaves local untouched', () => assert.equal(mergeStates(phone, null), phone));
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
