// Helpers shared by all screens: header, audio buttons, bars, backups, lesson start.
import * as C from '../course.js';
import * as S from '../store.js';
import * as X from '../exercises.js';
import * as G from '../games.js';
import { sync } from '../sync.js';
import { speak, audioAvailable, voicesReady } from '../speech.js';
import { $, $$, esc, dayKey } from '../util.js';
import { icon } from '../icons.js';

export const VERSION = '1.6.4';
export const L = () => C.get().speechLang;
export const say = (t, opts) => speak(t, L(), opts);
export const go = h => { location.hash = h; };

export function wireSay(root) {
  $$('[data-say]', root).forEach(b => b.addEventListener('click', e => {
    if (e.target.closest('.flag-it, a')) return;
    e.stopPropagation(); say(b.dataset.say, b.dataset.rate ? { rate: +b.dataset.rate } : {});
  }));
}
export const sayBtn = (t, label = 'Play audio') => audioAvailable(L()) ? `<button class="icon-btn say" data-say="${esc(t)}" aria-label="${label}">${icon('speaker')}</button>` : '';
export const bar = (p, cls = '') => `<div class="bar ${cls}"><div style="width:${Math.max(0, Math.min(100, p))}%"></div></div>`;
export const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// Tab pages: brand bar + large title. Detail pages: back button that returns to `back` if opened directly.
export function header(title, { back, sub } = {}) {
  if (back) return `<header class="top">
    <button class="icon-btn back" data-parent="${esc(back)}" aria-label="Back">${icon('back')}</button>
    <h1 class="top-title">${esc(title)}${sub ? `<small lang="vi">${esc(sub)}</small>` : ''}</h1>
    <span class="icon-btn-spacer"></span>
  </header>`;
  return `<header class="top">
    <div class="brand"><span class="star">★</span> Motherland</div>
    <span class="grow"></span>
    <button class="icon-btn gear" aria-label="Settings">${icon('gear')}</button>
  </header>${title ? `<div class="large-title"><h1>${esc(title)}</h1>${sub ? `<p class="muted">${esc(sub)}</p>` : ''}</div>` : ''}`;
}
export function wireHeader(root) {
  const b = $('.back', root);
  if (b) b.onclick = () => { if (window.__navDepth > 0) { window.__goingBack = true; history.back(); } else go(b.dataset.parent); };
  $('.gear', root)?.addEventListener('click', () => go('#/settings'));
}

export function audioBanner() {
  if (!voicesReady() || audioAvailable(L())) return '';
  return `<a class="banner warn" href="#/settings/audio">🔇 No Vietnamese voice found on this device, so listening drills are off. Tap to fix.</a>`;
}

export const GAMES = { match: G.match, speed: G.speed, tones: G.toneHunter, listen: G.listen };

export function startLesson(unitId) {
  const steps = X.lessonSteps(unitId);
  X.run({ steps, activity: `lesson:${unitId}`, onFinish: () => {
    const p = C.unitProgress(unitId);
    const rec = (S.lang().lessons[unitId] ||= {});
    rec.at = Date.now(); rec.done = p.learned === p.total;
    S.save();
  } });
}

export function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Download all progress as a JSON file (Settings → Backup, and the Home reminder).
// The sync password is left out: the file may end up in Files, iCloud or a chat.
export function exportBackup() {
  const st = S.get();
  const copy = { ...st, settings: { ...st.settings, syncKey: '' } };
  download(`motherland-backup-${dayKey()}.json`, JSON.stringify(copy, null, 1), 'application/json');
  st.settings.lastBackup = Date.now(); S.save({ touch: false });
}

// Without Sheet sync, progress lives only in Safari's storage for this site. Nudge a backup every
// two weeks once there's something worth keeping (10+ items studied).
export const BACKUP_EVERY = 14 * 86400000;
export function backupDue() {
  const st = S.settings();
  if (st.syncUrl || Object.keys(C.cards()).length < 10) return false;
  return Date.now() - Math.max(st.lastBackup || 0, st.backupSnooze || 0) > BACKUP_EVERY;
}

// "🔥 12-day streak · 🧊 freeze ready": one missed day a week is forgiven.
export function streakLine() {
  const { n, freezeLeft } = S.streakDetails();
  if (!n) return 'Start a streak today';
  const freeze = freezeLeft ? '🧊 freeze ready' : '🧊 freeze used this week';
  return `🔥 ${n}-day streak · <span title="One missed day a week won’t break your streak">${freeze}</span>`;
}
