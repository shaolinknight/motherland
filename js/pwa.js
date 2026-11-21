// Service worker registration and the "Update ready" toast.
// The worker is cache-first (see sw.js), so a new deploy installs quietly in the background and waits.
// We then offer a one-tap refresh, and also apply it on our own whenever that can't interrupt anything:
// when the app goes to the background with no lesson or game open. A deploy can never leave the phone
// stuck: the waiting version takes over on that next background moment or the next cold start.
import { $ } from './util.js';

let reloading = false;
const busy = () => !!document.querySelector('.session');   // lessons, reviews, tests and games

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
  if (!reg.waiting) { location.reload(); return; }
  reg.waiting.postMessage('skipWaiting');   // → controllerchange → reload below
}

function watch(reg) {
  if (reg.waiting && navigator.serviceWorker.controller) showToast(reg);
  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    w?.addEventListener('statechange', () => {
      // "installed" with an existing controller means an update (not the first install).
      if (w.state === 'installed' && navigator.serviceWorker.controller) showToast(reg);
    });
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
    // Home-screen apps can stay open for days; look for a deploy every time the app comes back.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
      else if (reg.waiting && !busy()) apply(reg);
    });
  }).catch(e => console.warn('SW failed', e));
}
