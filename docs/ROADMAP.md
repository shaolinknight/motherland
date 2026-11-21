# Motherland roadmap

## Now: make it feel native (see `docs/FIRST_PROMPT.md`)
0. Audit → `docs/AUDIT.md` with baseline numbers
1. Speed: cached-first service worker + update toast, fix the module waterfall
2. Motion: View Transitions, press feedback, sheet drag-to-dismiss, reduced-motion crossfades
3. Polish: `100dvh`, safe areas, keyboard, scroll restoration, large text
4. Haptics: checkbox-switch trick, single pulse, with a setting to turn it off
5. Accessibility fixes from the audit

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
- **Family audio (optional, free).** Let me record a family member saying items and store the clips per item. This would need a free storage plan (e.g. files in the repo or Google Drive). Discuss before building.

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
