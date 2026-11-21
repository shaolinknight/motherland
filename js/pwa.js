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

function showToast(reg) {
  if ($('.update-toast')) return;
  const el = document.createElement('div');
  el.className = 'update-toast';
  el.setAttribute('role', 'status');
  el.innerHTML = '<button type="button"><b>Update ready</b><span>Tap to refresh</span></button>';
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  el.querySelector('button').onclick = () => apply(reg);
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

export function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Only reload for an update; the very first install also fires controllerchange (clients.claim).
    if (reloading || !hadController) return;
    reloading = true; location.reload();
  });
  navigator.serviceWorker.register('./sw.js').then(reg => {
    watch(reg);
    reg.update().catch(() => {});   // iOS can skip its own check on launch; ask explicitly
  }).catch(e => console.warn('SW failed', e));
}
