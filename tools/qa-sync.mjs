// Tests Google Sheet sync against a simulated Apps Script, plus offline mode.
import { chromium, webkit } from 'playwright';
import { ensureServer, startServer } from './serve.mjs';
import { watchdog } from './watchdog.mjs';

// BROWSER=webkit (default, closest to iPhone Safari) or chromium. CHROME_PATH lets you use an installed Chrome.
const engine = (process.env.BROWSER || 'webkit') === 'chromium' ? chromium : webkit;
const launchOpts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] } : {};
const server = await ensureServer(8123);
const BASE = 'http://localhost:8123/';
const URL_ = 'https://script.google.com/macros/s/TEST/exec';
const sheet = { state: null, updatedAt: 0, sessions: [], flags: [], calls: [] };
const fail = []; const ok = m => console.log('✓', m);

watchdog('qa:sync', 6);
// Ask the service worker to look for a new version without waiting on it in the page: WebKit can
// leave update() unsettled while a sheet is open, and the checks that follow wait with timeouts anyway.
const updateLog = [];
const checkForUpdate = p => p.evaluate(() => {
  window.__upd = 'pending';
  navigator.serviceWorker.getRegistration()
    .then(r => r ? r.update().then(() => { window.__upd = `ok (installing: ${r.installing?.state}, waiting: ${r.waiting?.state})`; }) : (window.__upd = 'no registration'))
    .catch(e => { window.__upd = `error: ${e.message}`; });
});
// Keep asking until the "Update ready" toast shows. The app runs its own update check at every launch;
// a check asked for while that one is still running joins it (per the Service Worker spec) and can
// miss a deploy made a moment later. WebKit is slow enough to hit this; the phone would catch the
// deploy at its next foreground check, which this loop stands in for.
async function untilUpdateToast(p, tries = 10) {
  for (let i = 0; i < tries; i++) {
    await checkForUpdate(p);
    if (await p.waitForSelector('.update-toast.show', { timeout: 1500 }).then(() => true, () => false)) return true;
    updateLog.push(await p.evaluate(() => window.__upd).catch(e => `page: ${e.message.split('\n')[0]}`));
  }
  return false;
}
const browser = await engine.launch(launchOpts);
// Service worker blocked for the sync checks: in WebKit, requests from a SW-controlled page skip
// Playwright's routing, so they'd hit the real Google URL instead of the simulated Sheet. The offline
// and update checks below use their own contexts with the service worker on.
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, serviceWorkers: 'block' });
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
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(`  [browser ${m.type()}] ${m.text()}`); });
page.on('requestfailed', r => console.log(`  [request failed] ${r.method()} ${r.url().slice(0, 60)} ${r.failure()?.errorText}`));

await page.goto(BASE + '#/settings/sync'); await page.waitForSelector('.opt-url', { state: 'visible' });
// wrong password
await page.fill('.opt-url', URL_); await page.fill('.opt-key', 'nope');
await page.click('.sync-now'); await page.waitForTimeout(600);
const status1 = await page.textContent('.sync-status');
status1.includes('Wrong sync password') ? ok('wrong password is reported') : fail.push('wrong password not shown: ' + status1);
// If the browser thinks it's offline, sync is skipped by design; say so instead of failing mysteriously later.
console.log(`  (browser online: ${await page.evaluate(() => navigator.onLine)}, requests to the Sheet so far: ${sheet.calls.length})`);

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
if (!sheet.state) { console.log('\n❌ ' + fail.concat('nothing reached the simulated Sheet; stopping').join('\n❌ ')); process.exit(1); }
const remote = JSON.parse(sheet.state); remote.langs.vi.cards['u05-w0'] = { reps: 2, ivl: 3, ease: 2.5, due: Date.now() + 1e8, lapses: 0, seen: 1, last: 1 };
sheet.state = JSON.stringify(remote); sheet.updatedAt = Date.now() + 100000;
await page.click('.sync-now'); await page.waitForTimeout(800);
const adopted = await page.evaluate(async () => { const C = await import('/js/course.js'); return !!C.cards()['u05-w0']; });
adopted ? ok('newer Sheet data is pulled into the app') : fail.push('remote newer state not adopted');
// an OLDER Sheet copy (another device that synced earlier) must still contribute its cards
{
  const older = JSON.parse(sheet.state); older.langs.vi.cards['u06-w1'] = { reps: 1, ivl: 1, ease: 2.5, due: Date.now() + 1e8, lapses: 0, seen: 1, last: 5 };
  sheet.state = JSON.stringify(older); sheet.updatedAt = 1;
  await page.click('.sync-now'); await page.waitForTimeout(800);
  const both = await page.evaluate(async () => { const C = await import('/js/course.js'); const c = C.cards(); return !!c['u06-w1'] && !!c['u05-w0'] && !!c['u03-w0']; });
  both ? ok('older Sheet copy is merged in, nothing on the phone is lost') : fail.push('merge with older Sheet copy lost cards');
  const pushed = JSON.parse(sheet.state).langs.vi.cards;
  pushed['u06-w1'] && pushed['u03-w0'] ? ok('merged progress is pushed back to the Sheet') : fail.push('merged state not pushed');
}
// Reset placement → reopen the app (which syncs with the Sheet) → the reset must still hold.
{
  await page.evaluate(async () => {
    const S = await import('/js/store.js'); const C = await import('/js/course.js');
    const t = Date.now() - 5 * 864e5, cards = C.cards();
    ['u07', 'u08'].forEach(u => C.unitItems(u).forEach(i => { cards[i.id] = { reps: 1, ivl: 3, ease: 2.5, due: t + 6 * 864e5, lapses: 0, seen: t, last: t }; }));
    S.lang().placements.push({ at: t, level: 3, label: 'Intermediate', score: 72, c: 21, t: 29, levels: { 1: { c: 8, t: 10 } }, skills: {}, sections: {}, weak: [] });
    S.save();
  });
  await page.click('.sync-now'); await page.waitForTimeout(800);   // the Sheet now has the credit too
  const inSheet = JSON.parse(sheet.state).langs.vi.placements.length;
  await page.goto(BASE + '#/diagnostics'); await page.waitForSelector('.reset-placement');
  await page.click('.reset-placement'); await page.click('.sheet-actions .danger'); await page.waitForTimeout(500);
  await page.goto(BASE + '#/home'); await page.reload(); await page.waitForSelector('.hello'); await page.waitForTimeout(1500);   // reopen → sync runs
  const after = await page.evaluate(async () => { const S = await import('/js/store.js'); const C = await import('/js/course.js'); return { placements: S.lang().placements.length, credit: C.unitItems('u07').filter(i => C.cards()[i.id]).length }; });
  inSheet >= 1 && after.placements === 0 && after.credit === 0 ? ok('placement reset survives reopening the app and syncing with the Sheet') : fail.push(`placement reset undone by sync: ${JSON.stringify(after)}`);
  const sheetNow = JSON.parse(sheet.state).langs.vi;
  sheetNow.placements.length === 0 ? ok('the Sheet copy is cleaned up too') : fail.push('Sheet still has the old placement');
  await page.goto(BASE + '#/settings/sync'); await page.waitForSelector('.opt-url', { state: 'visible' });
}
const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('motherland.v1')).settings.syncKey);
kept === 'pw' ? ok('sync settings survive a pull') : fail.push('sync key lost after pull');

// Export backup → import into fresh profile
// Settings rows are collapsed; one open at a time. Opening "Your data" closes "Google Sheet sync".
await page.click('.set-sec[data-sec="data"] summary'); await page.waitForTimeout(150);
(await page.$$eval('.set-sec[open]', d => d.map(x => x.dataset.sec))).join() === 'data' ? ok('settings: only one section open at a time') : fail.push('settings: more than one section open');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.export')]);
const path = await dl.path();
ok('backup exported: ' + dl.suggestedFilename());
{
  const { readFileSync } = await import('node:fs');
  const file = JSON.parse(readFileSync(path, 'utf8'));
  file.settings.syncKey === '' && file.langs?.vi?.cards ? ok('backup file has progress but not the sync password') : fail.push('backup file leaks the sync password or lacks progress');
}
const ctx2 = await browser.newContext({ viewport: { width: 393, height: 852 } });
const p2 = await ctx2.newPage(); p2.on('dialog', d => d.accept()); p2.on('pageerror', e => fail.push('JS error (import): ' + e.message));
await p2.goto(BASE + '#/settings'); await p2.waitForSelector('.import input', { state: 'attached' });
await p2.setInputFiles('.import input', path); await p2.waitForSelector('.sheet-wrap.open'); await p2.click('.sheet-actions .primary'); await p2.waitForTimeout(500);
const restored = await p2.evaluate(async () => { const C = await import('/js/course.js'); return Object.keys(C.cards()).length; });
restored >= 2 ? ok(`backup restored (${restored} cards)`) : fail.push('import failed');

// Backup reminder: shown without Sheet sync once there is progress; "Later" snoozes it.
await p2.evaluate(async () => { const S = await import('/js/store.js'); const C = await import('/js/course.js');
  const c = C.cards(); for (let i = 0; i < 12; i++) c['u02-w' + i] = { reps: 1, ivl: 1, ease: 2.5, due: Date.now() + 1e8, lapses: 0, seen: 1, last: 1 };
  S.settings().syncUrl = ''; S.settings().lastBackup = 0; S.settings().backupSnooze = 0; S.saveNow(); });
await p2.goto(BASE + '#/learn'); await p2.goto(BASE + '#/home'); await p2.waitForSelector('.hello');
(await p2.$('.backup-nudge')) ? ok('backup reminder shows when only this phone has the progress') : fail.push('no backup reminder');
await p2.click('.later-backup'); await p2.waitForTimeout(200);
!(await p2.$('.backup-nudge')) ? ok('"Later" hides the backup reminder') : fail.push('backup reminder not snoozed');

// A lesson open when the route changes underneath closes itself and keeps its answers.
await p2.click('.start-lesson'); await p2.waitForSelector('.session');
await p2.click('.s-foot .btn.primary');   // first intro card counts as learned
await p2.evaluate(() => { location.hash = '#/learn'; }); await p2.waitForTimeout(500);
const stranded = await p2.$('.session');
const kept1 = await p2.evaluate(async () => Object.keys((await import('/js/course.js')).cards()).length);
!stranded && kept1 >= 15 ? ok('lesson closes on navigation, progress kept') : fail.push(`lesson stranded=${!!stranded} cards=${kept1}`);

// Offline: service worker serves the app with no network
await p2.goto(BASE + '#/home'); await p2.waitForTimeout(1500);
await p2.reload(); await p2.waitForTimeout(800);
const ctl = await p2.evaluate(() => !!navigator.serviceWorker.controller);
ctl ? ok('service worker active') : fail.push('service worker not controlling page');
await ctx2.setOffline(true);
await p2.reload(); await p2.waitForSelector('.hello', { timeout: 5000 }).then(() => ok('app opens offline')).catch(() => fail.push('app does not load offline'));
await ctx2.close();

// New deploy: the cache-first worker must never leave the phone on an old version.
{
  let deploy = 1;
  const PORT2 = 8125, B2 = `http://localhost:${PORT2}/`;
  const srv2 = await startServer(PORT2, { transform: (url, buf) => {
    if (deploy === 1) return buf;
    if (url === '/sw.js') return Buffer.from(buf.toString().replace(/const VERSION = '([^']+)'/, `const VERSION = '$1-test${deploy}'`));
    if (url === '/' || url === '/index.html') return Buffer.from(buf.toString().replace('<html lang="en"', `<html lang="en" data-build="${deploy}"`));
    return buf;
  } });
  const ctx3 = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const p3 = await ctx3.newPage(); p3.on('pageerror', e => fail.push('JS error (update): ' + e.message));
  const build = () => p3.evaluate(() => document.documentElement.dataset.build || '1');
  const hide = () => p3.evaluate(() => { Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await p3.goto(B2 + '#/home'); await p3.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 8000 });
  await p3.reload(); await p3.waitForSelector('.hello');
  (await p3.$('.update-toast')) ? fail.push('update toast shown with no deploy') : ok('no update toast without a deploy');

  deploy = 2; await p3.reload(); await p3.waitForSelector('.hello');
  (await build()) === '1' ? ok('launch after a deploy is served instantly from cache') : fail.push('cache-first not used');
  // Nothing open → the new version takes over by itself within seconds, no tap needed.
  await p3.waitForFunction(() => document.documentElement.dataset.build === '2', null, { timeout: 15000 })
    .then(() => ok('update applies by itself at launch when nothing is open')).catch(() => fail.push('update did not apply by itself at launch'));
  await p3.waitForSelector('.hello');
  const keys = await p3.evaluate(() => caches.keys());
  keys.length === 1 && keys[0].endsWith('-test2') ? ok('old version cache deleted') : fail.push('caches after update: ' + keys.join(', '));

  // Mid-lesson: the update waits (toast), even if the app is backgrounded, then applies when the lesson closes.
  await p3.click('.start-lesson'); await p3.waitForSelector('.session');
  deploy = 3;
  (await untilUpdateToast(p3)) ? ok('"Update ready" toast appears during a lesson') : fail.push('no update toast during a lesson');
  await hide(); await p3.waitForTimeout(1500);
  (await p3.$('.session')) && (await build()) === '2' ? ok('update waits while a lesson is open') : fail.push('update interrupted an open lesson');
  await p3.evaluate(() => { Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true }); });
  await p3.click('.s-close'); await p3.waitForTimeout(300);
  try {   // the page may already be reloading into the new version here
    if (await p3.$('.sheet-wrap .danger')) { await p3.click('.sheet-wrap .danger'); await p3.waitForTimeout(300); }
    if (await p3.$('.session .done')) await p3.click('.session .done');
  } catch { /* navigated: that's the update applying */ }
  await p3.waitForFunction(() => document.documentElement.dataset.build === '3', null, { timeout: 15000 })
    .then(() => ok('update applies as soon as the lesson closes')).catch(() => fail.push('waiting update not applied after the lesson'));
  // Tapping the toast also works (update arrives while a sheet is open).
  await p3.waitForSelector('.hello'); await p3.goto(B2 + '#/unit/u03'); await p3.waitForSelector('.flag-it'); await p3.click('.flag-it'); await p3.waitForSelector('.sheet-wrap.open');
  deploy = 4; const toasted = await untilUpdateToast(p3);
  const clicked = await p3.click('.update-toast button', { timeout: 5000 }).then(() => 'clicked', e => e.message.split('\n')[0]);
  await p3.waitForFunction(() => document.documentElement.dataset.build === '4', null, { timeout: 15000 })
    .then(() => ok('tapping "Update ready" loads the new version')).catch(async () => {
      // Say what happened, so a failure in CI (WebKit) can be understood without a rerun.
      const sw = await p3.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { waiting: r?.waiting?.state, installing: r?.installing?.state, active: r?.active?.state, build: document.documentElement.dataset.build }; }).catch(e => e.message);
      fail.push(`tapping the toast did not update (toast: ${toasted}, click: ${clicked}, sw: ${JSON.stringify(sw)}, update checks: ${[...new Set(updateLog)].join(' | ')})`);
      // The guarantee that matters: even when an in-session check stalls, reopening the app gets the new version.
      for (let i = 0; i < 3 && (await build().catch(() => '?')) !== '4'; i++) { await p3.reload().catch(() => {}); await p3.waitForTimeout(3000); }
      const after = await build().catch(e => e.message);
      after === '4' ? ok('…but reopening the app still brings in the new version') : fail.push(`reopening the app did not bring the new version either (build ${after})`);
    });
  await ctx3.close(); srv2.close();
}

await browser.close();
console.log(fail.length ? '\n❌ ' + fail.join('\n❌ ') : '\n✅ Sync, backup and offline checks passed');
server?.close();
process.exitCode = typeof problems !== 'undefined' ? (problems.length ? 1 : 0) : (fail.length ? 1 : 0);
