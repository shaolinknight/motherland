// Light / dark / match iPhone, and the colors of the language you're learning. index.html applies
// both before first paint (so nothing flashes); this keeps them in sync when they change.
import { settings, get } from './store.js';

export function applyTheme() {
  const root = document.documentElement;
  const t = settings().theme;
  if (t === 'light' || t === 'dark') root.dataset.theme = t;
  else delete root.dataset.theme;
  root.dataset.lang = get().lang || 'vi';   // picks the palette in app.css
  // Status bar / browser chrome follows the header: the language's main color (deeper in dark mode).
  const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  const css = getComputedStyle(root);
  const color = css.getPropertyValue(dark ? '--brand-deep' : '--brand').trim();
  if (color) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}
