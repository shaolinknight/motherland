// Review planner: how many reviews land on each of the next days, and an optional daily cap.
// The cap only limits *due-card reviews* (Flashcards, Quiz review). New lessons, Endless and decks are
// never capped, and cards past the cap simply stay due for tomorrow — nothing is lost.
import * as C from './course.js';
import * as S from './store.js';
import { isHidden } from './srs.js';

export const CAP_CHOICES = [0, 50, 100, 200];   // 0 = off

// Counts for today (including anything overdue) and the following days, by local calendar day.
export function forecast(days = 7, now = Date.now()) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const ends = Array.from({ length: days }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i + 1); return d.getTime(); });
  const out = ends.map((end, i) => ({ date: new Date(end - 1), n: 0, today: i === 0 }));
  const cards = C.cards();
  for (const it of C.studyItems()) {
    const c = cards[it.id];
    if (!c || c.suspended) continue;
    const due = Math.max(c.due, isHidden(c, now) ? c.buriedUntil : 0);   // buried cards come back when the bury ends
    const i = ends.findIndex(e => due < e);
    if (i >= 0) out[i].n++;
  }
  return out;
}

// Reviews of due cards done today (counted in exercises.gradeCard).
export const reviewedToday = () => S.day().rev || 0;
export const cap = () => S.settings().reviewCap || 0;
// How many more due cards today's cap allows (Infinity when there's no cap).
export const capLeft = () => (cap() ? Math.max(0, cap() - reviewedToday()) : Infinity);
