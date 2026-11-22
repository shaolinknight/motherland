// All app screens, one module per area in js/screens/. Each renders into #app and wires its own events.
export { startLesson, VERSION } from './screens/shared.js';
export { home } from './screens/home.js';
export { learn, unit, grammar, mywords } from './screens/learn.js';
export { words } from './screens/words.js';
export { review, deck } from './screens/review.js';
export { play, leaderboard } from './screens/play.js';
export { progress, placement, diagnostics } from './screens/progress.js';
export { settings } from './screens/settings.js';
