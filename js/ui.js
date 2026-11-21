// Native-feeling bottom sheets (replace browser prompt/confirm, which look out of
// place in a home-screen app) + keyboard-aware full-screen layers.
import { esc, $, $$ } from './util.js';
import * as S from './store.js';
import { toast } from './util.js';

// sheet({ title, text, html, actions: [{ label, value, kind }] }) → Promise<value | null>
export function sheet({ title = '', text = '', html = '', actions = [{ label: 'OK', value: true, kind: 'primary' }], onOpen } = {}) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = `<div class="sheet-backdrop"></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title || text || 'Options')}" tabindex="-1">
        <div class="sheet-grip" aria-hidden="true"></div>
        ${title ? `<h2>${esc(title)}</h2>` : ''}${text ? `<p class="muted">${esc(text)}</p>` : ''}${html}
        <div class="sheet-actions">${actions.map((a, i) => `<button class="btn ${a.kind || 'ghost'}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div>
      </div>`;
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('open'));
    let closed = false;
    const unfit = fitToViewport(wrap);   // a sheet with a text field stays above the keyboard
    const release = trapFocus(wrap, $('.sheet', wrap), () => done(null));
    const done = v => {
      if (closed) return; closed = true;
      unfit(); release(); window.removeEventListener('hashchange', onNav);
      wrap.classList.remove('open'); setTimeout(() => wrap.remove(), 220); resolve(v);
    };
    $('.sheet-backdrop', wrap).onclick = () => done(null);
    const onNav = () => done(null);   // a sheet never outlives the screen it was opened on
    window.addEventListener('hashchange', onNav, { once: true });
    dragToDismiss(wrap, () => done(null));
    $$('.sheet-actions .btn', wrap).forEach(b => b.onclick = () => {
      const a = actions[+b.dataset.i];
      done(typeof a.value === 'function' ? a.value(wrap) : a.value);
    });
    onOpen && onOpen(wrap);
  });
}

// Modal layers (sheets, lessons, games): make everything behind them inert so VoiceOver and the
// keyboard stay inside, move focus in, close on Escape, and give focus back to where it was.
// Returns a function that undoes all of it. Layers can stack (a sheet over a lesson).
export function trapFocus(layer, focusTarget = layer, onEscape) {
  const opener = document.activeElement;
  const hidden = [...document.body.children].filter(el =>
    el !== layer && !el.inert && !['SCRIPT', 'NOSCRIPT'].includes(el.tagName) && el.id !== 'toast' && !el.classList.contains('update-toast'));
  hidden.forEach(el => { el.inert = true; });
  const onKey = e => { if (e.key === 'Escape' && onEscape) { e.stopPropagation(); onEscape(); } };
  layer.addEventListener('keydown', onKey);
  requestAnimationFrame(() => { if (!layer.contains(document.activeElement)) focusTarget.focus({ preventScroll: true }); });
  return () => {
    layer.removeEventListener('keydown', onKey);
    hidden.forEach(el => { el.inert = false; });
    if (opener?.isConnected && !opener.closest('[inert]')) opener.focus({ preventScroll: true });
  };
}

// Pull a sheet down to close it, like iOS. Starts only when the sheet is scrolled to the top, so its
// own content can still scroll. Touch events (not pointer events) so we can stop the page scrolling.
function dragToDismiss(wrap, close) {
  const sheetEl = $('.sheet', wrap), backdrop = $('.sheet-backdrop', wrap);
  let startY = null, dy = 0, lastY = 0, lastT = 0, speed = 0;
  const set = y => {
    sheetEl.style.transform = y ? `translateY(${y}px)` : '';
    backdrop.style.opacity = y ? String(Math.max(0, 1 - y / sheetEl.offsetHeight)) : '';
  };
  const start = (y, t, target) => {
    if (sheetEl.scrollTop > 0 || target.closest('input, select, textarea')) return;
    startY = lastY = y; lastT = t; dy = 0; speed = 0;
    sheetEl.style.transition = 'none'; backdrop.style.transition = 'none';
  };
  const move = (y, t, e) => {
    if (startY == null) return;
    dy = Math.max(0, y - startY);
    if (dy > 0 && e.cancelable) e.preventDefault();
    speed = (y - lastY) / Math.max(1, t - lastT); lastY = y; lastT = t;   // px per ms
    set(dy);
  };
  const end = () => {
    if (startY == null) return;
    startY = null;
    sheetEl.style.transition = ''; backdrop.style.transition = '';
    set(0);
    if (dy > 90 || (dy > 20 && speed > 0.5)) close();   // far enough, or a quick flick
  };
  sheetEl.addEventListener('touchstart', e => start(e.touches[0].clientY, e.timeStamp, e.target), { passive: true });
  sheetEl.addEventListener('touchmove', e => move(e.touches[0].clientY, e.timeStamp, e), { passive: false });
  sheetEl.addEventListener('touchend', end); sheetEl.addEventListener('touchcancel', end);
  // Mouse (iPad with a trackpad, desktop testing): drag from the grip only.
  $('.sheet-grip', wrap).addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') return;
    start(e.clientY, e.timeStamp, e.target);
    const mv = ev => move(ev.clientY, ev.timeStamp, ev);
    const up = () => { end(); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  });
}

// Close a full-screen lesson/game layer with a short slide down. It is renamed right away so
// nothing (tests, the update check) still sees an open session while it animates out.
export function dismissLayer(el) {
  el.className = 'layer-leaving';
  el.setAttribute('aria-hidden', 'true');
  el.addEventListener('animationend', () => el.remove(), { once: true });
  setTimeout(() => el.remove(), 400);   // in case animations are off
}

export const confirmSheet =(title, text, okLabel = 'Yes', kind = 'primary') =>
  sheet({ title, text, actions: [{ label: 'Cancel', value: false }, { label: okLabel, value: true, kind }] });

const REASONS = ['Wrong tone or spelling', 'Wrong meaning', 'Not how Saigon people say it', 'Audio sounds wrong', 'Other'];

// Report a possibly-wrong item.
export async function flagSheet(item) {
  const res = await sheet({
    title: 'Report a problem',
    html: `<div class="flag-item"><b lang="vi">${esc(item.vi)}</b><span class="muted">${esc(item.en)}</span></div>
      <div class="reason-chips">${REASONS.map((r, i) => `<button class="chip-btn ${i === 0 ? 'on' : ''}" data-r="${esc(r)}">${esc(r)}</button>`).join('')}</div>
      <label class="field"><span>Note (optional)</span><input class="flag-note" placeholder="e.g. my mom says “…”" autocomplete="off"></label>`,
    actions: [
      { label: 'Cancel', value: null },
      { label: 'Send flag', kind: 'primary', value: w => `${$('.chip-btn.on', w)?.dataset.r || 'Other'}${$('.flag-note', w).value.trim() ? ` — ${$('.flag-note', w).value.trim()}` : ''}` },
    ],
    onOpen: w => $$('.chip-btn', w).forEach(b => b.onclick = () => { $$('.chip-btn', w).forEach(x => x.classList.remove('on')); b.classList.add('on'); }),
  });
  if (res == null) return false;
  S.flag(item, res);
  toast('Flagged for review 🚩');
  return true;
}

// Keep a full-screen layer above the iPhone keyboard (so Check buttons stay visible).
export function fitToViewport(el) {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  const fit = () => {
    el.style.height = `${vv.height}px`;
    el.style.top = `${vv.offsetTop}px`;
    el.style.bottom = 'auto';
    // Keep the field being typed in visible too (the footer's Check button is already inside the layer).
    const f = document.activeElement;
    if (f && el.contains(f) && f.matches('input, textarea')) f.scrollIntoView({ block: 'nearest' });
  };
  fit();
  vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
  return () => { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); };
}
