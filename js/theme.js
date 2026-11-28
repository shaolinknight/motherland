// Light / dark / match iPhone, and the colors of the language you're learning. index.html applies
// both before first paint (so nothing flashes); this keeps them in sync when they change.
import { settings, get } from './store.js';

export function applyTheme() {
  const root = document.documentElement;
  const t = settings().theme;
  if (t === 'light' || t === 'dark') root.dataset.theme = t;
  else delete root.dataset.theme;
  root.dataset.lang = get().lang || 'vi';   // picks the palette in app.css
  // Status bar / browser chrome matches the page background (the header is neutral), in the theme in use.
  const color = getComputedStyle(root).getPropertyValue('--cream').trim();
  if (color) document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', color));
}
