# Motherland architecture

## Code map
| File | What it does |
|---|---|
| `index.html` | App shell: `#app` (screens) + `#tabs` (bottom tab bar). Loads `js/main.js`. |
| `js/main.js` | Boot, hash router (`#/home`, `#/unit/u03/grammar`…), back-navigation depth, View Transitions between screens, per-screen scroll memory, sync on open/return/back online. Installs error reporting first. |
| `js/pwa.js` | Service worker registration and the "Update ready" toast (cache-first updates). Reloads only once a new worker is `activated`. **Stalled-update safety net** (`checkStalled`): WebKit's updater was seen to hang for good (even `register()` never resolved), so on launch and on return the page reads the deployed `sw.js` itself; if that version hasn't started installing within 8 s, it clears the app caches and reloads so files come fresh from the network (once per version). Keep it independent of `register()`. |
| `js/haptics.js` | One light haptic tick (iOS 17.4+ `<input switch>` trick, `navigator.vibrate` elsewhere), gated by `settings.haptics`. |
| `js/screens.js` | Index that re-exports the screens in `js/screens/`, one module per area: `shared.js` (header, audio buttons, backups, lesson start, `VERSION`), `home.js`, `learn.js` (Learn, unit, grammar guide, My words), `words.js`, `review.js` (modes, week chart, decks, word picker), `play.js` (+ leaderboards), `progress.js` (dashboard, placement, diagnostics), `settings.js`. Each renders via `innerHTML` and wires its own events. |
| `js/exercises.js` | Exercise types and the full-screen **session runner** used by lessons, reviews, endless mode and the placement test. Also the grammar renderers and the synonym-safe answer-choice picker (`clash`). |
| `js/games.js` | Match pairs, Speed round, Tone hunter, Listen up. Flow: intro → 3-2-1 → play → results (with missed words). Keeps a run history for leaderboards. |
| `js/placement.js` | Placement test builder, scoring (level, skills, topics, weak areas), "skip ahead" seeding. |
| `js/stats.js` | Dashboard and leaderboard aggregations: weeks/months ranked, fair same-point comparison, records, 30-day growth, 12-week heatmap. |
| `js/course.js` | Loads a course and turns units into study **items** (word / phrase / grammar). Progress helpers. |
| `js/srs.js` | Spaced repetition with **FSRS-5** (the scheduler modern Anki uses, written fresh from the published formulas): stability/difficulty per card, desired retention, Anki-style fuzz, leeches (8 lapses), bury/suspend. Old SM-2 cards convert on their next review (`fromSM2`). |
| `js/merge.js` | Sync merge: combines this phone's state with the Sheet's copy card by card (latest review wins, day logs take the max, lists union). Pure, unit-tested. |
| `js/streak.js` | Streak with one forgiven missed day per Monday–Sunday week; computed from the day log. |
| `js/planner.js` | Review planner: reviews due on each of the next 7 days, and the optional daily review limit (`settings.reviewCap`, counted in `day().rev`). |
| `js/errors.js` | Error reporting: uncaught errors and rejected promises become flags with item `app-error` (once per message per day, max 5 a day), so they reach Settings and the Sheet's Flags tab with no Apps Script change. |
| `js/decks.js` | Custom decks (`lang().decks`): named lists of item IDs, hand-written cards (stored as My words), deck study steps. |
| `js/demo.js` | Sample data for branch previews (`*-motherland.*.workers.dev` or `?demo`), only when that site has no saved progress. |
| `js/levels.js` | Placement scoring rules (80% per level and 2/3 of production questions). |
| `js/gestures.js` | Left-edge swipe: closes a sheet or lesson, or goes back (not in iOS Safari tabs). |
| `js/focus.js` | Reads the latest placement: skill weights that tilt lesson exercise types, retest timing. |
| `js/vispell.js` | Vietnamese spelling/tone rules shared by `tools/validate.mjs` and the app (typo warning in My words). |
| `js/ankiexport.js` | Tab-separated export with Anki's import headers (Basic and reversed card). |
| `js/theme.js` | Light / dark / match-iPhone theme and the **language palette** (`data-lang` on `<html>`; palettes for vi/ko/ja/es live at the end of `css/app.css`, tokens `--brand*` and `--gold*`). `index.html` applies both before first paint. Adding a language: add its palette block (light + dark, 4.5:1 contrast); `npm test` checks every upcoming language has one. |
| `js/store.js` | App state, saved to `localStorage['motherland.v1']`. Day logs, XP, streaks, flags, pending sessions. The format version `v` is upgraded by `MIGRATIONS` (see below). |
| `js/sync.js` | Google Sheet sync: pull if the Sheet is newer, then push. `text/plain` POST to avoid CORS preflight. |
| `js/speech.js` | Built-in voices (Web Speech API), iOS speech unlock on first tap, mic recording for "compare yourself". |
| `js/vitext.js` | Vietnamese text tools: answer comparison (exact / tones / letters), tone variants, syllable diff. |
| `js/ui.js` | Bottom sheets (replace browser dialogs, drag down to close), the flag/report sheet, keyboard-aware full-screen layers, `trapFocus()` for modal layers, `dismissLayer()` exit animation. `undoToast()`: small changes happen at once with Undo; big ones ask first with `confirmSheet()`. |
| `js/icons.js`, `js/util.js` | Inline SVG icons and small helpers. |
| `data/vi.js` | Vietnamese course entry: metadata + units (from `vi-a.js` … `vi-d.js`) + grammar (`vi-grammar.js`). Units with `review: true` (u25–u37) are shown as “needs family check” and left out of the placement test. |
| `apps-script/Code.gs` | The Google Apps Script web app for sync. It lives in my Google account, not on Cloudflare. |
| `tools/` | `validate.mjs` (content checker), `test-logic.mjs`, `qa.mjs`, `qa-sync.mjs` (also simulates deploys), `qa-features.mjs` (a permanent check for each feature), `shots.mjs` (screenshot capture + pixel compare for refactors), `audit.mjs` (perf/a11y numbers, see `docs/AUDIT.md`), `watchdog.mjs`, `serve.mjs`. Dev only. |
| `.github/workflows/check.yml` | CI: `npm run check` in WebKit and Chromium on every push. |

## Design conventions (v1.7, from the design review)
- **Headers** (`header()` in `js/screens/shared.js`) sit on the page background, never a coloured bar: Home has a slim name bar, tab pages a large title with Settings beside it, detail pages a compact sticky bar with Back whose title wraps. Red is for actions, the active tab and progress. The status bar uses `apple-mobile-web-app-status-bar-style: default` with `theme-color` set to `--cream`, so iOS picks readable status text.
- **Type scale** tokens `--fs-caption` 12 · `--fs-secondary` 14 · `--fs-body` 16 · `--fs-headline` 17 · `--fs-heading` 20 · `--fs-title` 26 · `--fs-display` 32 px; weights 400 / 600 / 700. Exceptions: 11 px tab labels, 16 px inputs, emoji and big numbers.
- **Tap targets** at least 44 px; settings toggles are switches in 48 px rows.
- **Action sheets**: `sheet({ menu: true })` with `{ group, icon, kind: 'warn' }` on actions; Cancel (value `null`) sits apart. Use it for option lists; keep plain `sheet()` for confirmations.
- **Learning status**: `statusDot()` (ring = new, half = learning, check = mastered, with a VoiceOver label) and `statusLegend()`; never a colour alone.
- **Empty states**: one `.empty-state` card with the next step, not a list of disabled options.

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
  v: 2, updatedAt, deviceId, lang: 'vi',   // format version, see Migrations
  settings: { showHanoi, rate, voiceURI, forceAudio, haptics, retention, theme, dailyGoal, newPerLesson, reviewCap, syncUrl, syncKey, lastSync, syncError, lastBackup, backupSnooze },
  langs: { vi: {
    cards: { [itemId]: { reps, ivl, ease, due, lapses, seen, last,     // SRS (ease is legacy SM-2, kept for old cards)
                         s, d, leech?, suspended?, buriedUntil?, edited?, placed? } },   // FSRS stability/difficulty + card state
    myWords: { ['my-…']: { id, vi, en, north, note, verified, at, edited, deleted?, deck? } },   // your own words; deletes are tombstones
    edits: { [itemId]: { vi?, en?, north?, note?, edited, reset? } },   // your text laid over course cards
    decks: { ['deck-…']: { id, name, items: [itemId], at, edited, deleted? } },
    lessons: { [unitId]: { at, done } },
    placements: [{ at, level, label, score, c, t, levels, skills, sections, weak, applied? }],
    skills: { vocab|reading|grammar|listening|tones|speaking: { c, t } },
    games: { match|speed|tones|listen: { best, at, runs: [{ score, at }] } },
  } },
  days: { 'YYYY-MM-DD': { xp, ms, c, t, words, rev, skills: { [skill]: { c, t } } } },   // rev: due-card reviews (daily limit)
  flags: [{ id, at, lang, itemId, vi, en, note, synced }],   // itemId 'app-error' = an error reported by the app
  pending: [{ id, at, lang, activity, ms, xp, c, t }],   // sessions not yet sent to the Sheet
}
```

### Migrations
The storage key stays `motherland.v1` forever. The format inside is versioned by `v` (`SCHEMA` in `js/store.js`). Every saved state (from storage, a backup file or the Sheet) passes through `migrate()`, which applies `MIGRATIONS[v]` one step at a time. To change the format: bump `SCHEMA`, add `MIGRATIONS[old]`, and add a test with an old-shape fixture in `tools/test-logic.mjs`. A state from a newer app version is left as it is.

## Sync protocol (Apps Script)
- **Request:** `POST` body (text/plain JSON) `{ key, action }`.
  - `pull` returns `{ ok, state, updatedAt }`.
  - `push` sends `{ updatedAt, deviceId, state (JSON string, no syncUrl/syncKey), sessions, flags }`.
- **Sheet tabs:**
  - **State:** chunked JSON backup.
  - **Sessions:** one row per study session, de-duplicated by ID.
  - **Flags:** de-duplicated by ID.
- **Deletions (v1.5.1):** removed cards, placement results, lesson records and flags leave dated tombstones (`tomb`), and Reset progress sets `resetAt`, so a merge never brings deleted things back from an older copy.
- **Conflict rule (v1.3):** merged on the phone by `js/merge.js`, never “newest save wins”: per card the latest change (review `last` or bury/suspend `edited`) wins; day logs take the larger value per field; flags, placements, game runs and My words are unioned; settings come from the newer save; the sync URL/password and unsent sessions stay local. The Apps Script contract is unchanged.

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
