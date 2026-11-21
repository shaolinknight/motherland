// Offline support. Bump VERSION whenever you upload new files so phones update.
const VERSION = 'motherland-v1.1.0';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/main.js', './js/screens.js', './js/exercises.js', './js/games.js', './js/placement.js',
  './js/course.js', './js/store.js', './js/srs.js', './js/speech.js', './js/sync.js',
  './js/vitext.js', './js/util.js', './js/icons.js', './js/ui.js', './js/stats.js',
  './data/vi.js', './data/vi-a.js', './data/vi-b.js', './data/vi-grammar.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Network first for app files (so updates show up), cache as fallback when offline.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // never touch Google Sheet calls
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
