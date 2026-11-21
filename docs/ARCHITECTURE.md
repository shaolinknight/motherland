# Motherland architecture

## Code map
| File | What it does |
|---|---|
| `index.html` | App shell: `#app` (screens) + `#tabs` (bottom tab bar). Loads `js/main.js`. |
| `js/main.js` | Boot, hash router (`#/home`, `#/unit/u03/grammar`…), back-navigation depth, View Transitions between screens, per-screen scroll memory, sync on open/return. |
| `js/pwa.js` | Service worker registration and the "Update ready" toast (cache-first updates). |
| `js/haptics.js` | One light haptic tick (iOS 17.4+ `<input switch>` trick, `navigator.vibrate` elsewhere), gated by `settings.haptics`. |
| `js/screens.js` | Every screen: home, learn, unit, grammar guide, word bank, review, play, leaderboard, progress, placement, diagnostics, settings. Each renders via `innerHTML` and wires its own events. |
| `js/exercises.js` | Exercise types and the full-screen **session runner** used by lessons, reviews, endless mode and the placement test. Also the grammar renderers and the synonym-safe answer-choice picker (`clash`). |
| `js/games.js` | Match pairs, Speed round, Tone hunter, Listen up. Flow: intro → 3-2-1 → play → results (with missed words). Keeps a run history for leaderboards. |
| `js/placement.js` | Placement test builder, scoring (level, skills, topics, weak areas), "skip ahead" seeding. |
| `js/stats.js` | Dashboard and leaderboard aggregations: weeks/months ranked, fair same-point comparison, records, 30-day growth, 12-week heatmap. |
| `js/course.js` | Loads a course and turns units into study **items** (word / phrase / grammar). Progress helpers. |
| `js/srs.js` | Spaced repetition (SM-2 style). `nextInterval()` is the tuning point. |
| `js/store.js` | App state, saved to `localStorage['motherland.v1']`. Day logs, XP, streaks, flags, pending sessions. |
| `js/sync.js` | Google Sheet sync: pull if the Sheet is newer, then push. `text/plain` POST to avoid CORS preflight. |
| `js/speech.js` | Built-in voices (Web Speech API), iOS speech unlock on first tap, mic recording for "compare yourself". |
| `js/vitext.js` | Vietnamese text tools: answer comparison (exact / tones / letters), tone variants, syllable diff. |
| `js/ui.js` | Bottom sheets (replace browser dialogs, drag down to close), the flag/report sheet, keyboard-aware full-screen layers, `trapFocus()` for modal layers, `dismissLayer()` exit animation. |
| `js/icons.js`, `js/util.js` | Inline SVG icons and small helpers. |
| `data/vi.js` | Vietnamese course entry: metadata + units (from `vi-a.js`, `vi-b.js`) + grammar (`vi-grammar.js`). |
| `apps-script/Code.gs` | The Google Apps Script web app for sync. It lives in my Google account, not on Cloudflare. |
| `tools/` | `validate.mjs` (content checker), `test-logic.mjs`, `qa.mjs`, `qa-sync.mjs` (also simulates deploys), `audit.mjs` (perf/a11y numbers, see `docs/AUDIT.md`), `serve.mjs`. Dev only. |

## Content format (`data/`)
Unit fields: `id, section, icon, level (1–3), title, vi, tip, words[], phrases[], dialogue[], reading{vi,en}`.

- **Word:** `[vietnamese, english, hanoiVariant, note]`.
- **Phrase:** `[vietnamese, english]`.
- **Dialogue line:** `[speaker, vietnamese, english]`.
- **Grammar point** (`vi-grammar.js`, keyed by unit id): `{ title, explain, pattern?, table?, examples: [[vi, en]], drills }`. There are three drill types:
  - `['fill', 'Sentence with ___', [options], 'answer', 'English']`
  - `['choose', 'English', [sentences], correctIndex]`
  - `['order', 'Correct sentence.', 'English']`

**Item IDs are positional:** `u03-w0` (word), `u03-p2` (phrase), `u07-g1` (grammar). Progress is keyed by these IDs, so **append only. Never reorder.**

## State shape (`motherland.v1`)
```js
{
  v: 1, updatedAt, deviceId, lang: 'vi',
  settings: { showHanoi, rate, voiceURI, forceAudio, haptics, dailyGoal, newPerLesson, syncUrl, syncKey, lastSync, syncError },
  langs: { vi: {
    cards: { [itemId]: { reps, ivl, ease, due, lapses, seen, last } },   // SRS
    lessons: { [unitId]: { at, done } },
    placements: [{ at, level, label, score, c, t, levels, skills, sections, weak, applied? }],
    skills: { vocab|reading|grammar|listening|tones|speaking: { c, t } },
    games: { match|speed|tones|listen: { best, at, runs: [{ score, at }] } },
  } },
  days: { 'YYYY-MM-DD': { xp, ms, c, t, words, skills: { [skill]: { c, t } } } },
  flags: [{ id, at, lang, itemId, vi, en, note, synced }],
  pending: [{ id, at, lang, activity, ms, xp, c, t }],   // sessions not yet sent to the Sheet
}
```

## Sync protocol (Apps Script)
- **Request:** `POST` body (text/plain JSON) `{ key, action }`.
  - `pull` returns `{ ok, state, updatedAt }`.
  - `push` sends `{ updatedAt, deviceId, state (JSON string, no syncUrl/syncKey), sessions, flags }`.
- **Sheet tabs:**
  - **State:** chunked JSON backup.
  - **Sessions:** one row per study session, de-duplicated by ID.
  - **Flags:** de-duplicated by ID.
- **Conflict rule:** the newer `updatedAt` wins, and local unsent sessions are kept.

## Adding a language (checklist)
1. Create `data/<code>.js` (+ part files), with the same unit format. Add `speechLang`, `levels` and `sections`.
2. Register it in `COURSES` in `js/course.js` and remove it from `UPCOMING`.
3. Write a validator for its script (Hangul syllable blocks, kana/kanji, Spanish accents). Vietnamese checks live in `tools/validate.mjs`.
4. Script-specific exercises: Korean = Hangul-first reading, Japanese = kana-first; tone drills are Vietnamese only. Spanish needs conjugation drills; use grammar `table` + `fill` drills.
5. Add a language switcher to Settings (state is already per language under `langs`).

## Known limitations
- Built-in iPhone voices may not exist for Vietnamese, and may sound Northern even when they do.
- Leaderboards are personal (you vs. your past weeks/months). Shared boards would need the Sheet as a backend.
- Mixed-language decks need a shared `concept` key on items across languages (not added yet).

## Rough baseline (Nov 21, 2026, measured in Chrome)
Simulated slow 3G (150 ms latency, 1.6 Mbps), cold load to the first screen: **~2.1 s, 44 requests, ~309 KB uncompressed**. The 17 JS modules load as an import waterfall. Re-measure properly in WebKit during the audit.
