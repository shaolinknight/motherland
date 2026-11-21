# Motherland audit: native feel, speed, accessibility

Baseline measured on **Nov 21, 2026** before any Phase 1–5 change. Every later phase is measured the same way, and the results are in the "After" section at the end.

## Method (repeatable)
```bash
BROWSER=chromium CHROME_PATH=/path/to/chrome node tools/audit.mjs <label>   # writes test-results/audit-<label>.json
npm run audit -- <label>                                                    # same, default engine (WebKit)
```
- **Engine: Chromium 1243 (headless).** WebKit could not be downloaded in the cloud container (the Playwright CDN is blocked there), so these numbers are Chromium. The script runs unchanged on WebKit (`BROWSER=webkit`, the default) once it is installed.
- **Viewport:** 393×852 (iPhone 15/16), touch on.
- **Network:** `tools/audit.mjs` runs its own static server that adds a round-trip delay to every response and shares one download pipe between parallel requests. It gzips text files like Cloudflare Pages does. DevTools throttling was not used because it is Chromium-only and does not slow the service worker's own fetches.
  - *Slow 3G:* 400 ms round trip, 400 kbit/s. *Fast 3G:* 150 ms, 1.6 Mbit/s.
- **"First screen"** is the frame where Home's greeting card is painted, measured from navigation start (`performance.now()` inside the page).
- **Median of 3 runs** for loads. Interaction timings are tap → next painted frame, median of 5–20 taps, no throttling.
- **"New deploy"** is simulated by changing `VERSION` in `sw.js` and adding a marker to `index.html`, then relaunching the app up to 3 times.
- **Accessibility:** axe-core 4.10 on 11 screens plus a lesson, keyboard Tab order on Home, and the bottom sheet's focus/Escape behavior. Text size is checked by setting the root font size to 130% and 200%.
- **Lighthouse** was not run: it needs Chrome's full DevTools stack and its own download. axe-core is the same rule engine Lighthouse uses for its accessibility score, so the a11y findings are covered.

## Baseline numbers

### Loading
| | Slow 3G | Fast 3G |
|---|---|---|
| Cold load → first screen | **3.94 s** | **1.34 s** |
| Warm load (app already installed) → first screen | **3.89 s** | **1.32 s** |
| Offline load → first screen | 0.08 s | 0.07 s |
| Requests (cold) | 21 | 21 |
| Bytes over the wire, cold (gzipped) | 87 KB | 83 KB |
| Bytes over the wire, **warm** | **83 KB** | **83 KB** |

**After a new deploy:** the new version shows on the very next launch (it is network-first), but the cost is that every launch waits for the network.

### Interaction (no throttling)
| | Baseline |
|---|---|
| Tab switch (tap → painted) | 6.3 ms |
| Open a lesson | 25.5 ms |
| Next step in a session | 14.1 ms |
| Scroll position kept after a session closes | yes (600 px → 600 px) |
| Scroll position after Learn → Home → Learn | **lost (back to 0)** |
| Screen-change animation | none |

### Storage (1,000 cards + 365 days of history)
| | Baseline |
|---|---|
| State size | 161 KB |
| `saveNow()` median / worst of 25 | 0.8 ms / 2.0 ms |

### Accessibility (axe-core)
**71 violations** across 13 screens:

| Rule | Nodes | What it is |
|---|---|---|
| color-contrast (serious) | 48 | Inactive tab labels `#9B8B84` on white = **3.27 : 1** (needs 4.5). It's every screen, because the tab bar is always there. |
| landmark-one-main | 11 | No `<main>` on tab screens. |
| page-has-heading-one | 6 | Detail screens (unit, word bank, leaderboard, placement, settings) have no `<h1>`. |
| aria-dialog-name (serious) | 2 | The lesson overlay is `role="dialog"` with no name. |
| landmark-no-duplicate-banner / landmark-unique | 4 | The screen behind a lesson still exposes its header, so VoiceOver can wander behind the overlay. |

Other findings (not covered by axe):
- **Bottom sheets:** focus stays behind the sheet when it opens, Escape does nothing, and focus is not returned afterwards.
- **Focus order on Home** is logical (Settings → placement → Start lesson → … → tab bar). ✅
- **Text at 130%:** no problems. **At 200%:** the tab label "Progress" is clipped on every screen, and Home and Unit scroll sideways.
- **Dynamic Type:** the app ignores the iPhone's text-size setting (no `-apple-system-body` font). On iOS, the only way a web app follows Larger Text is through that font keyword.
- **Reduced motion:** honored (all animation is turned off, which is a bit blunt; crossfades are allowed and are better).
- Light-grey helper text (`#B8A89F` placeholders and "tap to flip") and the flag icon (`#C9B9AE`) are below 3 : 1. axe skips placeholders, so they are not in the count.

### Layout
- Sessions use `position: fixed; inset: 0` and no `dvh` anywhere. That works in standalone mode, but `fitToViewport()` already overrides the height when the keyboard opens, so `100dvh` is mostly about Safari-tab use and the iPad.
- Safe areas are respected at the top (header) and bottom (tab bar, session footer, sheets). Left/right insets are not (only matters in landscape).

## Suspicions, confirmed or ruled out
| # | Suspicion | Verdict | Evidence |
|---|---|---|---|
| 1 | Network-first SW delays every launch | **Confirmed, biggest problem** | Warm launch = cold launch (3.89 s vs 3.94 s on slow 3G) and re-downloads 83 KB every time. Offline is 50× faster (0.08 s), which shows what cache-first would give. |
| 2 | Module import waterfall | **Confirmed** | Chain is 6 deep (`main → screens → exercises → course → data/vi → vi-a`). Adding `<link rel="modulepreload">` for all 19 modules: slow 3G cold **3.94 → 2.93 s (−26%)**, fast 3G **1.34 → 0.98 s (−27%)**. Bytes and request count stay the same. |
| | Bundle instead? | **Not worth it** | A bundle would also be 2 round trips (HTML, then one JS file), the same as preload, with the same gzipped bytes. It would add a build step to Cloudflare. Recommendation: modulepreload, no bundler. (An actual esbuild bundle was not measured because the tool download was not allowed in this session.) |
| 3 | Whole-screen `innerHTML` re-renders and scroll resets | **Speed: ruled out. Scroll: partly confirmed** | Re-renders are 6–25 ms, below a frame. Scroll is kept after a session closes, but switching tabs always lands at the top. |
| 4 | `store.save()` might need IndexedDB | **Ruled out** | 161 KB state saves in 0.8 ms (2 ms worst). Saves are already debounced. localStorage's 5 MB limit is ~30× away. |
| 5 | No screen-change animations | **Confirmed** | Tabs swap instantly. View Transitions are available (`document.startViewTransition` exists in Chromium; iOS 18+ Safari has it too). |
| 6 | `navigator.vibrate` does nothing on iOS | **Confirmed by code reading** | `haptic()` only calls `navigator.vibrate`. There is no iOS path. |
| 7 | `position: fixed; inset: 0`, dvh, safe areas | **Mostly fine** | See Layout above. Can't be fully verified off-device. |

## Ranked plan (biggest wins first)
1. **Cached-first service worker + "Update ready" toast** (Phase 1). Warm launch should go from ~3.9 s to ~0.1 s on slow 3G (offline timing shows the floor) and stop re-downloading 83 KB. The new deploy shows after one tap on the toast, or on the next launch anyway.
2. **modulepreload for every module** (Phase 1). −26% on the first ever load and on any launch after a deploy. Kept in sync by a check in `npm test` so a new module can't be forgotten.
3. **Accessibility fixes** (Phase 5). The tab-bar contrast alone clears 48 of 71 violations; also dialog names, `<main>`/`<h1>`, hiding the screen behind overlays, focus handling in sheets, and Dynamic Type.
4. **Screen transitions + press feedback** (Phase 2). View Transitions with a fallback, `:active` scale on every tappable element, drag-to-dismiss sheets, crossfades with Reduce Motion.
5. **Per-tab scroll restoration, `dvh`, large text** (Phase 3).
6. **Haptics** (Phase 4). The iOS 17.4+ `<input switch>` trick, one pulse type, with a setting to turn it off.
7. Background sync is already deferred and non-blocking, so nothing to do there beyond not running it before the first paint.

## On-device checks I can't do from here
Playwright Chromium is not an iPhone. These need a check on the phone: tap feel, transition smoothness, the haptic tick, the keyboard and Check button, Dynamic Type, and VoiceOver.

## After Phases 1–5 (same method, Chromium, Nov 21, 2026)
| | Baseline | After Phase 1 | After Phase 5 (final) |
|---|---|---|---|
| Slow 3G, **warm launch** → first screen | 3.89 s | **0.05 s** | **0.05 s** |
| Fast 3G, warm launch | 1.32 s | 0.05 s | 0.05 s |
| Bytes downloaded on a warm launch | 83 KB | **0 KB** | 0 KB |
| Slow 3G, cold (first ever) load | 3.94 s | 2.96 s | 3.20 s |
| Fast 3G, cold load | 1.34 s | 0.98 s | 1.06 s |
| Requests / bytes, cold | 21 / 87 KB | 22 / 85 KB | 23 / 90 KB |
| Offline launch | 0.08 s | 0.05 s | 0.05 s |
| New deploy | next launch, but every launch waits for the network | toast on launch 1–2, new version ~1.2 s after tapping | same |
| Tab switch / open lesson / next step | 6 / 26 / 14 ms | 6 / 19 / 14 ms | 5 / 28 / 14 ms (now animated) |
| Learn scroll after Learn → Home → Learn | 0 (lost) | 0 | **600 px (kept)** |
| axe-core violations | 71 | 71 | **0** |
| Sheet takes focus / closes on Escape | no / no | no / no | **yes / yes** |
| Text at 200% | sideways scroll + clipped tabs | same | **no problems** |
| Follows iPhone Text Size | no | no | yes (`-apple-system-body`) |
| Save 1,000 cards + 365 days | 0.8 ms | — | 1.3 ms (noise; still far below a frame) |

Notes, honestly:
- Cold load got ~0.25 s slower between Phase 1 and the end on slow 3G because two small modules (`pwa.js`, `haptics.js`) and ~5 KB of CSS were added. Warm launches, which is what you do every day, are unaffected.
- With the update toast, the new version shows when you tap it, or by itself the next time the app goes to the background with no lesson or game open.
- The haptic tick, transitions, Dynamic Type and VoiceOver were verified only by emulation here. They need a check on the iPhone.

## v1.3 (same method, Chromium, Nov 21, 2026)
| | v1.2 | v1.3 |
|---|---|---|
| Slow 3G, warm launch | 0.05 s | 0.06 s |
| Slow 3G, first-ever load | 3.20 s | **4.10 s** |
| Fast 3G, first-ever load | 1.06 s | 1.40 s |
| Requests / bytes, first load | 23 / 90 KB | 30 / 117 KB |

The first-ever load is ~0.9 s slower on slow 3G because v1.3 adds 7 small modules and the content of 7 new units. Everyday launches are served from the phone and are unchanged, and after a deploy the new files download in the background, so this cost is paid once per install. If it ever matters, the new modules could be merged into fewer files without a build step.
