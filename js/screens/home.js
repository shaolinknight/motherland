// Home screen.
import * as C from '../course.js';
import * as S from '../store.js';
import * as X from '../exercises.js';
import * as G from '../games.js';
import * as P from '../placement.js';
import * as T from '../stats.js';
import { sync } from '../sync.js';
import { $, $$, esc, toast, dayKey, pct } from '../util.js';
import { icon } from '../icons.js';
import { isPreview } from '../demo.js';
import { retestDue, daysSincePlacement } from '../focus.js';
import { wireSay, sayBtn, bar, plural, header, wireHeader, audioBanner, GAMES, exportBackup, backupDue, streakLine, startLesson } from './shared.js';

// ── HOME ────────────────────────────────────────────────────────────────────
export function home(root) {
  const st = S.get(), today = S.day(dayKey()), goal = st.settings.dailyGoal;
  const due = C.dueItems().length, nextU = P.continueUnit(), np = C.unitProgress(nextU.id);
  const hasTest = S.lang().placements.length > 0;
  const words = C.words();
  const seed = [...dayKey()].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const wod = words[seed % words.length];
  const h = new Date().getHours();
  const greet = h < 11 ? 'Chào buổi sáng!' : h < 18 ? 'Chào buổi chiều!' : 'Chào buổi tối!';
  const ring = Math.min(100, pct(today.xp, goal));
  const wk = T.periods('week');
  root.innerHTML = `${header('')}
  <div class="page">
    ${isPreview() ? '<a class="banner preview-banner" href="#/settings/preview">🧪 Preview with sample data. Your real app isn’t affected. Settings → Preview to reset it.</a>' : ''}
    ${audioBanner()}
    ${backupDue() ? `<section class="card backup-nudge" role="region" aria-label="Backup reminder">
      <p><b>💾 Back up your progress</b></p>
      <p class="muted small">Your progress is only on this phone. Save a backup file, or set up Google Sheet sync in Settings.</p>
      <div class="btn-row"><button class="btn primary small do-backup">Save backup</button><button class="btn ghost small later-backup">Later</button></div>
    </section>` : ''}
    <section class="hello card">
      <div>
        <h1 lang="vi">${greet}</h1>
        <p class="muted">${C.get().flag} ${C.get().native} · ${streakLine()}</p>
        ${wk.change != null ? `<p class="small ${wk.change >= 0 ? 'up' : 'down'}">${wk.change >= 0 ? '▲' : '▼'} ${Math.abs(wk.change)}% XP vs this point last week</p>` : ''}
      </div>
      <div class="ring" style="--p:${ring}" role="img" aria-label="Daily goal ${today.xp} of ${goal} XP"><span><b>${today.xp}</b><small>/${goal} XP</small></span></div>
    </section>

    ${P.unreviewedSkipped().length >= 5 ? `<a class="card link-card retest" href="#/diagnostics"><span aria-hidden="true" class="mode-ico">🔍</span>
      <div class="grow"><b>Re-check what the test skipped</b><p class="muted small">The placement test now uses stricter scoring. ${plural(P.unreviewedSkipped().length, 'word')} it marked as known haven’t been reviewed yet.</p></div>${icon('chevron')}</a>` : ''}
    ${retestDue() ? `<a class="card link-card retest" href="#/placement"><span aria-hidden="true" class="mode-ico">${icon('target')}</span>
      <div class="grow"><b>Time for a check-up</b><p class="muted small">Your last placement test was ${daysSincePlacement()} days ago. Retake it so lessons focus on what you need now.</p></div>${icon('chevron')}</a>` : ''}
    ${!hasTest ? `<a class="card cta-test" href="#/placement">
      <div aria-hidden="true" class="cta-ico">${icon('target')}</div>
      <div class="grow"><b>Find your level</b><p class="muted">A 4-minute placement test shows where you are and what to work on.</p></div>
      ${icon('chevron')}</a>` : ''}

    <section class="card continue">
      <p class="kicker">Continue learning</p>
      <div class="row">
        <div aria-hidden="true" class="unit-ico">${nextU.icon}</div>
        <div class="grow"><b>${esc(nextU.title)}</b><div class="muted" lang="vi">${esc(nextU.vi)}</div>${bar(np.pct)}</div>
      </div>
      <div class="btn-row">
        <button class="btn primary start-lesson">${np.learned ? 'Keep going' : 'Start lesson'}</button>
        <a class="btn ghost" href="#/unit/${nextU.id}">Open unit</a>
      </div>
    </section>

    <section class="card review-card">
      <p class="kicker">Review</p>
      <b>${due ? `${plural(due, 'card')} due` : 'All caught up ✨'}</b>
      <p class="muted">${due ? 'Reviewing right before you forget is what makes words stick.' : 'Keep going with endless review or a game.'}</p>
      <div class="btn-row">
        ${due ? `<button class="btn primary do-flash">Flashcards</button><button class="btn ghost do-quiz">Quiz review</button>`
              : `<button class="btn ghost do-endless">${icon('infinity')} Endless review</button>`}
      </div>
    </section>

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
}
