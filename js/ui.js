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
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="sheet-grip"></div>
        ${title ? `<h2>${esc(title)}</h2>` : ''}${text ? `<p class="muted">${esc(text)}</p>` : ''}${html}
        <div class="sheet-actions">${actions.map((a, i) => `<button class="btn ${a.kind || 'ghost'}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div>
      </div>`;
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('open'));
    const done = v => { wrap.classList.remove('open'); setTimeout(() => wrap.remove(), 220); resolve(v); };
    $('.sheet-backdrop', wrap).onclick = () => done(null);
    $$('.sheet-actions .btn', wrap).forEach(b => b.onclick = () => {
      const a = actions[+b.dataset.i];
      done(typeof a.value === 'function' ? a.value(wrap) : a.value);
    });
    onOpen && onOpen(wrap);
  });
}

export const confirmSheet = (title, text, okLabel = 'Yes', kind = 'primary') =>
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
  };
  fit();
  vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
  return () => { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); };
}
