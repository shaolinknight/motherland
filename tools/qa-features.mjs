// Feature checks: one focused scenario per feature, each in a fresh browser profile. These started as
// one-off checks while building each feature; they live here so later changes can't quietly break them.
//   node tools/qa-features.mjs            (BROWSER=webkit|chromium, CHROME_PATH=… as for qa.mjs)
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { chromium, webkit } from 'playwright';
import { ensureServer } from './serve.mjs';

const engine = (process.env.BROWSER || 'webkit') === 'chromium' ? chromium : webkit;
const launchOpts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] } : {};
const require = createRequire(import.meta.url);
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const server = await ensureServer(8123);
const BASE = 'http://localhost:8123/';
const fails = [];
let passed = 0;
const ok = (cond, name, detail = '') => { if (cond) { passed++; console.log('✓', name); } else { fails.push(`${name}${detail ? ` (${detail})` : ''}`); console.log('✗', name, detail); } };

// Fake Vietnamese voice (works in WebKit too, where speechSynthesis can't be redefined).
const fakeSpeech = () => {
  const voices = [{ name: 'Linh', lang: 'vi-VN', voiceURI: 'x', default: false, localService: true }];
  const fake = { getVoices: () => voices, speak(u) { setTimeout(() => u.onend && u.onend(), 20); }, cancel() {}, addEventListener() {} };
  try { Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true }); } catch { /* WebKit */ }
  if (window.speechSynthesis && window.speechSynthesis !== fake) for (const k of Object.keys(fake)) { try { Object.defineProperty(window.speechSynthesis, k, { value: fake[k], configurable: true }); } catch { /* ignore */ } }
  try { window.SpeechSynthesisUtterance = function (t) { this.text = t; }; } catch { /* ignore */ }
};

const browser = await engine.launch(launchOpts);
async function scenario(name, fn, ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true, ...ctxOpts });
  await ctx.addInitScript(fakeSpeech);
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  console.log(`\n— ${name}`);
  try { await fn(p); } catch (e) { fails.push(`${name}: crashed: ${e.message.split('\n')[0]}`); console.log('✗ crashed:', e.message.split('\n')[0]); }
  ok(!errs.length, `${name}: no console errors`, errs.slice(0, 2).join(' | '));
  await ctx.close();
}
const seed = (p, fn, arg) => p.evaluate(fn, arg);
const swipe = (p, fromX = 6, dist = 140) => p.evaluate(({ fromX, dist }) => {
  const t = (type, x) => { const touch = new Touch({ identifier: 7, target: document.body, clientX: x, clientY: 400 }); document.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [touch], changedTouches: [touch], bubbles: true, cancelable: true })); };
  t('touchstart', fromX); for (let i = 1; i <= 7; i++) t('touchmove', fromX + (dist * i) / 7); t('touchend', fromX + dist);
}, { fromX, dist });
const dueCards = async ({ unit, n }) => { const C = await import('/js/course.js'); const S = await import('/js/store.js'); C.unitItems(unit).slice(0, n).forEach(i => { C.cards()[i.id] = { reps: 1, ivl: 1, ease: 2.5, due: 0, lapses: 0, seen: Date.now() - 864e5, last: Date.now() - 864e5 }; }); S.saveNow(); };

await scenario('Flashcards flip both ways, grades appear', async p => {
  await p.goto(BASE + '#/home'); await p.waitForSelector('.hello');
  await seed(p, async () => { const C = await import('/js/course.js'); const S = await import('/js/store.js'); C.unitItems('u03').slice(0, 6).forEach(i => { C.cards()[i.id] = { reps: 1, ivl: 1, ease: 2.5, due: 0, lapses: 0, seen: Date.now() - 864e5, last: Date.now() - 864e5 }; }); S.saveNow(); });
  await p.reload(); await p.click('.do-flash'); await p.waitForSelector('.flip-card');
  const st = () => p.evaluate(() => ({ f: document.querySelector('.flip-card').classList.contains('flipped'), g: !!document.querySelector('.grades') }));
  await p.mouse.click(196, 140); await p.waitForTimeout(500); const a = await st();
  await p.mouse.click(196, 500); await p.waitForTimeout(500); const b = await st();
  ok(a.f && a.g && !b.f && b.g, 'tap anywhere flips, tap again flips back', JSON.stringify([a, b]));
  const h = await p.$eval('.grades .g2', e => e.getBoundingClientRect().height);
  ok(h >= 60, 'grade buttons are big', `${h}px`);
  await p.click('.grades .g2'); await p.waitForTimeout(300);
  ok(!(await st()).g, 'next card starts on its front');
});

await scenario('Review planner: week chart and daily limit', async p => {
  await p.goto(BASE + '#/home'); await p.waitForSelector('.hello');
  await seed(p, dueCards, { unit: 'u03', n: 6 });
  await seed(p, async () => { const S = await import('/js/store.js'); S.settings().reviewCap = 50; S.day().rev = 47; S.saveNow(); });
  await p.reload(); await p.evaluate(() => { location.hash = '#/review'; }); await p.waitForSelector('.week-plan');
  const r = await p.evaluate(async () => ({
    due: document.querySelector('.stats3 .stat b').textContent, note: document.querySelector('.cap-note')?.textContent || '',
    today: document.querySelector('.wp-bars .today .wp-n').textContent, steps: (await import('/js/exercises.js')).flashSteps().length,
  }));
  ok(r.due === '3' && r.steps === 3, 'the limit caps due-now and the flashcard session', JSON.stringify(r));
  ok(/3 more waiting/.test(r.note), 'says how many wait for tomorrow', r.note);
  ok(r.today === '6', 'the week chart still shows everything due today', r.today);
  await p.click('[data-mode="flash"]'); await p.waitForSelector('.flip-card');
  await p.mouse.click(196, 300); await p.waitForSelector('.grades'); await p.click('.grades .g2'); await p.waitForTimeout(300);
  ok(await p.evaluate(async () => (await import('/js/store.js')).day().rev) === 48, 'grading a due card counts toward the limit');
});

await scenario('Question mid-screen, answers at the bottom', async p => {
  await p.goto(BASE + '#/unit/u03'); await p.click('.learn-new'); await p.waitForSelector('.session');
  // Step until a multiple-choice question with a word prompt (skip intros and other exercise types).
  for (let i = 0; i < 20 && !(await p.$('.options .option') && await p.$('.s-body .prompt, .s-body .vi.big, .s-body .en-prompt')); i++) {
    if (await p.$('.options .option')) { await p.click('.options .option'); await p.waitForTimeout(200); await p.click('.s-foot .next').catch(() => {}); }
    else await p.click('.s-foot .btn.primary').catch(() => {});
    await p.waitForTimeout(250);
  }
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => { const pr = document.querySelector('.s-body > :nth-child(2)').getBoundingClientRect(); const o = document.querySelector('.options').getBoundingClientRect(); return { mid: pr.top + pr.height / 2, h: innerHeight, ob: o.bottom }; });
  ok(r.mid > r.h * 0.2 && r.mid < r.h * 0.6, 'prompt sits in the middle area', JSON.stringify(r));
  ok(r.ob > r.h - 60, 'options end at the bottom');
});

await scenario('Edit a card, restore it, typo warning', async p => {
  await p.goto(BASE + '#/unit/u03'); await p.waitForSelector('.flag-it');
  await p.click('.word-row .flag-it'); await p.click('.sheet-actions .btn >> text=Edit card'); await p.waitForSelector('.ed-en');
  await p.fill('.ed-en', 'wedding (party)'); await p.click('.sheet-actions .primary'); await p.waitForTimeout(400);
  ok((await p.$eval('.word-row .muted', e => e.textContent)).includes('wedding (party)'), 'edit shows in the list');
  const flags = await p.evaluate(async () => (await import('/js/store.js')).get().flags.map(f => f.note));
  ok(flags.some(n => n.includes('“wedding” → “wedding (party)”')), 'edit is logged as a flag (old → new)', flags.join('|'));
  await p.reload(); await p.waitForSelector('.word-row');
  ok((await p.$eval('.word-row .muted', e => e.textContent)).includes('wedding (party)'), 'edit survives a reload');
  await p.click('.word-row .flag-it'); await p.click('.sheet-actions .btn >> text=Edit card'); await p.waitForSelector('.ed-en');
  await p.click('.sheet-actions .btn >> text=Restore original'); await p.waitForTimeout(400);
  ok((await p.$eval('.word-row .muted', e => e.textContent)).trim() === 'wedding', 'restore original');
  await p.click('.word-row .flag-it'); await p.click('.sheet-actions .btn >> text=Edit card'); await p.waitForSelector('.ed-vi');
  await p.fill('.ed-vi', 'ci'); await p.click('.sheet-actions .primary'); await p.waitForTimeout(400);
  ok((await p.textContent('.sheet-wrap.open .sheet')).includes('should use k-'), 'impossible spelling warns');
  await p.click('.sheet-actions .btn >> text=Cancel'); await p.waitForTimeout(350); await p.click('.sheet-actions .btn >> text=Cancel'); await p.waitForTimeout(350);
  ok((await p.$eval('.word-row .vi', e => e.textContent)) === 'đám cưới', 'cancel leaves the card unchanged');
});

await scenario('Decks: create, add, write, study, remove', async p => {
  await p.goto(BASE + '#/review'); await p.click('.new-deck'); await p.fill('.ask-text', 'Wedding speech'); await p.click('.sheet-actions .primary');
  await p.waitForSelector('.write-card');
  await p.click('a.btn >> text=Add words'); await p.selectOption('.pick-unit', 'u06'); await p.click('.add-unit'); await p.waitForTimeout(200);
  await p.click('.back'); await p.waitForSelector('.write-card'); await p.waitForTimeout(300);
  await p.click('.write-card'); await p.fill('.wc-vi', 'kính thưa quý vị'); await p.fill('.wc-en', 'ladies and gentlemen'); await p.click('.sheet-actions .primary'); await p.waitForTimeout(400);
  const total = await p.$$eval('.deck-cards .word-row', r => r.length);
  ok(total >= 20, 'whole unit + a written card are in the deck', `${total}`);
  await p.click('.study'); await p.waitForSelector('.flip-card');
  for (let i = 0; i < 80 && await p.$('.session'); i++) {
    if (await p.$('.finish')) { await p.click('.s-foot .done'); break; }
    if (await p.$('.grades')) { await p.click('.grades .g2'); continue; }
    if (await p.$('.flip-card')) { await p.click('.s-foot .btn.primary'); continue; }
    const o = await p.$$('.options .option'); if (o.length) { await o[0].click(); await p.waitForTimeout(100); const nx = await p.$('.s-foot .next'); if (nx) await nx.click(); continue; }
    break;
  }
  await p.waitForTimeout(300);
  ok((await p.$eval('.stats3', e => e.innerText)).includes('0\nnew') || /0\s*new/.test(await p.$eval('.stats3', e => e.innerText)), 'studying the deck reviews every card');
  await p.click('.deck-cards .word-row .opts'); await p.click('.sheet-actions .btn >> text=Remove from this deck'); await p.waitForTimeout(400);
  ok((await p.$$eval('.deck-cards .word-row', r => r.length)) === total - 1, 'remove a card from the deck');
});

await scenario('My words: add, typo warning, practice, check, delete', async p => {
  await p.goto(BASE + '#/mywords'); await p.waitForSelector('.add-word');
  const add = async (vi, en) => { await p.click('.add-word'); await p.waitForSelector('.mw-vi'); await p.fill('.mw-vi', vi); await p.fill('.mw-en', en); await p.click('.sheet-actions .primary'); await p.waitForTimeout(350); };
  await add('ba má', 'mom and dad'); await add('ci', 'typo');
  ok((await p.textContent('.sheet-wrap.open .sheet').catch(() => '')).includes('should use k-'), 'typo warning before saving');
  await p.click('.sheet-actions .btn >> text=Cancel'); await p.waitForTimeout(350); if (await p.$('.mw-vi')) { await p.click('.sheet-actions .btn >> text=Cancel'); await p.waitForTimeout(350); }
  ok((await p.$$eval('.mine .word-row', r => r.length)) === 1, 'only the valid word was saved');
  await p.click('.practice-mine'); await p.waitForSelector('.session');
  ok((await p.textContent('.s-body')).includes('not yet checked'), 'lesson shows “not yet checked”');
  await p.click('.s-close'); await p.waitForTimeout(300); if (await p.$('.sheet-wrap .danger')) await p.click('.sheet-wrap .danger'); await p.waitForTimeout(200); if (await p.$('.session .done')) await p.click('.session .done'); await p.waitForTimeout(300);
  await p.click('.mine .word-row .opts'); await p.click('.sheet-actions .btn >> text=Checked with family'); await p.waitForTimeout(300);
  ok((await p.textContent('.mine .chip')).includes('checked with family'), 'mark as checked');
});

await scenario('Bury, suspend, Hidden filter, Anki export', async p => {
  await p.goto(BASE + '#/home'); await p.waitForSelector('.hello'); await seed(p, dueCards, { unit: 'u03', n: 6 }); await p.reload();
  await p.goto(BASE + '#/words'); await p.waitForSelector('.bank .opts');
  await p.click('.bank .word-row .opts'); await p.click('.sheet-actions .btn >> text=Bury until tomorrow'); await p.waitForTimeout(300);
  await p.click('.bank .word-row:nth-child(2) .opts'); await p.click('.sheet-actions .btn >> text=Suspend'); await p.waitForTimeout(400);
  await p.click('.filters button[data-f="hidden"]'); await p.waitForTimeout(150);
  ok((await p.$$eval('.bank .word-row:not(.hidden)', r => r.length)) === 2, 'Hidden lists the buried and the suspended card');
  ok((await p.evaluate(async () => (await import('/js/course.js')).dueItems().length)) === 4, 'hidden cards leave the review queue');
  await p.goto(BASE + '#/settings/data'); await p.waitForSelector('.export-anki', { state: 'visible' });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.export-anki')]);
  const txt = fs.readFileSync(await dl.path(), 'utf8');
  ok(txt.startsWith('#separator:tab') && txt.includes('đám cưới\twedding'), 'Anki export file');
});

await scenario('Grammar search with and without accents', async p => {
  await p.goto(BASE + '#/grammar'); await p.waitForSelector('.g-search');
  const n = async q => { await p.fill('.g-search', q); await p.waitForTimeout(80); return p.$$eval('.g-link:not(.hidden)', e => e.length); };
  const loose = await n('chua'), exact = await n('chưa'), none = await n('xyzzy');
  ok(loose > exact && exact >= 1, 'accent-free search is looser than accented', `${loose} vs ${exact}`);
  ok(none === 0 && !!(await p.$('.g-empty:not(.hidden)')), 'no results message');
});

await scenario('Settings rows: one open at a time, deep link', async p => {
  await p.goto(BASE + '#/settings'); await p.waitForSelector('.set-sec');
  const open = () => p.$$eval('.set-sec[open]', d => d.map(x => x.dataset.sec).join());
  ok((await open()) === '', 'all rows start closed');
  await p.click('.set-sec[data-sec="study"] > summary'); await p.waitForTimeout(200);
  await p.click('.set-sec[data-sec="audio"] > summary'); await p.waitForTimeout(200);
  ok((await open()) === 'audio', 'opening one closes the other');
  await p.goto(BASE + '#/settings/sync'); await p.reload(); await p.waitForTimeout(600);
  ok((await open()) === 'sync', 'deep link opens its row (even after a re-draw)');
});

await scenario('One-handed: action bar, ⋯ beside Continue, edge swipe', async p => {
  await p.goto(BASE + '#/unit/u03'); await p.waitForSelector('.action-bar .learn-new');
  ok(await p.$eval('.action-bar', e => innerHeight - e.getBoundingClientRect().bottom < 100), 'unit actions sit above the tab bar');
  await swipe(p); await p.waitForTimeout(500);
  ok((await p.evaluate(() => location.hash)) !== '#/unit/u03', 'edge swipe goes back');
  await p.goto(BASE + '#/unit/u03'); await p.reload(); await p.waitForSelector('.unit-hero');
  await swipe(p, 6, 30); await p.waitForTimeout(300); await swipe(p, 150, 150); await p.waitForTimeout(300);
  ok((await p.evaluate(() => location.hash)) === '#/unit/u03', 'short or mid-screen swipes do nothing');
  await p.click('.learn-new'); await p.waitForSelector('.session');
  for (let i = 0; i < 8 && !(await p.$('.options .option')); i++) { await p.click('.s-foot .btn.primary').catch(() => {}); await p.waitForTimeout(250); }
  await p.click('.options .option'); await p.waitForTimeout(300);
  ok(!!(await p.$('.fb-row .fb-more')), '⋯ beside Continue');
  await p.click('.fb-more'); await p.waitForSelector('.sheet-wrap.open'); await swipe(p); await p.waitForTimeout(400);
  ok(!(await p.$('.sheet-wrap.open')) && !!(await p.$('.session')), 'edge swipe closes the sheet first');
}, { isMobile: process.env.BROWSER === 'chromium' || undefined });

await scenario('Placement: stops early, reset takes credit back', async p => {
  await p.goto(BASE + '#/placement'); await p.click('.start'); await p.waitForSelector('.session');
  let asked = 0;
  for (let i = 0; i < 50 && await p.$('.session'); i++) {
    await p.waitForTimeout(200);
    try {
      if (await p.$('.option.idk')) { await p.click('.option.idk', { timeout: 1000 }); asked++; continue; }
      if (await p.$('.tiles')) { const t = await p.$$('.tiles .tile:not([disabled])'); await t[0]?.click(); await p.click('.s-foot .check', { timeout: 1000 }); asked++; continue; }
    } catch { /* re-rendered */ }
  }
  await p.waitForTimeout(500);
  ok(asked <= 12, 'answering “I don’t know” ends the test within the first level', `${asked} questions`);
  await seed(p, async () => {
    const S = await import('/js/store.js'); const C = await import('/js/course.js'); const t = Date.now() - 5 * 864e5, cards = C.cards();
    ['u07', 'u08'].forEach(u => C.unitItems(u).forEach(i => { cards[i.id] = { reps: 1, ivl: 3, ease: 2.5, due: t + 6 * 864e5, lapses: 0, seen: t, last: t }; }));
    cards['u07-w0'].reps = 4; cards['u07-w0'].last = t + 864e5;
    S.lang().placements.push({ at: t, level: 3, label: 'Intermediate', score: 72, c: 21, t: 29, levels: { 1: { c: 8, t: 10 }, 2: { c: 7, t: 10 } }, skills: {}, sections: {}, weak: [] });
    S.saveNow();
  });
  await p.goto(BASE + '#/diagnostics'); await p.reload(); await p.waitForSelector('.reset-placement');
  ok((await p.textContent('.result-hero')).includes('Re-scored'), 'old generous result is re-scored');
  await p.click('.reset-placement'); await p.click('.sheet-actions .danger'); await p.waitForTimeout(500);
  await p.goto(BASE + '#/home'); await p.reload(); await p.waitForSelector('.hello');
  const after = await p.evaluate(async () => { const C = await import('/js/course.js'); const S = await import('/js/store.js'); return { p: S.lang().placements.length, credit: C.unitItems('u08').filter(i => C.cards()[i.id]).length, kept: !!C.cards()['u07-w0'] }; });
  ok(after.p === 0 && after.credit === 0 && after.kept, 'reset removes results + credit, keeps well-reviewed words, survives reload', JSON.stringify(after));
});

await scenario('Test out a unit (failing keeps it unskipped)', async p => {
  await p.goto(BASE + '#/unit/u12'); await p.waitForSelector('.test-out'); await p.click('.test-out'); await p.click('.sheet-actions .primary'); await p.waitForSelector('.session');
  for (let i = 0; i < 40 && await p.$('.session'); i++) {
    await p.waitForTimeout(150);
    try {
      if (await p.$('.option.idk')) { await p.click('.option.idk', { timeout: 1000 }); continue; }
      if (await p.$('.tiles')) { await p.click('.s-foot .check', { timeout: 1000 }).catch(() => {}); const t = await p.$$('.tiles .tile:not([disabled])'); if (t[0]) { await t[0].click(); await p.click('.s-foot .check', { timeout: 1000 }); } continue; }
      const o = await p.$$('.options .option'); if (o.length) { await o[0].click({ timeout: 1000 }); continue; }
    } catch { /* re-rendered */ }
  }
  await p.waitForTimeout(400);
  ok((await p.evaluate(async () => { const C = await import('/js/course.js'); return C.unitItems('u12').filter(i => C.cards()[i.id]).length; })) === 0, 'a failed test-out credits nothing');
});

await scenario('Normal site is never seeded with sample data', async p => {
  await p.goto(BASE + '#/home'); await p.waitForSelector('.hello');
  ok((await p.evaluate(async () => Object.keys((await import('/js/course.js')).cards()).length)) === 0, 'normal site is not seeded');
  ok(!(await p.$('.preview-banner')), 'no preview banner');
});

await scenario('Preview sample data (?demo)', async p => {
  await p.goto(BASE + '?demo#/home'); await p.waitForSelector('.preview-banner');
  const s = await p.evaluate(async () => { const C = await import('/js/course.js'); const S = await import('/js/store.js'); const D = await import('/js/decks.js'); const c = C.cards(); return { cards: Object.keys(c).length, leech: Object.values(c).some(x => x.leech), decks: D.list().length, placements: S.lang().placements.length }; });
  ok(s.cards > 100 && s.leech && s.decks === 2 && s.placements === 1, 'sample data has cards, a leech, 2 decks, an old placement', JSON.stringify(s));
  ok((await p.textContent('.hello')).includes('freeze'), 'streak freeze shows on Home');
});

for (const scheme of ['light', 'dark']) {
  await scenario(`Language palettes, ${scheme}: contrast`, async p => {
    for (const lang of ['vi', 'ko', 'ja', 'es']) {
      await p.goto(BASE + '#/home'); await p.waitForSelector('.hello');
      await p.evaluate(async l => { const S = await import('/js/store.js'); const T = await import('/js/theme.js'); S.get().lang = l; T.applyTheme(); }, lang);
      const bad = [];
      for (const r of ['home', 'progress', 'settings/study', 'review']) {
        await p.evaluate(r2 => { location.hash = '#/' + r2; }, r); await p.waitForTimeout(350);
        await p.addScriptTag({ content: AXE });
        const v = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ['color-contrast'] })).violations.length);
        if (v) bad.push(r);
      }
      ok(!bad.length, `${lang} palette has no contrast problems`, bad.join(','));
      await p.evaluate(async () => { (await import('/js/store.js')).get().lang = 'vi'; });
    }
  }, { colorScheme: scheme });
}

await browser.close(); server?.close();
console.log(fails.length ? `\n${fails.length} feature check(s) failed:\n✗ ${fails.join('\n✗ ')}` : `\n✅ All ${passed} feature checks passed`);
process.exitCode = fails.length ? 1 : 0;
