// Swipe in from the left edge to go back, like iOS. Home-screen apps on iPhone have no back gesture,
// and the ✕ / ‹ buttons sit in the hardest corner to reach one-handed. In order of what's on top:
// a sheet closes, a lesson or game closes (asking first if answers would be lost), a detail page goes back.
// Not used in iOS Safari tabs, where the browser's own back swipe already does this.
const EDGE = 28, FIRE = 70;

function target() {
  const sheet = document.querySelector('.sheet-wrap.open');
  if (sheet) return { el: sheet.querySelector('.sheet'), go: () => sheet.querySelector('.sheet-backdrop').click() };
  const layer = document.querySelector('.session');
  if (layer) return { el: layer, go: () => layer.querySelector('.s-close')?.click() };
  const back = document.querySelector('#app .back');
  if (back) return { el: document.getElementById('app'), go: () => back.click() };
  return null;
}

export function enableEdgeSwipe() {
  const iosBrowserTab = /iP(hone|ad|od)/.test(navigator.userAgent) && !navigator.standalone && !matchMedia('(display-mode: standalone)').matches;
  if (iosBrowserTab) return;
  let start = null, t = null, dx = 0;
  const reset = () => { if (t?.el) { t.el.style.transition = 'transform .2s cubic-bezier(.2, .8, .2, 1)'; t.el.style.transform = ''; setTimeout(() => { if (t?.el) t.el.style.transition = ''; }, 220); } };
  document.addEventListener('touchstart', e => {
    const p = e.touches[0];
    start = e.touches.length === 1 && p.clientX <= EDGE ? { x: p.clientX, y: p.clientY } : null;
    t = start ? target() : null; dx = 0;
    if (!t) start = null;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!start) return;
    const p = e.touches[0]; dx = p.clientX - start.x; const dy = Math.abs(p.clientY - start.y);
    if (dy > 40 && dy > dx) { reset(); start = null; return; }   // it's a scroll, not a swipe
    if (dx > 0) {
      if (e.cancelable) e.preventDefault();
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) t.el.style.transform = `translateX(${Math.min(dx, 160) * 0.5}px)`;
    }
  }, { passive: false });
  const end = () => {
    if (!start) return;
    start = null; const fire = dx > FIRE, go = t.go;
    reset();
    if (fire) go();
  };
  document.addEventListener('touchend', end); document.addEventListener('touchcancel', () => { start = null; reset(); });
}
