// Boot + router.
import * as V from './screens.js';
import * as S from './store.js';
import { sync, syncSoon } from './sync.js';
import { $, $$ } from './util.js';
import { icon } from './icons.js';
import { stop as stopAudio } from './speech.js';
import { registerSW } from './pwa.js';

const TABS = [
  ['home', 'Home', 'home'],
  ['learn', 'Learn', 'book'],
  ['review', 'Review', 'cards'],
  ['play', 'Play', 'game'],
  ['progress', 'Progress', 'chart'],
];

const nav = $('#tabs');
nav.innerHTML = TABS.map(([k, n, ic]) => `<a href="#/${k}" data-tab="${k}">${icon(ic)}<span>${n}</span></a>`).join('');

function route() {
  stopAudio();
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
    settings: () => V.settings(root),
  };
  (screens[name] || screens.home)();
  const tab = ['unit', 'grammar'].includes(name) ? 'learn' : ['placement', 'diagnostics', 'words', 'leaderboard'].includes(name) ? 'progress' : name;
  $$('a', nav).forEach(x => x.classList.toggle('on', x.dataset.tab === tab));
  window.scrollTo(0, 0);
}

// How many in-app pages deep we are, so Back returns within the app (or to the parent page).
window.__navDepth = 0;
window.addEventListener('hashchange', (e) => {
  const tabs = TABS.map(t => `#/${t[0]}`);
  const to = location.hash.split('/').slice(0, 2).join('/');
  if (window.__goingBack) { window.__goingBack = false; window.__navDepth = Math.max(0, window.__navDepth - 1); }
  else window.__navDepth = tabs.includes(to) ? 0 : (e.oldURL && e.oldURL.includes('#/') ? window.__navDepth + 1 : 0);
  route();
});
// Sessions/games fire this when they close so counts refresh in place.
window.addEventListener('motherland:refresh', () => {
  const y = window.scrollY; route(); window.scrollTo(0, y);
  syncSoon();
});
// Voices load late on iOS; re-render once so audio buttons appear.
if (window.speechSynthesis) speechSynthesis.addEventListener?.('voiceschanged', () => { if (!document.querySelector('.session')) { const y = scrollY; route(); scrollTo(0, y); } }, { once: true });

// Fallback for iOS, which may never fire voiceschanged: re-render once voices show up.
import('./speech.js').then(sp => setTimeout(() => {
  if (sp.audioAvailable('vi-VN') && !document.querySelector('[data-say], .session')) { const y = scrollY; route(); scrollTo(0, y); }
}, 1800));

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { S.saveNow(); }
  else sync();
});

route();
// Paint first from local data; the Sheet sync and SW check happen after the first frame.
requestAnimationFrame(() => setTimeout(() => { sync(); registerSW(); }, 0));
