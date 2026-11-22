// Repeatable performance + accessibility audit. Dev only — not part of the app.
//   node tools/audit.mjs [label]        → prints a table, writes test-results/audit-<label>.json
// BROWSER=webkit (default) or chromium; CHROME_PATH to use an installed Chrome.
//
// Why a throttling *server* instead of DevTools throttling: DevTools throttling is Chromium-only and
// does not apply to service-worker fetches. Delaying responses at the server works the same in every
// engine and slows down the service worker's own network requests too, so the numbers stay comparable.
import http from 'node:http';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

// AUDIT_ROOT serves a different copy of the site (used to compare variants such as modulepreload vs. a bundle).
const ROOT = process.env.AUDIT_ROOT ? path.resolve(process.env.AUDIT_ROOT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ONLY_LOADS = process.env.ONLY === 'loads';   // variant comparisons only need the load timings
const require = createRequire(import.meta.url);
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const label = process.argv[2] || 'run';
const engineName = (process.env.BROWSER || 'webkit') === 'chromium' ? 'chromium' : 'webkit';
const engine = engineName === 'chromium' ? chromium : webkit;
const launchOpts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] } : {};
const RUNS = +process.env.RUNS || 3;
const PORT = 8124;
const BASE = `http://localhost:${PORT}/`;

// Network profiles (round-trip latency per request, shared download bandwidth).
const PROFILES = {
  'slow-3g': { rtt: 400, kbps: 400 },
  'fast-3g': { rtt: 150, kbps: 1600 },
  none: { rtt: 0, kbps: 0 },
};
let net = PROFILES.none;
let deploy = 1;          // bump to simulate a new deploy (changes sw.js VERSION + index.html marker)
let offline = false;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.json': 'application/json' };

let wireBytes = 0;      // bytes actually sent (compressed), counted by the server
let busyUntil = 0;       // one shared pipe, so parallel downloads split the bandwidth
const sleep = ms => new Promise(r => setTimeout(r, ms));
const server = http.createServer(async (req, res) => {
  if (offline) { req.socket.destroy(); return; }
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  let body = fs.readFileSync(file);
  if (deploy > 1 && p === '/sw.js') body = Buffer.from(body.toString().replace(/const VERSION = '([^']+)'/, `const VERSION = '$1-deploy${deploy}'`));
  if (deploy > 1 && p === '/index.html') body = Buffer.from(body.toString().replace('<html lang="en"', `<html lang="en" data-build="${deploy}"`));
  // Cloudflare Pages compresses text files, so do the same or byte counts would be ~4× too high.
  const headers = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' };
  if (/\.(html|js|css|webmanifest|json)$/.test(p) && /gzip/.test(req.headers['accept-encoding'] || '')) { body = zlib.gzipSync(body); headers['Content-Encoding'] = 'gzip'; }
  if (net.rtt) await sleep(net.rtt);
  if (net.kbps) {
    const ms = (body.length * 8) / net.kbps;          // kbps → bits per ms
    const start = Math.max(Date.now(), busyUntil); busyUntil = start + ms;
    await sleep(busyUntil - Date.now());
  }
  wireBytes += body.length;
  res.writeHead(200, headers);
  res.end(body);
});
await new Promise(r => server.listen(PORT, r));

// Records when the first screen (.hello on Home) is painted, measured from navigation start.
const firstScreenProbe = () => {
  const mark = () => { if (!window.__firstScreen && document.querySelector('.hello')) requestAnimationFrame(() => { window.__firstScreen ??= performance.now(); }); };
  new MutationObserver(mark).observe(document, { childList: true, subtree: true });
};
const fakeSpeech = () => {
  const voices = [{ name: 'Linh', lang: 'vi-VN', voiceURI: 'com.apple.voice.Linh', default: false, localService: true }];
  Object.defineProperty(window, 'speechSynthesis', { value: { getVoices: () => voices, speak(u) { setTimeout(() => u.onend && u.onend(), 30); }, cancel() {}, addEventListener() {} }, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
};

const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const browser = await engine.launch(launchOpts);
const newCtx = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, hasTouch: true, ...opts });
  await ctx.addInitScript(firstScreenProbe); await ctx.addInitScript(fakeSpeech);
  return ctx;
};

async function load(page) {
  let requests = 0;
  const onReq = () => { requests++; };
  page.on('requestfinished', onReq);
  await page.goto('about:blank');   // force a real navigation (same-URL hash gotos don't reload)
  const w0 = wireBytes, t0 = Date.now();
  await page.goto(BASE + '#/home', { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__firstScreen, null, { timeout: 60000 });
  const first = await page.evaluate(() => Math.round(window.__firstScreen));
  await page.waitForLoadState('load').catch(() => {});
  page.off('requestfinished', onReq);
  return { first, wall: Date.now() - t0, requests, kb: Math.round((wireBytes - w0) / 1024) };
}

const out = { label, engine: engineName, date: new Date().toISOString(), loads: {}, interaction: {}, storage: {}, update: {}, a11y: {} };

// ── Loads ───────────────────────────────────────────────────────────────────
for (const prof of ['slow-3g', 'fast-3g']) {
  const cold = [], warm = [], off = [];
  let reqs = 0, kb = 0, lastWarmKB = 0;
  for (let r = 0; r < RUNS; r++) {
    net = PROFILES[prof]; offline = false; deploy = 1;
    const ctx = await newCtx(); const page = await ctx.newPage();
    const c = await load(page); cold.push(c.first); reqs = c.requests; kb = c.kb;
    await page.evaluate(() => navigator.serviceWorker?.ready);
    await page.waitForTimeout(500);
    const w = await load(page); warm.push(w.first); lastWarmKB = w.kb;
    offline = true;
    const o = await load(page).catch(() => ({ first: NaN })); off.push(o.first);
    offline = false;
    await ctx.close();
  }
  out.loads[prof] = { coldFirstScreenMs: median(cold), warmFirstScreenMs: median(warm), offlineFirstScreenMs: median(off), coldRequests: reqs, coldWireKB: kb, warmWireKB: lastWarmKB, runs: { cold, warm, off } };
}
net = PROFILES.none;
if (ONLY_LOADS) { await browser.close(); server.close(); console.log(JSON.stringify(out.loads)); process.exit(0); }

// ── Update after a new deploy ───────────────────────────────────────────────
{
  net = PROFILES['fast-3g']; deploy = 1;
  const ctx = await newCtx(); const page = await ctx.newPage();
  await load(page); await page.evaluate(() => navigator.serviceWorker?.ready); await page.waitForTimeout(500);
  deploy = 2;
  const seen = [];
  let toastAt = null;
  for (let launch = 1; launch <= 3; launch++) {
    await load(page); await page.waitForTimeout(2500);
    const build = await page.evaluate(() => document.documentElement.dataset.build || '1');
    seen.push(build);
    if (toastAt == null && await page.$('.update-toast.show')) {
      toastAt = launch;
      const t0 = Date.now(); await page.click('.update-toast button');
      await page.waitForFunction(() => document.documentElement.dataset.build === '2', null, { timeout: 15000 }).catch(() => {});
      out.update.toastTapToNewMs = Date.now() - t0;
      seen.push(await page.evaluate(() => document.documentElement.dataset.build || '1') + ' (after tap)');
      break;
    }
  }
  out.update.buildPerLaunch = seen;
  out.update.updateToastOnLaunch = toastAt;
  net = PROFILES.none; deploy = 1;
  await ctx.close();
}

// ── Interaction timing (no throttling; CPU-bound work) ───────────────────────
{
  const ctx = await newCtx(); const page = await ctx.newPage();
  await load(page);
  // Time from a tap to the next painted frame.
  const tapToPaint = sel => page.evaluate(async sel => {
    const el = document.querySelector(sel); if (!el) return null;
    const t0 = performance.now(); el.click();
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
    return Math.round((performance.now() - t0) * 10) / 10;
  }, sel);
  const tabs = [];
  for (let i = 0; i < 4; i++) for (const t of ['learn', 'review', 'play', 'progress', 'home']) { tabs.push(await tapToPaint(`.tabs a[data-tab="${t}"]`)); await page.waitForTimeout(60); }
  out.interaction.tabSwitchMs = median(tabs);
  const opens = [], steps = [];
  for (let i = 0; i < 5; i++) {
    await page.goto(BASE + '#/unit/u03'); await page.waitForSelector('.learn-new');
    opens.push(await tapToPaint('.learn-new'));
    for (let k = 0; k < 4; k++) { const v = await tapToPaint('.s-foot .btn.primary'); if (v != null) steps.push(v); await page.waitForTimeout(50); }
    await page.click('.s-close'); await page.waitForTimeout(100);
    if (await page.$('.sheet-wrap .danger')) { await page.click('.sheet-wrap .danger'); await page.waitForTimeout(100); }
    if (await page.$('.session .done')) await page.click('.session .done');
  }
  out.interaction.lessonOpenMs = median(opens);
  out.interaction.sessionStepMs = median(steps);
  // Scroll position after a refresh (a session closing re-renders the screen).
  await page.goto(BASE + '#/learn'); await page.waitForTimeout(200);
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.evaluate(() => window.dispatchEvent(new Event('motherland:refresh'))); await page.waitForTimeout(150);
  out.interaction.scrollKeptOnRefresh = await page.evaluate(() => Math.round(window.scrollY));
  // Tab round-trip: scroll Learn, go Home, come back.
  await page.click('.tabs a[data-tab="home"]'); await page.waitForTimeout(150);
  await page.click('.tabs a[data-tab="learn"]'); await page.waitForTimeout(300);
  out.interaction.learnScrollAfterTabRoundTrip = await page.evaluate(() => Math.round(window.scrollY));
  out.interaction.viewTransitions = await page.evaluate(() => 'startViewTransition' in document);

  // ── Storage: a big state (1,000 cards, 365 days) ──
  out.storage = await page.evaluate(async () => {
    const S = await import('/js/store.js');
    const st = S.get(); const l = S.lang();
    for (let i = 0; i < 1000; i++) l.cards[`x${i}`] = { reps: 3, ivl: 12.5, ease: 2.5, due: Date.now() + 1e8, lapses: 1, seen: 9, last: Date.now() };
    const d = new Date();
    for (let i = 0; i < 365; i++) { d.setDate(d.getDate() - 1); st.days[d.toISOString().slice(0, 10)] = { xp: 120, ms: 600000, c: 40, t: 50, words: 6, skills: { vocab: { c: 10, t: 12 }, tones: { c: 5, t: 8 }, listening: { c: 4, t: 6 }, grammar: { c: 3, t: 4 } } }; }
    const times = [];
    for (let i = 0; i < 25; i++) { const t0 = performance.now(); S.saveNow(); times.push(performance.now() - t0); }
    times.sort((a, b) => a - b);
    return { stateKB: Math.round(localStorage.getItem('motherland.v1').length / 1024), saveMedianMs: Math.round(times[12] * 100) / 100, saveMaxMs: Math.round(times[24] * 100) / 100 };
  });
  await ctx.close();
}

// ── Layout checks: standalone height, text size, reduced motion ─────────────
{
  const ctx = await newCtx({ isMobile: engineName !== 'webkit' ? true : undefined });
  const page = await ctx.newPage();
  await load(page);
  await page.goto(BASE + '#/unit/u03'); await page.waitForSelector('.learn-new'); await page.click('.learn-new');
  out.layout = await page.evaluate(() => {
    const s = document.querySelector('.session'); const cs = getComputedStyle(s);
    return { sessionHeight: cs.height, usesDvh: [...document.styleSheets].some(ss => { try { return [...ss.cssRules].some(r => /dvh/.test(r.cssText)); } catch { return false; } }) };
  });
  await ctx.close();
  const textSize = {};
  for (const scale of [130, 200]) {
    const c2 = await newCtx(); const p2 = await c2.newPage();
    await p2.addInitScript(sc => document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = sc + '%'; }), scale);
    await load(p2);
    const issues = [];
    for (const r of ['home', 'learn', 'unit/u03', 'review', 'play', 'progress', 'settings']) {
      await p2.goto(BASE + '#/' + r); await p2.waitForTimeout(150);
      const bad = await p2.evaluate(() => {
        const vw = document.documentElement.clientWidth; const b = [];
        if (document.documentElement.scrollWidth > vw + 1) b.push('page scrolls sideways');
        document.querySelectorAll('button, a.btn, .option, .tabs a, .q-tile').forEach(el => { if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'hidden') b.push('clipped text: ' + el.textContent.trim().slice(0, 24)); });
        return [...new Set(b)];
      });
      bad.forEach(x => issues.push(`${r}: ${x}`));
    }
    textSize[scale + '%'] = issues;
    await c2.close();
  }
  out.layout.textSize = textSize;
  // Does the root text size follow the OS setting? (iOS Dynamic Type needs `font: -apple-system-body`.)
  out.layout.followsDynamicType = /-apple-system-body/.test(fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf8'));
  const c3 = await newCtx({ reducedMotion: 'reduce' }); const p3 = await c3.newPage();
  await load(p3); await p3.goto(BASE + '#/unit/u03'); await p3.waitForSelector('.learn-new'); await p3.click('.learn-new');
  out.layout.reducedMotionSessionAnimation = await p3.evaluate(() => getComputedStyle(document.querySelector('.session')).animationName);
  await c3.close();
}

// ── Accessibility (axe-core) ────────────────────────────────────────────────
{
  const ctx = await newCtx(); const page = await ctx.newPage();
  await load(page);
  const all = {};
  const scan = async name => {
    await page.addScriptTag({ content: AXE });
    const res = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') })));
    res.forEach(v => { const k = v.id; all[k] ||= { impact: v.impact, nodes: 0, screens: [], sample: v.sample }; all[k].nodes += v.n; all[k].screens.push(name); });
  };
  for (const r of ['home', 'learn', 'unit/u03', 'unit/u07/grammar', 'words', 'review', 'play', 'progress', 'leaderboard', 'placement', 'settings']) {
    await page.goto(BASE + '#/' + r); await page.waitForTimeout(200); await scan(r);
  }
  await page.goto(BASE + '#/unit/u03'); await page.click('.learn-new'); await page.waitForTimeout(200); await scan('session:intro');
  await page.click('.s-foot .btn.primary'); await page.waitForTimeout(200); await scan('session:step');
  // Screens added since v1.2, with enough state to show their parts: due cards (week chart, flashcards,
  // Home's next-up), a deck, a My word, a failed sync (Home status line + Retry), placement skips.
  await load(page);
  const deckId = await page.evaluate(async () => {
    const S = await import('/js/store.js'), C = await import('/js/course.js'), D = await import('/js/decks.js');
    C.unitItems('u03').slice(0, 8).forEach((i, n) => { C.cards()[i.id] = { reps: 1, ivl: 1, ease: 2.5, due: n < 5 ? 0 : Date.now() + n * 864e5, lapses: 0, seen: 1, last: 1 }; });
    C.myWordsMap()['my-a11y'] = { id: 'my-a11y', vi: 'bánh mì', en: 'bread', verified: false, at: 1, edited: 1 };
    Object.assign(S.settings(), { syncUrl: 'https://sheet.invalid/exec', syncError: 'Wrong password', lastSync: 1 });
    const d = D.create('Test deck'); D.add(d.id, C.unitItems('u03').slice(0, 4).map(i => i.id)); S.saveNow(); return d.id;
  });
  for (const r of ['home', 'review', 'mywords', 'grammar', 'diagnostics', 'settings/study', 'settings/sync', 'settings/data', `deck/${deckId}`, `deck/${deckId}/add`]) {
    await page.goto(BASE + '#/' + r); await page.waitForTimeout(250); await scan(r.replace(deckId, 'id'));
  }
  await page.goto(BASE + '#/review'); await page.waitForTimeout(200);
  await page.evaluate(async () => (await import('/js/ui.js')).undoToast('Buried until tomorrow', () => {})); await page.waitForTimeout(350); await scan('undo toast');
  await page.click('[data-mode="flash"]'); await page.waitForSelector('.flip-card'); await page.waitForTimeout(500); await scan('flashcard front');   // after the entrance fade
  await page.click('.flip-card'); await page.waitForTimeout(500); await scan('flashcard back');
  out.a11y.violations = all;
  out.a11y.total = Object.values(all).reduce((n, v) => n + v.nodes, 0);
  // Focus order: tab through Home and list what receives focus.
  await load(page);   // fresh document: the session opened above is still on screen otherwise
  await page.evaluate(() => document.activeElement?.blur());
  const order = [];
  for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => { const e = document.activeElement; return e ? (e.getAttribute('aria-label') || e.textContent.trim().replace(/\s+/g, ' ').slice(0, 28) || e.tagName) : null; })); }
  out.a11y.homeFocusOrder = order;
  // Does a bottom sheet trap focus and close with Escape?
  await page.goto(BASE + '#/unit/u03'); await page.click('.flag-it'); await page.waitForSelector('.sheet-wrap.open');
  out.a11y.sheetFocusInside = await page.evaluate(() => !!document.activeElement?.closest('.sheet'));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  out.a11y.sheetClosesOnEscape = !(await page.$('.sheet-wrap'));
  await ctx.close();
}

await browser.close(); server.close();
const OUTDIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../test-results');
fs.mkdirSync(OUTDIR, { recursive: true });
fs.writeFileSync(path.join(OUTDIR, `audit-${label}.json`), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
