# Motherland roadmap

## Done: make it feel native (see `docs/FIRST_PROMPT.md`, results in `docs/AUDIT.md`)
0. Audit → `docs/AUDIT.md` with baseline numbers
1. Speed: cached-first service worker + update toast, fix the module waterfall
2. Motion: View Transitions, press feedback, sheet drag-to-dismiss, reduced-motion crossfades
3. Polish: `100dvh`, safe areas, keyboard, scroll restoration, large text
4. Haptics: checkbox-switch trick, single pulse, with a setting to turn it off
5. Accessibility fixes from the audit

## Done: v1.7 (Nov 28, 2026): design review, top 10
- Accessibility failures fixed (axe: 18 screens to 0), 44 px tap targets and real switches, no "0% accuracy" after a lesson with no questions, an empty-state Review, Word bank under Learn, neutral headers (red kept for actions), one type scale (28 sizes to 11, weights to 3, plus fixed exceptions), a grouped action sheet for card options, learning status as shapes with labels, and large-text fixes (titles wrap, XP ring grows, week chart letters).
- Then the rest of the review: one icon set, plain words, calmer Home, Word bank by unit, grouped Settings, one-line review modes, neutral disabled buttons, red-tint destructive actions, palette-aware greeting, game intros with recent runs.

## Done: v1.6 (Nov 22, 2026)
- **Review planner:** a "This week" chart of reviews due each day, and an optional daily review limit (Settings → Study).
- **Undo for small changes** (bury, suspend, deck add/remove, mark checked, keep placement words, remove a flag). Big changes (delete a deck or word, resets, restoring a backup) still ask "are you sure".
- **Friendlier Home:** one "Next up" action, a short "Needs attention" list, and a sync status line with Retry.
- **Developer:** CI in WebKit and Chromium, permanent feature tests, errors reported from the phone as flags, `screens.js` split into `js/screens/`, CSS consolidated (pixel-identical), state format versioning with migrations, accessibility and speed re-check.

## Decided against (for now)
- Family check mode, family audio recordings, a tone keyboard, quick 5-minute lessons.

## Done: v1.5 (Nov 21, 2026)
- Question mid-screen with answers at the bottom; tap-anywhere flashcard flip (and back); bigger grade buttons.
- Edit the text of any card (course cards are overlaid and logged as flags).
- Custom decks: fill from the course or write every card yourself; study a deck on its own.
- Diagnostic: adaptive early stop, “what this level means”, units you might know (Test out), Reset placement.
- Preview links start with sample data (Settings → Preview to reset).

## Done: v1.4 (Nov 21, 2026)
- Updates apply by themselves at the next quiet moment (no more being stuck on an old version).
- Stricter placement (80% per level, production questions), no bulk skipping, Test out per unit, re-check of what the old test skipped.
- One-handed use: bottom-anchored lessons, left-edge swipe back, unit action bar.
- Six more units (u32–u37), marked “needs family check”.

## Done: v1.3 (agreed and built Nov 21, 2026; one commit per item, on preview until confirmed on the phone)
Still open from v1.3: family check of units u25–u31 (remove `review: true` per unit once confirmed).
Order: the progress-touching work first (sync merge, then FSRS), each kept separate.
1. **Safety**
   - Per-card sync merge instead of "newest save wins": keep the most recent review of each card, combine day logs, flags and lessons. Done on the phone; the Apps Script contract does not change.
   - Close any open lesson/game overlay when the route changes underneath it.
   - Backup reminder every ~2 weeks when Sheet sync isn't set up.
2. **Anki-style review (ideas re-implemented in plain JS; Anki's code is AGPL and Rust, so nothing is copied)**
   - FSRS scheduler replacing SM-2 in `js/srs.js`, with existing cards migrated (old-shape fixture test).
   - Desired-retention setting (e.g. 90%).
   - Fuzz so cards learned together don't all come due the same day.
   - Leeches: cards missed repeatedly are flagged and fed to Weak spots.
   - Suspend (hide for good) and bury (hide until tomorrow).
   - Export a tab-separated file that Anki can import.
3. **Habits and comfort**
   - Streak freeze: one free missed day per week.
   - Dark mode: follows the iPhone, with a Settings override.
4. **My words deck**: add your own words/phrases (IDs `my-…`, never positional), marked "unverified" until checked with family, reviewed like course items, synced with the state.
5. **Grammar guide search**, with or without accents.
6. **Seven new Vietnamese units**, appended: wedding day logistics, family gatherings and đám giỗ, phone calls with relatives, ordering for a group, bargaining, healthcare, texting slang. Saigon-first, one grammar point each, validator must pass, and every new unit marked "needs family check" in the app.
7. **Placement keeps shaping lessons**: latest result sets the starting unit, marks clearly-known words as learned, tilts each lesson's exercise mix toward weak skills, and suggests a retest after a few weeks.
- Held for later: review planner / daily review cap.

## Next: content and learning
- **More Vietnamese units.** Append only (IDs are positional), and every unit gets a grammar point. Possible topics:
  - Wedding day logistics
  - Family gatherings and đám giỗ (death anniversaries)
  - Phone calls with relatives
  - Restaurant ordering for groups
  - Bargaining
  - Healthcare
  - Texting slang
- **Fixing flagged items.** Pull the Flags tab or the in-app list and fix confirmed problems, with a validator run each time.
- **Graded reading library.** Longer stories at each level, built from words already learned.

## Later: more languages
| Language | Approach |
|---|---|
| Korean | Hangul first (a few hours to learn). Romanization only as a short bridge. Particles and verb endings as grammar points. |
| Japanese | Hiragana and katakana first, words shown in real script with audio, no long-term rōmaji. Sentence structure (SOV) and particles (は, が, を, に, で) as grammar points. |
| Spanish (Mexico) | Mexican vocabulary and voice (es-MX). Conjugation tables + fill drills for present, preterite, imperfect and future. Ser vs. estar. |

Each language gets its own validator and passes the same QA before release.

## Ideas I've asked for
- **Mixed-language decks** (e.g. Vietnamese + Spanish for the same meaning). Add a shared `concept` key to items in every course, then build a deck/review mode that pulls the same concept across languages.
- **Shared leaderboards** (weekly/monthly with friends or family). Use the Google Sheet as a free backend: each person syncs a summary row, and the app reads the board. Needs a simple privacy choice, i.e. what gets shared.
