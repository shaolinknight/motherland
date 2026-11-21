// Offline support + instant launches. Bump VERSION whenever you upload new files so phones update,
// and add any new file to FILES (npm test checks that every module is listed).
//
// Strategy: cache-first. Launches are served from this version's cache, so they don't wait for the
// network. A new deploy changes this file; the browser notices on the next launch and installs the new
// version in the background. The page (js/pwa.js) then shows "Update ready" and, on tap, tells the new
// worker to take over and reloads. Nothing is ever mixed between versions: each version has its own cache.
const VERSION = 'motherland-v1.5.1';
const FILES = [
  './', './manifest.webmanifest', './css/app.css',
  './js/main.js', './js/screens.js', './js/exercises.js', './js/games.js', './js/placement.js',
  './js/course.js', './js/store.js', './js/srs.js', './js/speech.js', './js/sync.js',
  './js/vitext.js', './js/util.js', './js/icons.js', './js/ui.js', './js/stats.js', './js/pwa.js', './js/haptics.js', './js/merge.js', './js/ankiexport.js', './js/streak.js', './js/theme.js', './js/vispell.js', './js/focus.js', './js/levels.js', './js/gestures.js', './js/decks.js', './js/demo.js',
  './data/vi.js', './data/vi-a.js', './data/vi-b.js', './data/vi-c.js', './data/vi-d.js', './data/vi-grammar.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // cache: 'reload' skips the browser's HTTP cache so a deploy can't be cached with stale files.
    await cache.addAll(FILES.map(f => new Request(f, { cache: 'reload' })));
    // First install: nothing to update from, so take over right away. Updates wait for the user's tap.
    if (!self.registration.active) await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('motherland-') && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;   // never touch Google Sheet calls
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    // Every page navigation is the app shell; the hash does the routing. The shell is cached as './'
    // (not index.html) because Cloudflare Pages redirects /index.html → /, and Safari refuses to
    // use a redirected response for a navigation.
    const hit = req.mode === 'navigate'
      ? await cache.match('./')
      : await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') { const shell = await cache.match('./'); if (shell) return shell; }
      throw err;
    }
  })());
});
