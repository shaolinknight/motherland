# Motherland 🇻🇳

Your personal language app. It starts with Vietnamese (Saigon first, with Hanoi variants shown) and is built so Korean, Japanese and Mexican Spanish can be added later. It costs nothing to run: there are no servers or API keys, audio uses the iPhone's built-in voices, and progress syncs to your own Google Sheet.

## What's inside
- **32 units, 482 words, 196 phrases, 184 dialogue lines and 32 short readings**, organized by real situations. Units 25–31 (wedding planning, đám giỗ, phone calls with relatives, ordering for a group, bargaining, the pharmacy, texting shorthand) are new and marked **“needs family check”** until a native speaker confirms them.
- **33 grammar points with 110 drills**, one or two per unit: pronouns, là, có…không, đã/đang/sẽ, chưa, classifiers, comparisons, bị/được, particles (nha, đi, hả, nè), respect words (dạ, ạ) and more. Each comes with an explanation, tables, tappable examples and fill-the-gap, which-is-correct and word-order drills. Grammar is taught inside each unit’s first lesson and comes back in reviews. Weddings come early (units 3–6: the wedding day, ceremonies and customs, wishes and toasts, giving a speech).
- **Lessons** introduce up to 8 new items at a time, then drill them with meaning quizzes, tone picking, sentence building, dictation and speaking practice (record yourself and compare).
- **Spaced repetition with FSRS** (the scheduler modern Anki uses) brings each word back when your chance of remembering it drops to your target (90% by default). Anki-style touches: interval labels on the grade buttons, fuzz, leeches, bury and suspend, and an **Export for Anki** file. You can review with flashcards, quiz review, endless review or a weak-words drill.
- **Placement test and diagnostics** give your level, scores by skill and topic, what to work on, and where to start.
- **Dashboard** shows this week's XP per day (compared fairly against the same point last week), words learned over 30 days, a 12-week activity heatmap, skills including grammar, recent lessons and the words you miss most.
- **Leaderboards** (you vs. your past self): your weeks and months ranked by XP, top runs per game, and personal records.
- **Word bank**: every word you've learned, searchable with or without accents, filterable by learning, mastered, missed or hidden.
- **My words**: add words you hear from family; they join your reviews and stay “not yet checked” until you confirm them.
- **Grammar guide search**, with or without accents.
- **Placement keeps working**: your latest result sets where Continue learning starts, adds words you clearly know to reviews, gives more practice in weak skills, and reminds you to retest after 4 weeks.
- **Streak freeze** (one missed day a week is forgiven), **dark mode**, and a **backup reminder** when Sheet sync isn't set up.
- **Sync merges** progress from several devices card by card instead of overwriting.
- **Games**: Match pairs, Speed round, Tone hunter and Listen up. Each has a rules screen, a 3-2-1 countdown, a timer that pauses when you leave the app, and a results screen listing the words you missed.
- **🚩 Flag button** on every word and exercise. Flagged items show in Settings and sync to your Sheet, so content can be corrected.

## Working on it with Claude Code
Start with **`docs/SETUP.md`**: GitHub → Cloudflare Pages → Claude Code, plus the everyday loop. Claude Code follows **`CLAUDE.md`**. The first session prompt is in **`docs/FIRST_PROMPT.md`**.

## Put it on your iPhone
1. Create a new GitHub repo (for example `motherland`) and upload everything in this folder.
2. In Cloudflare, go to **Workers & Pages → Create → Pages → Connect to Git**, pick the repo, leave the build command empty and set the output directory to `/`. Deploy.
3. Open the URL in **Safari** on your iPhone, tap **Share → Add to Home Screen**.
4. In iPhone **Settings → Accessibility → Spoken Content → Voices → Vietnamese**, download a voice. Then reopen the app.
5. Optional: add the **Vietnamese (Telex)** keyboard (Settings → General → Keyboard) for dictation. Without it, answers typed without accents still get partial credit.

## Google Sheet sync (free)
Follow the steps at the top of `apps-script/Code.gs`, then paste the web app URL and your password into **Settings → Google Sheet sync**. The Sheet gets three tabs: **State** (backup), **Sessions** (one readable row per study session) and **Flags**.

## Updating the app
- After changing files, bump `VERSION` in `sw.js` so phones pick up the update.
- Lesson content lives in `data/vi-a.js`, `data/vi-b.js` and `data/vi-c.js`. To add a unit, append it (IDs are positional), give it the next `id`, and add `review: true` until a native speaker has checked it.
- **Always run the checks before uploading:**
  ```
  npm run validate   # Vietnamese spelling + tone rules on every word and grammar drill
  npm test           # answer checking, tone variants, review timing
  npm run check      # everything, including the full click-through QA (needs Playwright)
  ```
- `js/srs.js` has a clearly marked `nextInterval()` function. It controls how fast reviews spread out, so tune it if reviews feel too frequent or too rare.

## Built for more languages
Grammar points use a language-neutral format (explanation, table, examples, drills), so Spanish conjugation tables or Japanese particle drills drop in the same way. A future **mixed deck** (for example Vietnamese + Spanish for the same meaning) would add a shared concept key to each word so cards can be matched across languages.

## How correctness is protected
- `tools/validate.mjs` checks every Vietnamese syllable, including all grammar examples and drill answers, and confirms each drill's answer is one of its options: valid spelling patterns (c/k, g/gh, ng/ngh), no more than one tone mark, and the rule that syllables ending in p, t, c or ch only take the sắc or nặng tone.
- Saigon words are primary, and Hanoi alternatives are stored separately so they never get mixed up.
- The 🚩 flags close the loop: if something sounds off to you or your family, flag it and the fix goes into the next update.

## Files
```
index.html, css/, js/        the app
data/                        lesson content
apps-script/Code.gs          Google Sheet sync script
tools/                       content validator, logic tests, automated QA, local server (dev only)
CLAUDE.md, docs/             instructions and plans for Claude Code
sw.js, manifest.webmanifest  offline + home-screen install
```
