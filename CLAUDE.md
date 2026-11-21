# Motherland: instructions for Claude Code

Read this before every session. Deeper details live in `docs/ARCHITECTURE.md`; the plan lives in `docs/ROADMAP.md`.

## What this is
Motherland is my personal language-learning app. Vietnamese comes first (Saigon/Southern as the main form, Hanoi variants shown). Korean, Japanese and Mexican Spanish come later. It is an installable web app (PWA) that I use from my iPhone home screen. iPhone and iPhone Plus are the main devices, and iPad is a secondary layout.

- **It must stay $0.** No paid APIs, no API keys, no paid hosting, no runtime CDNs or web fonts. Free dev tools only.
- **Hosting:** GitHub repo `shaolinknight/motherland` → Cloudflare Pages. `main` = production. Every other branch gets a preview URL at `https://<branch>.motherland.pages.dev`.
- **Sync:** progress is saved on the phone (localStorage) and optionally mirrored to my own Google Sheet through `apps-script/Code.gs`.

## Stack (keep it this way unless I agree to change it)
- No build step. The repo root *is* the site. Vanilla ES modules, no framework, **no runtime dependencies**.
- `index.html` loads `js/main.js`. Styles are in `css/app.css`. Lesson content is in `data/`.
- `sw.js` provides offline support. `manifest.webmanifest` + `icons/` handle home-screen install.

## Commands
```bash
npm install                    # dev tools only (Playwright)
npx playwright install webkit  # once; WebKit is the closest engine to iPhone Safari
npm run serve                  # http://localhost:8123
npm run validate               # Vietnamese spelling/tone checker over ALL content
npm test                       # logic unit tests (answer checking, tones, review timing)
npm run qa                     # click-through of every screen at 375/393/430/820 widths
npm run qa:sync                # Google Sheet sync (simulated), backup restore, offline
npm run check                  # all of the above; must pass before any push
```
If WebKit can't be downloaded, use `BROWSER=chromium npm run qa` (add `CHROME_PATH=...` to use an installed Chrome). Say which engine you used.

## Non-negotiable rules
1. **Language correctness comes first.**
   - Run `npm run validate` after any content change. It must pass.
   - Never invent words or translations. If you're not sure something is natural Vietnamese, say so and leave it for me to check with family. Don't guess.
   - Saigon is the primary form. Hanoi words go in the 3rd field of a word entry. Never "correct" a Southern word to the Northern one.
   - Content I flag in the app (🚩) shows in Settings and in the Sheet's Flags tab. Treat those as bug reports.
2. **Never lose my progress.**
   - The localStorage key `motherland.v1` and the state shape are a contract. If the shape must change, write a migration and test it with an old-shape fixture.
   - **Item IDs come from array positions** (`u03-w0` = unit 3, word 0). Never reorder or delete entries in `data/`. Only append. To retire an item, ask me first.
3. **Don't break sync.**
   - The Apps Script contract (`action: push/pull`, `key`, `state`, `sessions`, `flags`) is shared with a deployed script I can't update automatically. If you change it, tell me exactly how to redeploy: Manage deployments → Edit → New version, so the URL stays the same.
   - Never send the sync password into the Sheet.
4. **Service worker safety.**
   - Bump `VERSION` in `sw.js` on every change that ships files, and add any new file to its `FILES` list.
   - A deploy must never leave me stuck on a stale or broken cached copy.
5. **iPhone first.**
   - Design for 375–430px widths.
   - Tap targets at least 44px. Inputs at 16px so iOS doesn't zoom.
   - Respect safe areas.
   - No browser `alert/confirm/prompt`. Use the sheets in `js/ui.js`.
   - Respect `prefers-reduced-motion`.
   - Animate only `transform` and `opacity`. Avoid CSS `linear()` spring easing, which janks on iOS Safari; use `cubic-bezier`.
   - `navigator.vibrate` does nothing on iOS.
6. **Audio is the phone's built-in voice** (Web Speech API).
   - A Vietnamese voice may be missing. Always gate audio features with `audioAvailable()`.
   - iOS needs a user tap before the first utterance.

## How to work
- **Run everything yourself.** Install, serve, run the checks, and read the real output. Never claim something works without running it.
- **Verify in a browser.** Use Playwright WebKit at iPhone sizes. Check that screens render, sessions and games complete, offline works and the console is clean. Take before/after screenshots for UI changes and look at them.
- **Measure, don't guess.** For performance work, record before/after numbers using the same method each time. If a change doesn't help, say so and revert it.
- **Test the risky logic.**
  - Add tests for anything touching state, migrations, sync, the service worker or answer grading.
  - Include failure cases: offline, Sheet unreachable, stale cache, corrupted storage.
- **Review your own diff** as a skeptical reviewer before finishing. Look for bugs, dead code, duplication, leftover debugging and scope creep. Fix what you find and re-run the checks.
- **Write good code.** Small focused modules, clear names, comments that explain *why*, and match the existing style.
- **Work in small steps.** One branch per phase or feature, one logical change per commit, clear commit messages.
- **Be honest about limits.** Playwright WebKit is not a real iPhone. Tap feel, animation smoothness, audio and the keyboard need my check on the phone.

## When you finish a piece of work
Tell me:
1. What changed, in plain English.
2. The preview URL for the branch.
3. A short checklist of what to try on my iPhone.
4. Any numbers (before → after).
5. Anything I need to do by hand, such as redeploying the Apps Script.

Don't merge to `main` until I say it feels right on my phone.
