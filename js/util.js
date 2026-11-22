// Small shared helpers.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const sample = (arr, n) => shuffle(arr).slice(0, n);
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Local calendar day key, e.g. 2026-11-21
export function dayKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// Monday-start week containing date d → array of 7 day keys
export function weekKeys(d = new Date()) {
  const start = new Date(d); start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(start); x.setDate(start.getDate() + i); return dayKey(x); });
}
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const pct = (c, t) => (t ? Math.round((c / t) * 100) : 0);

// A short message above the tab bar. With `action` ({ label, run }) it carries a button (e.g. Undo)
// and stays a little longer; the next toast replaces it.
export function toast(msg, ms = 2200, action) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; el.classList.toggle('has-action', !!action);
  if (action) {
    const b = document.createElement('button');
    b.className = 'toast-action'; b.textContent = action.label;
    b.onclick = () => { clearTimeout(el._t); el.classList.remove('show'); action.run(); };
    el.append(b);
  }
  el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), action ? Math.max(ms, 6000) : ms);
}

export function timeAgo(ts) {
  if (!ts) return 'never';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

