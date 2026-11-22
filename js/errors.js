// Error reporting from the phone, at $0: an uncaught error becomes a flag (item "app-error"), so it shows
// in Settings → Flagged items and syncs to the Flags tab of the Sheet like any other flag. No new Sheet
// columns or Apps Script changes: message → English column, version/screen/source → note.
import * as S from './store.js';

export const ERROR_ITEM = 'app-error';
const MAX_PER_DAY = 5;   // one bug in a loop must not flood the Flags tab

let version = '';
export function installErrorReporting(appVersion) {
  version = appVersion;
  window.addEventListener('error', e => report(e.error || e.message, e.filename && `${short(e.filename)}:${e.lineno}:${e.colno}`));
  window.addEventListener('unhandledrejection', e => report(e.reason));
}

const short = url => String(url).replace(location.origin, '').replace(/^\//, '');

// Exported for tests. Returns true when the error was recorded.
export function report(err, where = '') {
  try {
    const msg = String(err?.message || err || 'Unknown error').slice(0, 300);
    // "Script error." carries no details (another origin, e.g. a browser extension); nothing to act on.
    if (/^Script error\.?$/.test(msg) || /ResizeObserver loop/.test(msg)) return false;
    // WebKit's wording when a request is cancelled by a reload (e.g. an update check of sw.js). Not a bug.
    if (/due to access control checks/.test(msg)) return false;
    const stack = String(err?.stack || '').split('\n').find(l => /\.js/.test(l)) || '';
    const source = where || short(stack.trim().replace(/^at\s+/, '').replace(/^.*?@/, '')).slice(0, 120);
    const today = new Date().toDateString();
    const todays = S.get().flags.filter(f => f.itemId === ERROR_ITEM && new Date(f.at).toDateString() === today);
    if (todays.length >= MAX_PER_DAY || todays.some(f => f.en === msg)) return false;   // once per message per day
    const note = [`v${version}`, location.hash || '#/home', source].filter(Boolean).join(' · ');
    S.flag({ id: ERROR_ITEM, vi: '⚠️ App error', en: msg }, note);
    return true;
  } catch { return false; }   // reporting must never cause another error
}
