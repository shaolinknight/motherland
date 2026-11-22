// Visual regression helper for refactors (CSS tidy-ups, screen splits): capture a fixed set of screens
// and states, then compare two captures pixel by pixel.
//   node tools/shots.mjs capture <dir>          → <dir>/*.png
//   node tools/shots.mjs compare <dirA> <dirB>  → lists screens that differ (exit 1 if any)
// Uses ?demo sample data and a fixed clock so the same state renders the same way every time.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
import { ensureServer } from './serve.mjs';

const engine = (process.env.BROWSER || 'webkit') === 'chromium' ? chromium : webkit;
const launchOpts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] } : {};
const [cmd, a, b] = process.argv.slice(2);
const FIXED_NOW = Date.parse('2026-11-20T18:00:00');

const ROUTES = ['home', 'learn', 'unit/u03', 'unit/u03/grammar', 'unit/u06/dialogue', 'grammar', 'words', 'mywords', 'review',
  'play', 'progress', 'leaderboard', 'diagnostics', 'settings', 'settings/study', 'settings/sync'];

async function capture(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const server = await ensureServer(8123);
  const browser = await engine.launch(launchOpts);
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, colorScheme: scheme, reducedMotion: 'reduce' });
    // Same clock and same "random" numbers every run, so sample data and layouts are identical.
    await ctx.addInitScript(now => {
      const RealDate = Date; let seed = 42;
      Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      // eslint-disable-next-line no-global-assign
      Date = class extends RealDate { constructor(...x) { super(...(x.length ? x : [now])); } static now() { return now; } };
    }, FIXED_NOW);
    const p = await ctx.newPage();
    await p.goto('http://localhost:8123/?demo#/home'); await p.waitForSelector('.hello');
    for (const r of ROUTES) {
      await p.evaluate(h => { location.hash = '#/' + h; }, r); await p.waitForTimeout(350);
      await p.evaluate(() => document.activeElement?.blur());
      await p.screenshot({ path: path.join(dir, `${scheme}-${r.replace(/\//g, '_')}.png`), fullPage: true });
    }
    // A lesson step, a flashcard (front/back) and a sheet.
    await p.evaluate(() => { location.hash = '#/unit/u03'; }); await p.waitForTimeout(300);
    await p.click('.learn-new'); await p.waitForTimeout(400); await p.screenshot({ path: path.join(dir, `${scheme}-session-intro.png`) });
    await p.click('.s-close'); await p.waitForTimeout(300);
    await p.evaluate(() => { location.hash = '#/home'; }); await p.waitForTimeout(300);
    if (await p.$('.do-flash')) {
      await p.click('.do-flash'); await p.waitForTimeout(400); await p.screenshot({ path: path.join(dir, `${scheme}-flash-front.png`) });
      await p.click('.s-foot .btn.primary'); await p.waitForTimeout(400); await p.screenshot({ path: path.join(dir, `${scheme}-flash-back.png`) });
      await p.click('.s-close'); await p.waitForTimeout(300); if (await p.$('.session .done')) await p.click('.session .done'); await p.waitForTimeout(300);
    }
    await p.evaluate(() => { location.hash = '#/unit/u03'; }); await p.waitForTimeout(300);
    await p.click('.word-row .flag-it'); await p.waitForTimeout(400); await p.screenshot({ path: path.join(dir, `${scheme}-sheet.png`) });
    await ctx.close();
  }
  // iPad width (two-column layouts, centered tab bar).
  const ipad = await browser.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await ipad.addInitScript(now => { const RealDate = Date; let seed = 42; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647; Date = class extends RealDate { constructor(...x) { super(...(x.length ? x : [now])); } static now() { return now; } }; }, FIXED_NOW);
  const ip = await ipad.newPage();
  await ip.goto('http://localhost:8123/?demo#/home'); await ip.waitForSelector('.hello');
  for (const r of ['home', 'learn', 'unit/u03', 'review', 'progress', 'grammar', 'settings/study', 'deck-first']) {
    if (r === 'deck-first') { const id = await ip.evaluate(async () => (await import('/js/decks.js')).list()[0]?.id); await ip.evaluate(h => { location.hash = h; }, `#/deck/${id}`); }
    else await ip.evaluate(h => { location.hash = '#/' + h; }, r);
    await ip.waitForTimeout(350); await ip.evaluate(() => document.activeElement?.blur());
    await ip.screenshot({ path: path.join(dir, `ipad-${r.replace(/\//g, '_')}.png`), fullPage: true });
  }
  await ipad.close();
  await browser.close(); server?.close();
  console.log(`captured ${fs.readdirSync(dir).length} screenshots in ${dir}`);
}

async function compare(dirA, dirB) {
  const names = fs.readdirSync(dirA).filter(f => f.endsWith('.png'));
  const browser = await engine.launch(launchOpts);
  const p = await browser.newPage();
  const diffs = [];
  for (const n of names) {
    const fa = path.join(dirA, n), fb = path.join(dirB, n);
    if (!fs.existsSync(fb)) { diffs.push(`${n}: missing in ${dirB}`); continue; }
    const [da, db] = [fs.readFileSync(fa).toString('base64'), fs.readFileSync(fb).toString('base64')];
    if (da === db) continue;
    // Decode both in the browser and count differing pixels.
    const r = await p.evaluate(async ([x, y]) => {
      const load = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + src; });
      const [ia, ib] = await Promise.all([load(x), load(y)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { size: `${ia.width}×${ia.height} vs ${ib.width}×${ib.height}` };
      const px = img => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
      const [pa, pb] = [px(ia), px(ib)]; let n = 0;
      for (let i = 0; i < pa.length; i += 4) if (Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]) > 30) n++;
      return { n, total: pa.length / 4 };
    }, [da, db]);
    if (r.size || r.n > 0) diffs.push(`${n}: ${r.size || `${r.n} of ${r.total} pixels differ`}`);
  }
  await browser.close();
  console.log(diffs.length ? `${diffs.length} screen(s) differ:\n  ${diffs.join('\n  ')}` : `✅ ${names.length} screenshots identical`);
  process.exitCode = diffs.length ? 1 : 0;
}

if (cmd === 'capture' && a) await capture(a);
else if (cmd === 'compare' && a && b) await compare(a, b);
else { console.log('usage: node tools/shots.mjs capture <dir> | compare <dirA> <dirB>'); process.exitCode = 2; }
