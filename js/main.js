// Boot + router.
import * as V from './screens.js';
import * as S from './store.js';
import { sync, syncSoon } from './sync.js';
import { $, $$ } from './util.js';
import { icon } from './icons.js';
import { stop as stopAudio } from './speech.js';
import { registerSW } from './pwa.js';
import { applyTheme } from './theme.js';
import { enableEdgeSwipe } from './gestures.js';
import { seedIfEmpty } from './demo.js';

const TABS = [
  ['home', 'Home', 'home'],
  ['learn', 'Learn', 'book'],
  ['review', 'Review', 'cards'],
  ['play', 'Play', 'game'],
  ['progress', 'Progress', 'chart'],
];

const nav = $('#tabs');
nav.innerHTML = TABS.map(([k, n, ic]) => `<a href="#/${k}" data-tab="${k}">${icon(ic)}<span>${n}</span></a>`).join('');

function render() {
  const [, name = 'home', a, b] = (location.hash || '#/home').split('/');
  const root = $('#app');
  const screens = {
    home: () => V.home(root),
    learn: () => V.learn(root),
    unit: () => V.unit(root, a, b),
    grammar: () => V.grammar(root),
    words: () => V.words(root),
    leaderboard: () => V.leaderboard(root, a),
    review: () => V.review(root),
    play: () => V.play(root),
    progress: () => V.progress(root),
    placement: () => V.placement(root),
    diagnostics: () => V.diagnostics(root),
    settings: () => V.settings(root, a),
    mywords: () => V.mywords(root),
    deck: () => V.deck(root, a, b),
  };
  (screens[name] || screens.home)();
  const tab = ['unit', 'grammar', 'mywords'].includes(name) ? 'learn' : ['placement', 'diagnostics', 'words', 'leaderboard'].includes(name) ? 'progress' : name === 'deck' ? 'review' : name;
  $$('a', nav).forEach(x => {
    const on = x.dataset.tab === tab;
    x.classList.toggle('on', on);
    if (on) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current');
  });
}

// Scroll position per screen, so switching tabs or going Back lands where you were.
history.scrollRestoration = 'manual';
const scrollMemory = new Map();
const screenKey = hash => (hash || '#/home').split('/').slice(0, 3).join('/');
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let transitionId = 0;
// dir: 'forward' (open a detail page), 'back', or 'tab' (switch tabs).
function route(dir) {
  stopAudio();
  const show = () => {
    render();
    window.scrollTo(0, dir === 'forward' ? 0 : scrollMemory.get(screenKey(location.hash)) || 0);
    // VoiceOver: land on the new screen's title instead of staying on a link that no longer exists.
    const h = $('#app h1');
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  };
  // Never animate underneath a lesson, game or sheet.
  const animate = dir && !document.querySelector('.session, .sheet-wrap');
  if (animate && document.startViewTransition) {
    document.documentElement.dataset.nav = dir;
    const vt = document.startViewTransition(show);
    const mine = ++transitionId;
    // A second navigation mid-animation skips this one; that's expected, not an error.
    vt.ready.catch(() => {});
    vt.finished.catch(() => {}).then(() => { if (mine === transitionId) delete document.documentElement.dataset.nav; });
    return;
  }
  show();
  if (animate) {   // older iOS: a light CSS entrance instead of a View Transition
    const r = $('#app');
    r.dataset.enter = dir; r.classList.remove('screen-in'); void r.offsetWidth; r.classList.add('screen-in');
  }
}

// How many in-app pages deep we are, so Back returns within the app (or to the parent page).
window.__navDepth = 0;
window.addEventListener('hashchange', (e) => {
  const tabs = TABS.map(t => `#/${t[0]}`);
  const to = location.hash.split('/').slice(0, 2).join('/');
  const from = e.oldURL ? new URL(e.oldURL).hash : '';
  scrollMemory.set(screenKey(from), window.scrollY);
  let dir;
  if (window.__goingBack) { window.__goingBack = false; window.__navDepth = Math.max(0, window.__navDepth - 1); dir = 'back'; }
  else if (tabs.includes(to)) { window.__navDepth = 0; dir = 'tab'; }
  else { window.__navDepth = from.includes('#/') ? window.__navDepth + 1 : 0; dir = 'forward'; }
  route(dir);
});
// Tapping the tab you're already on scrolls to the top, like iOS.
nav.addEventListener('click', e => {
  const a = e.target.closest('a');
  if (a?.classList.contains('on') && location.hash === a.getAttribute('href')) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
  }
});
// iOS Safari only shows :active press states when the page has a touch listener.
document.addEventListener('touchstart', () => {}, { passive: true });

// Sessions/games fire this when they close so counts refresh in place.
window.addEventListener('motherland:refresh', () => {
  const y = window.scrollY; render(); window.scrollTo(0, y);
  syncSoon();
});
// After a sync brought in progress from another device, re-draw in place (not under a lesson).
window.addEventListener('motherland:synced', () => {
  if (document.querySelector('.session')) return;
  const y = window.scrollY; render(); window.scrollTo(0, y);
});
// Voices load late on iOS; re-render once so audio buttons appear.
if (window.speechSynthesis) speechSynthesis.addEventListener?.('voiceschanged', () => { if (!document.querySelector('.session')) { const y = scrollY; render(); scrollTo(0, y); } }, { once: true });

// Fallback for iOS, which may never fire voiceschanged: re-render once voices show up.
import('./speech.js').then(sp => setTimeout(() => {
  if (sp.audioAvailable('vi-VN') && !document.querySelector('[data-say], .session')) { const y = scrollY; render(); scrollTo(0, y); }
}, 1800));

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { S.saveNow(); }
  else sync();
});
// Back online after being offline: sync what was saved on the phone meanwhile.
window.addEventListener('online', () => syncSoon(1000));

seedIfEmpty();   // preview links start with sample data (never the real app)
applyTheme();
enableEdgeSwipe();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
render();
// Paint first from local data; the Sheet sync and SW check happen after the first frame.
requestAnimationFrame(() => setTimeout(() => { sync(); registerSW(); }, 0));
