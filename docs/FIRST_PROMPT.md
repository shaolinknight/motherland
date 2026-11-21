# First Claude Code session: paste everything below the line

---

Context: Motherland is my personal language-learning PWA (Vietnamese first). It was built in a chat and is now moving to Claude Code so we can iterate faster and deploy straight from GitHub to Cloudflare Pages. Read `CLAUDE.md`, `docs/ARCHITECTURE.md` and `docs/ROADMAP.md` first and follow them.

I want Motherland to feel like a native iPhone app at $0. A native app needs a paid Apple developer account, so we stay a PWA (installed via Add to Home Screen) and make it fast and smooth. That's the same approach I'm using for my budgeting app, Piggy.

## Step 1: Set up and confirm everything works
1. Run `npm install` and `npx playwright install webkit`. If WebKit can't be downloaded, use Chromium and tell me.
2. Run `npm run check` and show me the result.
3. Fix anything broken before doing anything else.

## Step 2: Audit (don't change app code yet)
Measure what's slow or not native-feeling today. Record baseline numbers in `docs/AUDIT.md` so every later phase is compared against them. Use the same method every time.

**What to measure.** Use Playwright WebKit at 393×852 with a throttled network (Slow 3G and Fast 3G):
- cold load and time to first screen
- warm load, offline load, and load after a new deploy (does the update show up, and when?)
- number of requests and total bytes
- time to open a lesson session and to move between steps
- localStorage save time with a large state (e.g. 1,000 cards and 365 days)
- If you can run Lighthouse for free, add its performance and accessibility scores.

**Things I already suspect.** Confirm or rule out each one with numbers:
1. `sw.js` is network-first, so a slow network delays every launch even though everything is cached.
2. 17 ES modules load as an import waterfall (`main → screens → exercises → …`). Compare `<link rel="modulepreload">` against a bundled file. I prefer keeping no build step on Cloudflare, so if bundling wins, propose how without making deploys harder.
3. Every refresh re-renders whole screens with `innerHTML` and resets scroll. Check if it's noticeable.
4. `store.save()` stringifies the whole state. Check whether it ever becomes slow enough to need IndexedDB.
5. There are no screen-change animations. Tabs swap instantly, and session steps only fade in.
6. Haptics: `navigator.vibrate` does nothing on iOS.
7. Layout uses `position: fixed; inset: 0` for sessions. Check whether `100dvh` and safe areas behave in standalone mode.

Also do an **accessibility audit**:
- VoiceOver labels and roles
- focus order
- color contrast (red/gold theme)
- text at 130% and 200% size
- reduced motion

Then write a ranked plan in `docs/AUDIT.md`: biggest wins first, with estimated impact. **Stop and wait for my OK** before starting Phase 1.

## Phases (each on its own branch, each with before/after numbers)
1. **Speed** (`perf/speed`)
   - Cached-first service worker with a background update and an "Update ready, tap to refresh" toast. A new deploy must never leave me stuck on an old version.
   - Fix the module waterfall.
   - Make sure the first screen paints from local data instantly.
   - Keep sync in the background.
2. **Motion** (`feel/motion`)
   - Use the View Transitions API for tab and screen changes, feature-detected with a fallback.
   - Instant press feedback on every tappable element.
   - Smooth session step transitions; drag-to-dismiss on bottom sheets.
   - Animate only transform and opacity, and use `cubic-bezier` (no CSS `linear()` springs).
   - With Reduce Motion on, use crossfades instead of slides.
3. **Polish** (`feel/polish`)
   - `100dvh` and safe-area padding everywhere.
   - Standalone-mode checks, overscroll control, and per-tab scroll restoration.
   - The iOS keyboard never hides the Check button.
   - Large-text support.
4. **Haptics** (`feel/haptics`)
   - Use the hidden `<input type="checkbox" switch>` trick for a light tap on correct answers and game matches. One pulse type only, with a setting to turn it off.
   - Feature-detect it, since it only works on newer iOS.
5. **Accessibility** (`a11y`): fix everything the audit found.

## Rules
- Follow `CLAUDE.md`, especially: run `npm run validate` after any content change, never reorder content arrays, bump `VERSION` in `sw.js`, and don't break the Google Sheet sync contract.
- Push each branch so Cloudflare builds a preview. Give me the preview URL plus a short checklist of what to try on my iPhone.
- Don't merge to `main` until I confirm it feels right on my phone.
