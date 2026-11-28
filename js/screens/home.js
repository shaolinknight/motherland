// Home screen: greeting + daily goal, one clear "Next up", a short "Needs attention" list, then extras.
import * as C from '../course.js';
import * as S from '../store.js';
import * as X from '../exercises.js';
import * as G from '../games.js';
import * as P from '../placement.js';
import * as T from '../stats.js';
import { capLeft } from '../planner.js';
import { sync, isSyncing } from '../sync.js';
import { $, $$, esc, toast, dayKey, pct, timeAgo } from '../util.js';
import { icon } from '../icons.js';
import { isPreview } from '../demo.js';
import { retestDue, daysSincePlacement } from '../focus.js';
import { wireSay, sayBtn, bar, plural, header, wireHeader, audioBanner, GAMES, exportBackup, backupDue, streakLine, startLesson } from './shared.js';

// ── HOME ────────────────────────────────────────────────────────────────────
export function home(root) {
  const st = S.get(), today = S.day(dayKey()), goal = st.settings.dailyGoal;
  const dueAll = C.dueItems().length, due = Math.min(dueAll, capLeft());
  const nextU = P.continueUnit(), np = C.unitProgress(nextU.id);
  const words = C.words();
  const seed = [...dayKey()].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const wod = words[seed % words.length];
  const h = new Date().getHours();
  const greet = h < 11 ? 'Chào buổi sáng!' : h < 18 ? 'Chào buổi chiều!' : 'Chào buổi tối!';
  const ring = Math.min(100, pct(today.xp, goal));
  const wk = T.periods('week');
  const lessonLabel = np.learned ? 'Keep going' : 'Start lesson';
  root.innerHTML = `${header('')}
  <div class="page">
    ${isPreview() ? '<a class="banner preview-banner" href="#/settings/preview">🧪 Preview with sample data. Your real app isn’t affected. Settings → Preview to reset it.</a>' : ''}
    ${audioBanner()}
    <section class="hello card">
      <div>
        <h1 lang="vi">${greet}</h1>
        <p class="muted">${C.get().flag} ${C.get().native} · ${streakLine()}</p>
        ${wk.change > 0 ? `<p class="small up">▲ ${wk.change}% XP vs this point last week</p>` : ''}
        ${st.settings.syncUrl ? `<p class="sync-line small" role="status">${syncStatus()}</p>` : ''}
      </div>
      <div class="ring" style="--p:${ring}" role="img" aria-label="Daily goal ${today.xp} of ${goal} XP"><span><b>${today.xp}</b><small>/${goal} XP</small></span></div>
    </section>

    ${due ? `<section class="card next-up">
      <p class="kicker">Next up</p>
      <div class="row"><span aria-hidden="true" class="mode-ico">${icon('cards')}</span>
        <div class="grow"><b>Review ${plural(due, 'card')}</b><p class="muted small">About ${Math.max(1, Math.round(due * 8 / 60))} min. Right before you forget is when it sticks.</p></div></div>
      <div class="btn-row"><button class="btn primary do-flash">Start review</button><button class="btn ghost do-quiz">Quiz instead</button></div>
      <button class="next-alt start-lesson"><span aria-hidden="true">${nextU.icon}</span><span class="grow">Then: ${esc(nextU.title)}</span><span class="muted small">${np.pct}%</span>${icon('chevron')}</button>
    </section>` : `<section class="card next-up">
      <p class="kicker">Next up</p>
      <div class="row">
        <div aria-hidden="true" class="unit-ico">${nextU.icon}</div>
        <div class="grow"><b>${esc(nextU.title)}</b><div class="muted" lang="vi">${esc(nextU.vi)}</div>${bar(np.pct)}</div>
      </div>
      <div class="btn-row"><button class="btn primary start-lesson">${lessonLabel}</button><a class="btn ghost" href="#/unit/${nextU.id}">Open unit</a></div>
      ${C.seenItems().length ? `<button class="next-alt do-endless"><span aria-hidden="true">✨</span><span class="grow">${dueAll ? 'Today’s review limit reached.' : 'All caught up on reviews.'} Endless review</span>${icon('chevron')}</button>` : ''}
    </section>`}

    ${attention()}

    <section class="card wod">
      <p class="kicker">Word of the day</p>
      <div class="row"><div class="grow"><div class="vi big" lang="vi">${esc(wod.vi)}</div><div class="muted">${esc(wod.en)}</div></div>${sayBtn(wod.vi)}</div>
    </section>

    <p class="kicker pad">Quick play</p>
    <section class="quick">
      ${Object.entries(G.GAME_INFO).map(([k, g]) => `<button class="q-tile" data-game="${k}"><span aria-hidden="true">${g.emoji}</span>${esc(g.name.split(' ')[0])}</button>`).join('')}
    </section>
  </div>`;
  wireHeader(root); wireSay(root);
  $('.start-lesson', root).onclick = () => startLesson(nextU.id);
  $('.do-backup', root)?.addEventListener('click', () => { exportBackup(); toast('Backup saved 💾'); home(root); });
  $('.later-backup', root)?.addEventListener('click', () => { S.settings().backupSnooze = Date.now(); S.save({ touch: false }); home(root); });
  $('.do-flash', root)?.addEventListener('click', () => X.run({ steps: X.flashSteps(), activity: 'flashcards' }));
  $('.do-quiz', root)?.addEventListener('click', () => X.run({ steps: X.reviewSteps(), activity: 'review' }));
  $('.do-endless', root)?.addEventListener('click', () => X.run({ endless: true, activity: 'endless', steps: [] }));
  $$('[data-game]', root).forEach(b => b.onclick = () => GAMES[b.dataset.game]());
  drawSyncLine();
}

// Everything that wants a moment of your attention, as one short list instead of a stack of cards.
function attention() {
  const rows = [];
  const skipped = P.unreviewedSkipped().length;
  if (!S.lang().placements.length) rows.push(`<li><a class="att-row cta-test" href="#/placement"><span aria-hidden="true" class="att-ico">${icon('target')}</span>
    <span class="grow"><b>Find your level</b><small>A 4-minute test, so lessons start in the right place</small></span>${icon('chevron')}</a></li>`);
  if (backupDue()) rows.push(`<li><div class="att-row backup-nudge" role="group" aria-label="Backup reminder"><span aria-hidden="true" class="att-ico">💾</span>
    <span class="grow"><b>Back up your progress</b><small>It’s only on this phone. Save a file, or set up Sheet sync in Settings.</small>
      <span class="att-actions"><button class="btn primary small do-backup">Save backup</button><button class="btn ghost small later-backup">Later</button></span></span></div></li>`);
  if (skipped >= 5) rows.push(`<li><a class="att-row retest" href="#/diagnostics"><span aria-hidden="true" class="att-ico">🔍</span>
    <span class="grow"><b>Re-check what the test skipped</b><small>${plural(skipped, 'word')} marked as known haven’t been reviewed yet</small></span>${icon('chevron')}</a></li>`);
  if (retestDue()) rows.push(`<li><a class="att-row retest" href="#/placement"><span aria-hidden="true" class="att-ico">${icon('target')}</span>
    <span class="grow"><b>Time for a check-up</b><small>Last placement test was ${daysSincePlacement()} days ago</small></span>${icon('chevron')}</a></li>`);
  if (!rows.length) return '';
  return `<section class="card attention" aria-labelledby="att-h"><p class="kicker" id="att-h">Needs attention</p><ul class="att-list">${rows.join('')}</ul></section>`;
}

// "Synced 2 min ago" / "Syncing…" / "Offline" / "Sync didn't work · Retry". Only shown once sync is set up.
function syncStatus() {
  const st = S.settings();
  if (isSyncing()) return '🔄 Syncing…';
  if (!navigator.onLine) return '📴 Offline. Saved on this phone; syncs when you’re back online.';
  if (st.syncError) return `⚠️ Sync didn’t work <button class="link-btn sync-retry">Retry</button> <a class="link-btn" href="#/settings/sync">Details</a>`;
  return `☁️ <a class="link-btn" href="#/settings/sync">Synced ${timeAgo(st.lastSync)}</a>`;
}

// Draw the sync line on screen (if Home is showing) with a working Retry button.
function drawSyncLine() {
  const line = document.querySelector('.sync-line');
  if (!line) return;
  line.innerHTML = syncStatus();
  $('.sync-retry', line)?.addEventListener('click', async () => {
    try { await sync({ quiet: false }); toast('Synced ✅'); } catch (e) { toast(`Sync failed: ${e.message}`, 3500); }
  });
}
// One set of listeners for the app's lifetime: redraw on sync start/finish and connection changes.
['motherland:sync-state', 'online', 'offline'].forEach(e => window.addEventListener(e, drawSyncLine));
