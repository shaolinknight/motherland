// Light / dark / match iPhone. index.html applies the saved choice before first paint (so a forced
// light theme never flashes dark); this keeps it in sync when the setting changes.
import { settings } from './store.js';

export function applyTheme() {
  const t = settings().theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  // Status-bar / browser chrome color follows the page background.
  const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#9C0C24' : '#C8102E');
}
