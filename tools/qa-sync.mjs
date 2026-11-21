// Tests Google Sheet sync against a simulated Apps Script, plus offline mode.
import { chromium, webkit } from 'playwright';
import { ensureServer } from './serve.mjs';

// BROWSER=webkit (default, closest to iPhone Safari) or chromium. CHROME_PATH lets you use an installed Chrome.
const engine = (process.env.BROWSER || 'webkit') === 'chromium' ? chromium : webkit;
const launchOpts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] } : {};
const server = await ensureServer(8123);
const BASE = 'http://localhost:8123/';
const URL_ = 'https://script.google.com/macros/s/TEST/exec';
const sheet = { state: null, updatedAt: 0, sessions: [], flags: [], calls: [] };
const fail = []; const ok = m => console.log('✓', m);

const browser = await engine.launch(launchOpts);
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
await ctx.route(URL_, async route => {
  const body = JSON.parse(route.request().postData());
  sheet.calls.push(body.action);
  const headers = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
  if (body.key !== 'pw') return route.fulfill({ headers, body: JSON.stringify({ ok: false, error: 'Wrong sync password' }) });
  if (body.action === 'pull') return route.fulfill({ headers, body: JSON.stringify({ ok: true, state: sheet.state, updatedAt: sheet.updatedAt }) });
  sheet.state = body.state; sheet.updatedAt = body.updatedAt; sheet.sessions.push(...body.sessions); sheet.flags.push(...body.flags);
  return route.fulfill({ headers, body: JSON.stringify({ ok: true, updatedAt: body.updatedAt }) });
});
const page = await ctx.newPage();
page.on('pageerror', e => fail.push('JS error: ' + e.message));
page.on('dialog', d => d.accept());

await page.goto(BASE + '#/settings'); await page.waitForSelector('.opt-url');
// wrong password
await page.fill('.opt-url', URL_); await page.fill('.opt-key', 'nope');
await page.click('.sync-now'); await page.waitForTimeout(600);
const status1 = await page.textContent('.sync-status');
status1.includes('Wrong sync password') ? ok('wrong password is reported') : fail.push('wrong password not shown: ' + status1);

// make some progress, then sync
await page.evaluate(async () => {
  const S = await import('/js/store.js'); const C = await import('/js/course.js');
  const cards = C.cards(); cards['u03-w0'] = { reps: 1, ivl: 1, ease: 2.5, due: Date.now() + 1e8, lapses: 0, seen: 1, last: 1 };
  S.recordAnswer('vocab', true); S.logSession('test', { ms: 60000, xp: 10, c: 1, t: 1 });
  S.flag(C.item('u03-w0'), 'check this'); S.save();
});
await page.fill('.opt-key', 'pw'); await page.click('.sync-now'); await page.waitForTimeout(800);
const st = sheet.state && JSON.parse(sheet.state);
st?.langs?.vi?.cards?.['u03-w0'] ? ok('progress pushed to Sheet') : fail.push('state not pushed');
st && !st.settings.syncKey ? ok('password is not stored in the Sheet') : fail.push('sync key leaked into Sheet');
sheet.sessions.length === 1 ? ok('session row sent once') : fail.push(`sessions sent: ${sheet.sessions.length}`);
sheet.flags.length === 1 ? ok('flag row sent') : fail.push('flag not sent');
const pend = await page.evaluate(() => JSON.parse(localStorage.getItem('motherland.v1')).pending.length);
pend === 0 ? ok('pending queue cleared after sync') : fail.push('pending not cleared: ' + pend);

// sync again: no duplicate rows
await page.click('.sync-now'); await page.waitForTimeout(800);
sheet.sessions.length === 1 && sheet.flags.length === 1 ? ok('no duplicate rows on re-sync') : fail.push('duplicates on re-sync');

// simulate another device writing newer progress → this phone should adopt it
const remote = JSON.parse(sheet.state); remote.langs.vi.cards['u05-w0'] = { reps: 2, ivl: 3, ease: 2.5, due: Date.now() + 1e8, lapses: 0, seen: 1, last: 1 };
sheet.state = JSON.stringify(remote); sheet.updatedAt = Date.now() + 100000;
await page.click('.sync-now'); await page.waitForTimeout(800);
const adopted = await page.evaluate(async () => { const C = await import('/js/course.js'); return !!C.cards()['u05-w0']; });
adopted ? ok('newer Sheet data is pulled into the app') : fail.push('remote newer state not adopted');
const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('motherland.v1')).settings.syncKey);
kept === 'pw' ? ok('sync settings survive a pull') : fail.push('sync key lost after pull');

// Export backup → import into fresh profile
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.export')]);
const path = await dl.path();
ok('backup exported: ' + dl.suggestedFilename());
const ctx2 = await browser.newContext({ viewport: { width: 393, height: 852 } });
const p2 = await ctx2.newPage(); p2.on('dialog', d => d.accept()); p2.on('pageerror', e => fail.push('JS error (import): ' + e.message));
await p2.goto(BASE + '#/settings'); await p2.waitForSelector('.import input', { state: 'attached' });
await p2.setInputFiles('.import input', path); await p2.waitForSelector('.sheet-wrap.open'); await p2.click('.sheet-actions .primary'); await p2.waitForTimeout(500);
const restored = await p2.evaluate(async () => { const C = await import('/js/course.js'); return Object.keys(C.cards()).length; });
restored >= 2 ? ok(`backup restored (${restored} cards)`) : fail.push('import failed');

// Offline: service worker serves the app with no network
await p2.goto(BASE + '#/home'); await p2.waitForTimeout(1500);
await p2.reload(); await p2.waitForTimeout(800);
const ctl = await p2.evaluate(() => !!navigator.serviceWorker.controller);
ctl ? ok('service worker active') : fail.push('service worker not controlling page');
await ctx2.setOffline(true);
await p2.reload(); await p2.waitForSelector('.hello', { timeout: 5000 }).then(() => ok('app opens offline')).catch(() => fail.push('app does not load offline'));
await browser.close();
console.log(fail.length ? '\n❌ ' + fail.join('\n❌ ') : '\n✅ Sync, backup and offline checks passed');
server?.close();
process.exitCode = typeof problems !== 'undefined' ? (problems.length ? 1 : 0) : (fail.length ? 1 : 0);
