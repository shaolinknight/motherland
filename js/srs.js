// Spaced repetition: decides when each word/phrase comes back for review.
// Grades: 0 = Again (forgot), 1 = Hard, 2 = Good, 3 = Easy.
//
// The scheduler is FSRS (Free Spaced Repetition Scheduler), the algorithm modern Anki uses. It is
// written fresh here from the published formulas (FSRS-5, default parameters); no Anki code is
// copied. Each card tracks:
//   s = stability: days until recall probability falls to 90%
//   d = difficulty: 1 (easy) … 10 (hard)
// After every answer FSRS updates s and d, and the next interval is chosen so that the chance of
// still remembering the card when it comes back equals your desired retention (Settings, 90% default).
//
// Older cards (SM-2 era: ivl/ease only) are converted the first time they're graded; see fromSM2().
// The fields reps, ivl, lapses, due, seen, last keep their meaning, so the rest of the app, the
// Sheet backup and old exports keep working.
const DAY = 86400000;
const MIN = 60000;

// FSRS-5 default weights (from the open-source FSRS project).
const W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192,
  1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
const DECAY = -0.5;
const FACTOR = 19 / 81;            // makes R(t = s) = 0.9
const MAX_IVL = 365;               // days
const RELEARN = 10 * MIN;          // "Again" → see it again in ~10 minutes, like Anki's learning step
export const LEECH_AT = 8;         // Anki's default leech threshold (lapses)

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const clampD = d => clamp(d, 1, 10);

export function newCard() {
  return { reps: 0, ivl: 0, ease: 2.5, due: 0, lapses: 0, seen: Date.now(), last: 0 };
}

// Probability of recalling a card `days` after its last review.
export const retrievability = (days, s) => Math.pow(1 + FACTOR * days / s, DECAY);

// Days until recall probability drops to `retention`. Equals s at 90%.
export const intervalFor = (s, retention = 0.9) => (s / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);

const initS = G => W[G - 1];
const initD = G => clampD(W[4] - Math.exp(W[5] * (G - 1)) + 1);

function nextD(d, G) {
  const delta = -W[6] * (G - 3);
  const dPrime = d + delta * (10 - d) / 9;                 // linear damping near 10
  return clampD(W[7] * initD(4) + (1 - W[7]) * dPrime);   // drift back toward the default
}

function successS(d, s, r, G) {
  const hard = G === 2 ? W[15] : 1, easy = G === 4 ? W[16] : 1;
  return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy);
}

function lapseS(d, s, r) {
  return Math.min(s, W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)));
}

const sameDayS = (s, G) => s * Math.exp(W[17] * (G - 3 + W[18]));

// Convert an SM-2 card: its interval was set where recall was roughly 90%, which is what stability
// means, and ease 2.5 (default) ↔ difficulty 5, ease 1.3 (floor) ↔ difficulty ~9.
export function fromSM2(card) {
  return {
    ...card,
    s: Math.max(0.1, card.ivl || 0.1),
    d: clampD(5 + (2.5 - (card.ease ?? 2.5)) * (4 / 1.2)),
  };
}

// Anki-style fuzz: spread reviews a little so cards learned together don't all land on one day.
// No fuzz under 2.5 days; then ±15% → ±10% → ±5% of the extra length, at least ±1 day.
export function fuzzRange(ivl) {
  if (ivl < 2.5) return [ivl, ivl];
  const ranges = [[2.5, 7, 0.15], [7, 20, 0.1], [20, Infinity, 0.05]];
  const delta = 1 + ranges.reduce((a, [start, end, f]) => a + f * Math.max(Math.min(ivl, end) - start, 0), 0);
  return [Math.max(2, Math.round(ivl - delta)), Math.min(MAX_IVL, Math.round(ivl + delta))];
}

// The next interval in days for grade g (no fuzz). Kept as a separate, exported function so tests
// and the Settings preview can show what each button would do.
export function nextInterval(card, g, { retention = 0.9, now = Date.now() } = {}) {
  return schedule(card, g, { retention, now, fuzz: false }).ivl;
}

function schedule(card, g, { retention = 0.9, now = Date.now(), fuzz = true, rng = Math.random } = {}) {
  const G = g + 1;   // FSRS ratings are 1–4
  const c = card.s == null && card.reps + card.lapses > 0 ? fromSM2(card) : { ...card };
  let s, d;
  if (c.s == null) {                       // first ever review
    s = initS(G); d = initD(G);
  } else {
    const days = Math.max(0, (now - (c.last || now)) / DAY);
    const r = retrievability(days, c.s);
    d = nextD(c.d, G);
    if (days < 1) s = sameDayS(c.s, G);                      // reviewed again the same day
    else s = G === 1 ? lapseS(c.d, c.s, r) : successS(c.d, c.s, r, G);
  }
  s = clamp(s, 0.01, 36500);
  let ivl;
  if (G === 1) ivl = RELEARN / DAY;
  else {
    ivl = clamp(Math.round(intervalFor(s, retention)), 1, MAX_IVL);
    if (fuzz) { const [lo, hi] = fuzzRange(ivl); ivl = lo + Math.floor(rng() * (hi - lo + 1)); }
  }
  return { ...c, s, d, ivl };
}

export function grade(card, g, now = Date.now(), { retention = 0.9, rng } = {}) {
  const c = schedule(card, g, { retention, now, rng });
  if (g === 0) {
    c.lapses++; c.reps = 0;
    // Leech: reached the threshold, and again every half-threshold after (Anki's rule).
    if (c.lapses >= LEECH_AT && (c.lapses - LEECH_AT) % (LEECH_AT / 2) === 0) { c.leech = true; c.leechNew = true; }
  } else c.reps++;
  c.due = now + Math.round(c.ivl * DAY);
  c.last = now;
  return c;
}

// Bury = hide until tomorrow (local midnight). Suspend = hide until you un-suspend it.
export function tomorrow(now = Date.now()) { const t = new Date(now); t.setHours(24, 0, 0, 0); return t.getTime(); }
export const isHidden = (card, now = Date.now()) => !!card && (card.suspended || (card.buriedUntil || 0) > now);

export const isDue = (card, now = Date.now()) => !!card && card.due <= now && !isHidden(card, now);
export const isLearned = card => card && card.reps > 0;
export const isMastered = card => card && card.ivl >= 21;
export { DAY, MIN };
