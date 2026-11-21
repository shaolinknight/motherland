// Automated click-through QA. Not part of the app — run from the project folder:
//   python3 -m http.server 8123 &  node tools/qa.mjs
import { chromium, webkit } from 'playwright';
import { ensureServer } from './serve.mjs';

// BROWSER=webkit (default, closest to iPhone Safari) or chromium. CHROME_PATH lets you use an installed Chrome.
const engine = (process.env.BROWSER || 'webkit') === 'chromium' ? chromium : webkit;
const launchOpts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] } : {};
const server = await ensureServer(8123);
import fs from 'node:fs';

const BASE = 'http://localhost:8123/';
const OUT = process.env.SHOTS || 'test-results/screenshots';
fs.mkdirSync(OUT, { recursive: true });
const DEVICES = [
  { name: 'iphone', width: 393, height: 852, dpr: 3 },
  { name: 'iphone-plus', width: 430, height: 932, dpr: 3 },
  { name: 'iphone-se', width: 375, height: 667, dpr: 2 },
  { name: 'ipad', width: 820, height: 1180, dpr: 2 },
];
const problems = [];

// Fake iOS speech engine with a Vietnamese voice.
const fakeSpeech = () => {
  const voices = [{ name: 'Linh', lang: 'vi-VN', voiceURI: 'com.apple.voice.Linh', default: false, localService: true }];
  const listeners = {};
  const fake = {
    getVoices: () => voices, speaking: false, pending: false,
    speak(u) { window.__spoken = (window.__spoken || []); window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 30); },
    cancel() {}, addEventListener(t, f) { listeners[t] = f; },
  };
  Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
};

async function overflow(page, where) {
  // Measure the settled layout, not a step that is still sliding in.
  // Test mode auto-advances, so a new step can start sliding in right after the last one settled:
  // keep waiting until nothing finite is animating (a few rounds at most).
  for (let round = 0; round < 5; round++) {
    const busy = await page.evaluate(async () => {
      const running = document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity && a.playState === 'running');
      await Promise.all(running.map(a => a.finished.catch(() => {})));
      await new Promise(r => setTimeout(r, 60));
      return document.getAnimations().some(a => a.effect?.getTiming().iterations !== Infinity && a.playState === 'running');
    }).catch(() => false);
    if (!busy) break;
  }
  const res = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth; const bad = [];
    if (document.documentElement.scrollWidth > vw + 1) bad.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${vw})`);
    document.querySelectorAll('body *').forEach(el => {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (!r.width || cs.visibility === 'hidden' || cs.display === 'none') return;
      if (r.right > vw + 1 && !el.closest('.s-progress')) bad.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} right=${Math.round(r.right)}`);
      if ((el.matches('button, a.btn, .option, .tile') ) && el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'hidden') bad.push(`text overflow in ${el.tagName.toLowerCase()}.${[...el.classList].join('.')} “${el.textContent.trim().slice(0, 30)}”`);
    });
    // tap targets
    document.querySelectorAll('button, a.btn, .tabs a, input, select').forEach(el => {
      const r = el.getBoundingClientRect(); if (!r.width || getComputedStyle(el).display === 'none') return;
      if ((r.height < 36 || r.width < 36) && !el.closest('.word-row') && el.type !== 'checkbox' && el.type !== 'range' && el.type !== 'file') bad.push(`small tap target ${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${Math.round(r.width)}×${Math.round(r.height)}`);
    });
    return [...new Set(bad)].slice(0, 15);
  });
  res.forEach(r => problems.push(`[${where}] ${r}`));
}

async function closeSession(page) {
  if (await page.$('.session')) await page.click('.s-close');
  await page.waitForTimeout(150);
  if (await page.$('.session .done')) await page.click('.session .done');
  await page.waitForTimeout(100);
}
async function shot(page, dev, name) { await page.waitForTimeout(150); await page.screenshot({ path: `${OUT}/${dev.name}-${name}.png` }); }

async function playSession(page, dev, label, maxSteps = 80, shoot = true) {
  let shotsTaken = new Set();
  for (let i = 0; i < maxSteps; i++) {
    if (!(await page.$('.session'))) return i;
    await page.waitForTimeout(60);
    const snap = async (k) => { if (shoot && !shotsTaken.has(k)) { shotsTaken.add(k); await overflow(page, `${dev.name} ${label} ${k}`); await shot(page, dev, `${label}-${k}`); } };
    const btn = async sel => { try { const b = await page.$(sel); if (b && await b.isEnabled() && await b.isVisible()) { await b.click(); return true; } } catch { /* re-rendered */ } return false; };
    if (await page.$('.finish')) { await snap('finish'); await btn('.s-foot .done') || await btn('.s-foot .quit') || await page.click('.s-close'); continue; }
    if (await page.$('.s-foot.fb')) { await snap('feedback'); await btn('.s-foot .next'); continue; }
    const kicker = (await page.$eval('.s-body .kicker', e => e.textContent).catch(() => '')) || '';
    if (await page.$('.hero-card') && await page.$('.s-foot .btn.primary') && /New/.test(kicker)) { await snap('intro'); await btn('.s-foot .btn.primary'); continue; }
    if (/Grammar spotlight/.test(kicker)) { await snap('grammar-explain'); await btn('.s-foot .btn.primary'); continue; }
    if (await page.$('.flip-card')) { await snap('flash'); if (await page.$('.grades')) { await btn('.grades .g2'); } else await btn('.s-foot .btn.primary'); continue; }
    if (await page.$('.tiles')) {
      await snap('build');
      const target = await page.evaluate(() => null);
      const tiles = await page.$$('.tiles .tile:not([disabled])');
      for (const t of tiles) await t.click().catch(() => {});
      await btn('.s-foot .check'); continue;
    }
    if (await page.$('.dict-input')) { await snap('dictation'); await page.fill('.dict-input', 'xin chao'); await btn('.s-foot .check'); continue; }
    if (await page.$('.s-foot .good')) { await snap('speak'); await btn('.s-foot .good'); continue; }
    const opts = await page.$$('.options .option:not(.idk)');
    if (opts.length) { await snap(kicker.includes('fill') ? 'grammar-fill' : kicker.includes('correct') ? 'grammar-choose' : kicker.includes('tone') ? 'tone' : 'mcq'); await opts[Math.floor(Math.random() * opts.length)].click().catch(() => {}); await page.waitForTimeout(200); continue; }
    // The session may have closed between checks (it removes itself after Done); only report a real stall.
    if (!(await page.$('.session .s-close'))) continue;
    problems.push(`[${dev.name} ${label}] stuck on step ${i}: ${kicker}`);
    await page.click('.s-close'); await page.waitForTimeout(300);
    if (await page.$('.sheet-actions .danger')) await page.click('.sheet-actions .danger');
    return i;
  }
  return maxSteps;
}

const browser = await engine.launch(launchOpts);
for (const dev of DEVICES) {
  const ctx = await browser.newContext({ viewport: { width: dev.width, height: dev.height }, deviceScaleFactor: dev.dpr, hasTouch: true, isMobile: dev.name !== 'ipad' });
  await ctx.addInitScript(fakeSpeech);
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`[${dev.name}] JS error: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') problems.push(`[${dev.name}] console: ${m.text()}`); });
  page.on('dialog', d => { problems.push(`[${dev.name}] browser dialog shown: ${d.message().slice(0, 60)}`); d.accept(); });
  await page.goto(BASE + '#/home'); await page.waitForSelector('.hello');
  for (const r of ['home', 'learn', 'unit/u03', 'unit/u03/phrases', 'unit/u07/grammar', 'unit/u20/grammar', 'unit/u06/dialogue', 'unit/u04/reading', 'unit/u26', 'unit/u31/grammar', 'unit/u28/grammar', 'grammar', 'words', 'review', 'play', 'progress', 'leaderboard', 'leaderboard/month', 'leaderboard/games', 'leaderboard/records', 'placement', 'settings', 'settings/audio', 'settings/study', 'settings/sync', 'settings/data', 'mywords']) {
    await page.goto(BASE + '#/' + r); await page.waitForTimeout(200);
    await overflow(page, `${dev.name} ${r}`); await shot(page, dev, r.replace(/\//g, '_'));
  }
  if (dev.name !== 'iphone') { await ctx.close(); continue; }   // full flows once
  // Lesson flows
  await page.goto(BASE + '#/home'); await page.click('.start-lesson');
  const n1 = await playSession(page, dev, 'lesson1');
  for (const u of ['u03', 'u05', 'u07', 'u06']) { await page.goto(BASE + '#/unit/' + u); await page.click('.learn-new'); await playSession(page, dev, 'lesson-' + u, 80, u === 'u06'); }
  // Flag from unit page (bottom sheet)
  await page.goto(BASE + '#/unit/u03'); await page.click('.flag-it'); await page.waitForSelector('.sheet-wrap.open');
  await shot(page, dev, 'flag-sheet'); await overflow(page, 'iphone flag sheet');
  await page.click('.chip-btn:nth-child(2)'); await page.fill('.flag-note', 'test note'); await page.click('.sheet-actions .primary'); await page.waitForTimeout(300);
  // Grammar practice from unit page
  await page.goto(BASE + '#/unit/u10/grammar'); await page.click('.practice-g'); await playSession(page, dev, 'gpractice', 20);
  // Placement
  await page.goto(BASE + '#/placement'); await page.click('.start');
  await playSession(page, dev, 'placement');
  await page.waitForTimeout(300);
  await overflow(page, 'iphone diagnostics'); await shot(page, dev, 'diagnostics');
  if (await page.$('.apply')) await page.click('.apply');
  // Reviews: make everything due
  await page.evaluate(async () => { const C = await import('/js/course.js'); const S = await import('/js/store.js'); Object.values(C.cards()).forEach(c => c.due = 0); S.saveNow(); });
  await page.goto(BASE + '#/review'); await page.waitForSelector('[data-mode]');
  await page.click('[data-mode="flash"]'); await playSession(page, dev, 'flash', 25);
  await closeSession(page);
  await page.click('[data-mode="quiz"]'); await playSession(page, dev, 'quiz', 25);
  await closeSession(page);
  await page.click('[data-mode="grammar"]'); await playSession(page, dev, 'grammar-review', 14);
  await closeSession(page);
  await page.click('[data-mode="endless"]'); await playSession(page, dev, 'endless', 15);
  await closeSession(page);
  // Games
  await page.goto(BASE + '#/play');
  await page.click('[data-game="match"]'); await page.waitForSelector('.go'); await shot(page, dev, 'game-intro'); await page.click('.go'); await page.waitForSelector('.m-tile', { timeout: 5000 });
  await shot(page, dev, 'game-match'); await overflow(page, 'iphone match');
  const ids = await page.$$eval('.m-tile[data-side="l"]', els => els.map(e => e.dataset.id));
  for (const id of ids) { await page.click(`.m-tile[data-side="l"][data-id="${id}"]`); await page.click(`.m-tile[data-side="r"][data-id="${id}"]`); }
  await page.waitForSelector('.finish'); await shot(page, dev, 'game-match-done'); await page.click('.quit');
  for (const g of ['speed', 'tones', 'listen']) {
    await page.click(`[data-game="${g}"]`); await page.click('.go'); await page.waitForSelector('.option', { timeout: 5000 });
    for (let k = 0; k < 4; k++) { const o = await page.$$('.option'); if (!o.length) break; await o[0].click(); await page.waitForTimeout(g === 'listen' ? 100 : 1000); if (g === 'listen') { const nb = await page.$('.s-foot .btn'); nb && await nb.click(); } }
    await shot(page, dev, `game-${g}`); await overflow(page, `iphone game ${g}`);
    await page.click('.s-close');
  }
  // Play a full speed round to see the results screen
  await page.evaluate(() => { window.__fast = true; });
  await page.click('[data-game="listen"]'); await page.click('.go'); await page.waitForSelector('.option', { timeout: 5000 });
  for (let k = 0; k < 12; k++) { const o = await page.$$('.option'); if (!o.length) break; await o[0].click(); await page.waitForTimeout(80); const nb = await page.$('.s-foot .btn.primary'); if (nb) await nb.click(); await page.waitForTimeout(80); }
  await page.waitForSelector('.finish'); await shot(page, dev, 'game-results'); await overflow(page, 'iphone game results');
  await page.click('.again'); await page.waitForSelector('.option', { timeout: 5000 }); await page.click('.s-close');
  for (const r of ['leaderboard', 'leaderboard/games', 'leaderboard/records', 'words']) {
    await page.goto(BASE + '#/' + r); await page.waitForTimeout(200); await overflow(page, `iphone ${r} (with data)`); await shot(page, dev, `${r.replace('/', '_')}-data`);
  }
  await page.fill('.search', 'cuoi'); await page.waitForTimeout(150); await shot(page, dev, 'words-search');
  const shown = await page.$$eval('.bank .word-row:not(.hidden)', els => els.length);
  if (!shown) problems.push('word bank search for “cuoi” (no accents) found nothing');
  // Back button returns within app
  await page.goto(BASE + '#/progress'); await page.click('a[href="#/words"]'); await page.waitForSelector('.search'); await page.click('.back'); await page.waitForTimeout(250);
  if (!(await page.evaluate(() => location.hash)).startsWith('#/progress')) problems.push('Back from word bank did not return to Progress');
  {
  }
  await page.goto(BASE + '#/progress'); await page.waitForTimeout(200);
  await overflow(page, 'iphone progress-after'); await shot(page, dev, 'progress-after');
  await page.goto(BASE + '#/home'); await page.waitForTimeout(200); await shot(page, dev, 'home-after');
  const spoken = await page.evaluate(() => (window.__spoken || []).length);
  console.log(`iphone: lesson steps ${n1}, utterances ${spoken}`);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('motherland.v1')));
  console.log('cards:', Object.keys(state.langs.vi.cards).length, 'placements:', state.langs.vi.placements.length, 'flags:', state.flags.length, 'pending sessions:', state.pending.length);
  await ctx.close();
}
await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s):\n` + [...new Set(problems)].join('\n') : '\n✅ No problems found');
server?.close();
process.exitCode = typeof problems !== 'undefined' ? (problems.length ? 1 : 0) : (fail.length ? 1 : 0);
