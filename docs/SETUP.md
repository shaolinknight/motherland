# Moving Motherland to Claude Code: one-time setup

About 15 minutes, all free.

## 1. Put the code on GitHub
1. On github.com (signed in as **shaolinknight**), create a new repository named **`motherland`**. Private is fine. Don't add a README; the zip already has one.
2. Unzip `motherland.zip`. Open the `motherland` folder so you can see `index.html`, `js/`, `CLAUDE.md` and so on.
3. In the new repo, click **uploading an existing file** and drag in **everything inside** the folder, not the folder itself. Commit to `main`.
   - The `.gitignore` file starts with a dot and may be hidden on your computer. It's fine if it gets skipped; Claude Code can add it.
   - Don't upload `node_modules` if it exists.

## 2. Connect Cloudflare Pages (same as Piggy)
1. In Cloudflare, go to **Workers & Pages → Create → Pages → Connect to Git** and pick `motherland`.
2. Set these build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: **`/`**
3. Deploy. Production is `https://motherland.pages.dev` (or the name Cloudflare gives).
4. In the project's settings, make sure **preview deployments** are on for all branches. Each branch Claude Code pushes gets its own test link: `https://<branch>.motherland.pages.dev`.
5. On your iPhone, open the production URL in Safari → **Share → Add to Home Screen**.

## 3. Open it in Claude Code
1. Go to **claude.ai/code**, connect GitHub if you haven't, and choose the **`motherland`** repo.
2. If the environment asks about network access, allow the npm registry. Also allow `cdn.playwright.dev` and `playwright.download.prss.microsoft.com` so it can download the WebKit test browser. If those stay blocked, it will test with Chromium instead and tell you.
3. Paste the prompt from **`docs/FIRST_PROMPT.md`** (everything below the line).
4. Claude Code reads **`CLAUDE.md`** automatically every session. That's where the rules live: $0, Saigon-first, never lose progress, don't break sync, test on iPhone sizes.

## 4. The everyday loop
1. Ask Claude Code for a change.
2. It works on a branch, runs `npm run check`, and pushes.
3. Cloudflare builds a preview link. Open it on your iPhone and try the checklist it gives you.
4. If it feels right, say "merge it". The change goes live on `main`, and installed copies update on their next open.

No more downloading zips or uploading files by hand.

## 5. Google Sheet sync
This is unchanged and still optional. Follow the steps at the top of `apps-script/Code.gs`.

If a future change edits `Code.gs`, update the deployed script so the URL stays the same:
1. Paste the new code into Apps Script.
2. Go to **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.

## What's in the repo for Claude Code
| File | Purpose |
|---|---|
| `CLAUDE.md` | Rules and workflow Claude Code follows every session |
| `docs/FIRST_PROMPT.md` | The first prompt: audit, then the speed/feel phases (same playbook as Piggy) |
| `docs/ARCHITECTURE.md` | Code map, content format, state shape, sync protocol, how to add a language |
| `docs/ROADMAP.md` | What's next: native feel, content, Korean/Japanese/Spanish, mixed decks, shared leaderboards |
| `package.json` | `npm run check` runs the content validator, logic tests and full click-through QA |
