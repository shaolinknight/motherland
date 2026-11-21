// Spaced repetition: decides when each word/phrase comes back for review.
// Grades: 0 = Again (forgot), 1 = Hard, 2 = Good, 3 = Easy.
const DAY = 86400000;
const MIN = 60000;

export function newCard() {
  return { reps: 0, ivl: 0, ease: 2.5, due: 0, lapses: 0, seen: Date.now(), last: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// YOUR CALL: how fast cards spread out. This is the heart of the review system.
// Returns the next interval in DAYS (fractions allowed: 0.01 ≈ 15 minutes).
// The defaults follow the SM-2 family that Anki grew out of. Tweak the numbers
// if reviews feel too frequent (raise them) or words keep slipping (lower them).
export function nextInterval(card, grade) {
  if (grade === 0) return 10 / 1440;                 // forgot → see it again in ~10 min
  if (card.reps === 0) return [0, 1, 1, 3][grade];   // first successful look
  if (card.reps === 1) return [0, 2, 3, 6][grade];
  const mult = [0, 1.2, card.ease, card.ease * 1.3][grade];
  return Math.min(365, Math.max(1, card.ivl * mult));
}
// ─────────────────────────────────────────────────────────────────────────────

export function grade(card, g, now = Date.now()) {
  const c = { ...card };
  const ivl = nextInterval(c, g);
  if (g === 0) { c.lapses++; c.reps = 0; c.ease = Math.max(1.3, c.ease - 0.2); }
  else { c.reps++; c.ease = Math.max(1.3, c.ease + [0, -0.15, 0, 0.15][g]); }
  c.ivl = ivl;
  c.due = now + Math.round(ivl * DAY);
  c.last = now;
  return c;
}

export const isDue = (card, now = Date.now()) => card && card.due <= now;
export const isLearned = card => card && card.reps > 0;
export const isMastered = card => card && card.ivl >= 21;
export { DAY, MIN };
