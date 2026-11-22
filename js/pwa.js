// Service worker registration and updates.
// The worker is cache-first (see sw.js): launches never wait for the network, and a new deploy
// installs quietly in the background. As soon as it's ready we switch to it, but only at a moment
// that can't interrupt anything: no lesson, game or sheet open and no field being typed in. Right
// after a launch that's almost always true, so updates simply appear. If you're mid-lesson, an
// "Update ready" toast waits, and the switch happens when you finish, leave, or background the app.
// iOS can freeze a backgrounded app before it switches, so we never rely on that moment alone.
import { $ } from './util.js';
import { saveNow } from './store.js';

let reloading = false;
const busy = () => !!document.querySelector('.session, .sheet-wrap') ||
  !!document.activeElement?.matches?.('input, textarea, select');

function showToast(reg, onTap = () => apply(reg)) {
  if ($('.update-toast')) return;
  const el = document.createElement('div');
  el.className = 'update-toast';
  el.setAttribute('role', 'status');
  el.innerHTML = '<button type="button"><b>Update ready</b><span>Tap to refresh</span></button>';
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  el.querySelector('button').onclick = onTap;
}

function apply(reg) {
  saveNow();   // nothing pending is lost in the reload
  if (!reg.waiting) { location.reload(); return; }
  reg.waiting.postMessage('skipWaiting');   // → controllerchange → reload below
}

// Switch now if nothing is in progress, otherwise ask with the toast and switch at the next quiet moment.
function offer(reg) {
  if (!reg.waiting || !navigator.serviceWorker.controller) return;
  if (!busy()) apply(reg); else showToast(reg);
}

function watch(reg) {
  offer(reg);   // an update that finished installing during an earlier visit
  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    w?.addEventListener('statechange', () => { if (w.state === 'installed') offer(reg); });
  });
  // Quiet moments: a lesson/game/sheet just closed, or the app comes back to the foreground.
  window.addEventListener('motherland:refresh', () => setTimeout(() => offer(reg), 300));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { offer(reg); reg.update().catch(() => {}); }
    else if (reg.waiting && !document.querySelector('.session')) apply(reg);
  });
}

// ── Safety net: a deploy must arrive even if the browser's own updater is stuck ──
// In WebKit (iPhone Safari's engine) registration.update() was seen to never settle, even across
// reloads, so a new sw.js was never installed and the app stayed on the old version. This check reads
// the deployed sw.js itself. If its version hasn't started installing a few seconds later (installing
// opens a cache with that name), it clears this app's caches and reloads: the old worker then finds
// nothing cached and fetches every file fresh. Only the Cache API is used, which doesn't wait on the
// stuck updater. Done at most once per version, so it can't loop.
const RESCUE_KEY = 'motherland.swRescue';
const STALL_MS = 8000;
let checking = false;

async function deployedVersion() {
  // The old worker caches whatever it fetches, so drop any cached copy of sw.js first.
  for (const k of await caches.keys()) await (await caches.open(k)).delete('./sw.js', { ignoreSearch: true });
  const res = await fetch('./sw.js', { cache: 'no-store' });
  return res.ok ? (await res.text()).match(/const VERSION = '([^']+)'/)?.[1] : null;
}

async function rescue() {
  saveNow();
  for (const k of await caches.keys()) if (k.startsWith('motherland-')) await caches.delete(k);
  location.reload();
}

// Runs on its own, never inside register().then(): register() waits on the same updater, and in the
// stuck state it never resolves. getRegistration() is only a lookup, but is time-boxed anyway.
async function checkStalled() {
  if (checking || !navigator.onLine || !navigator.serviceWorker.controller) return;
  checking = true;
  try {
    const reg = await Promise.race([navigator.serviceWorker.getRegistration(), new Promise(r => setTimeout(r, 2000))]);
    const latest = await deployedVersion();
    if (!latest || (await caches.has(latest))) return;   // up to date, or the update is already installing
    await new Promise(r => setTimeout(r, STALL_MS));     // give the browser's own updater its chance
    if ((await caches.has(latest)) || reg?.waiting || reg?.installing) return;
    let done = null; try { done = localStorage.getItem(RESCUE_KEY); } catch { /* private mode */ }
    if (done === latest) return;                          // already rescued into this version once
    try { localStorage.setItem(RESCUE_KEY, latest); } catch { /* private mode */ }
    if (busy()) showToast(reg, rescue); else await rescue();
  } catch { /* offline or blocked: try again next time */ } finally { checking = false; }
}

// Reload into the new version only once its worker has finished activating. Reloading the moment it
// takes control sends the page's request to a half-ready worker; WebKit (iPhone Safari's engine) was
// seen to stall there, leaving the worker "activating" and blocking every later update. A short
// fallback means we never wait forever.
function reloadWhenActivated(sw) {
  if (!sw || sw.state === 'activated') { location.reload(); return; }
  let done = false;
  const go = () => { if (!done) { done = true; location.reload(); } };
  sw.addEventListener('statechange', () => { if (sw.state === 'activated') go(); });
  setTimeout(go, 3000);
}

export function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Only reload for an update; the very first install also fires controllerchange (clients.claim).
    if (reloading || !hadController) return;
    reloading = true; reloadWhenActivated(navigator.serviceWorker.controller);
  });
  // Safety net at launch and on every return to the app (see checkStalled).
  checkStalled();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkStalled(); });
  navigator.serviceWorker.register('./sw.js').then(reg => {
    watch(reg);
    reg.update().catch(() => {});   // iOS can skip its own check on launch; ask explicitly
  }).catch(e => console.warn('SW failed', e));
}
