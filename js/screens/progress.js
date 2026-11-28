// Progress dashboard, placement test, diagnostics.
import * as C from '../course.js';
import * as S from '../store.js';
import * as P from '../placement.js';
import * as T from '../stats.js';
import { audioAvailable } from '../speech.js';
import { $, esc, toast, dayKey, weekKeys, pct, timeAgo } from '../util.js';
import { icon } from '../icons.js';
import { confirmSheet, undoToast } from '../ui.js';
import { focusSkills, RETEST_AFTER_DAYS } from '../focus.js';
import { L, say, go, wireSay, bar, plural, header, wireHeader } from './shared.js';

// ── PROGRESS / DASHBOARD ────────────────────────────────────────────────────
function growthChart(series) {
  const W = 320, H = 110, max = Math.max(5, ...series.map(s => s.n));
  const x = i => Math.round((i / (series.length - 1)) * (W - 8)) + 4, y = n => H - 6 - Math.round((n / max) * (H - 20));
  const pts = series.map((s, i) => `${x(i)},${y(s.n)}`).join(' ');
  return `<svg class="growth" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Items learned over the last 30 days: ${series[series.length - 1].n}">
    <polygon points="4,${H - 6} ${pts} ${W - 4},${H - 6}" class="area"/><polyline points="${pts}" class="line"/>
    <circle cx="${x(series.length - 1)}" cy="${y(series[series.length - 1].n)}" r="4" class="dot-end"/></svg>`;
}

export function progress(root) {
  const st = S.get(), wk = weekKeys(), goal = st.settings.dailyGoal;
  const days = wk.map(k => st.days[k] || { xp: 0, ms: 0, c: 0, t: 0, words: 0, skills: {} });
  const maxXp = Math.max(goal, ...days.map(d => d.xp));
  const sum = f => days.reduce((a, d) => a + f(d), 0);
  const wkMin = Math.round(sum(d => d.ms) / 60000), wkXp = sum(d => d.xp), wkWords = sum(d => d.words || 0);
  const wkAcc = pct(sum(d => d.c), sum(d => d.t));
  const today = dayKey();
  const skillKeys = ['vocab', 'reading', 'grammar', 'listening', 'tones', 'speaking'];
  const life = S.lang().skills;
  const weekSkill = k => ({ c: sum(d => d.skills?.[k]?.c || 0), t: sum(d => d.skills?.[k]?.t || 0) });
  const tests = S.lang().placements;
  const last = tests[tests.length - 1];
  const cards = C.cards();
  const weak = C.weakItems(6);
  const rec = last ? P.recommendation(last) : null;
  const growth = T.growth(30), heat = T.heatmap(12);
  const gained = growth[growth.length - 1].n - growth[0].n;
  const seenV = C.seenItems().filter(i => i.kind !== 'grammar' && !i.mine).length;   // of the course's total
  const gDone = C.grammarItems().filter(i => cards[i.id]).length;
  const lessons = T.recentLessons();
  const wkCmp = T.periods('week');
  const lvl = xp => (xp === 0 ? 0 : xp < goal / 2 ? 1 : xp < goal ? 2 : 3);

  root.innerHTML = `${header('Progress', { sub: 'Your learning, week by week' })}
  <div class="page">
    <section class="card">
      <div class="row"><p class="kicker grow">This week</p>${wkCmp.change != null ? `<span class="chip ${wkCmp.change >= 0 ? 'ok' : 'warn'}">${wkCmp.change >= 0 ? '▲' : '▼'} ${Math.abs(wkCmp.change)}% vs last wk</span>` : ''}<span class="chip">🔥 ${plural(S.streak(), 'day')}</span></div>
      <div class="week" role="img" aria-label="XP per day this week">
        ${days.map((d, i) => `<div class="wk-col ${wk[i] === today ? 'today' : ''}">
          <div class="wk-bar"><div style="height:${Math.round((d.xp / maxXp) * 100)}%" class="${d.xp >= goal ? 'hit' : ''}"></div><span class="goal-line" style="bottom:${Math.round((goal / maxXp) * 100)}%"></span></div>
          <small>${'MTWTFSS'[i]}</small></div>`).join('')}
      </div>
      <div class="stats4">
        <div class="stat"><b>${wkXp}</b><span>XP</span></div>
        <div class="stat"><b>${wkMin}</b><span>minutes</span></div>
        <div class="stat"><b>${wkWords}</b><span>new items</span></div>
        <div class="stat"><b>${wkAcc}%</b><span>accuracy</span></div>
      </div>
    </section>

    <section class="link-row">
      <a class="card link-card" href="#/leaderboard"><span aria-hidden="true" class="mode-ico">🏆</span><div class="grow"><b>Leaderboards</b><p class="muted small">Your best runs</p></div></a>
      <a class="card link-card" href="#/words"><span aria-hidden="true" class="mode-ico">${icon('cards')}</span><div class="grow"><b>Word bank</b><p class="muted small">${seenV} learned</p></div></a>
    </section>

    <section class="card">
      <div class="row"><p class="kicker grow">Words & phrases learned</p><span class="chip ok">+${gained} in 30 days</span></div>
      <div class="row big-row"><b class="big-num">${seenV}</b><span class="muted small">of ${C.vocabItems().length} · ${C.masteredCount()} mastered · ${gDone}/${C.grammarItems().length} grammar points</span></div>
      ${growthChart(growth)}
      <div class="row small muted"><span class="grow">${new Date(`${growth[0].key}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span><span>Today</span></div>
    </section>

    <section class="card">
      <p class="kicker">Last 12 weeks</p>
      <div class="heat" role="img" aria-label="Study activity heatmap">${heat.map(col => `<div class="heat-col">${col.map(c => `<span class="h${c.future ? ' fut' : ` l${lvl(c.xp)}`}" title="${c.k}: ${c.xp} XP"></span>`).join('')}</div>`).join('')}</div>
      <div class="heat-legend small muted">Less <span class="h l0"></span><span class="h l1"></span><span class="h l2"></span><span class="h l3"></span> More (goal hit)</div>
    </section>

    <section class="card">
      <p class="kicker">Skills</p>
      ${skillKeys.map(k => { const w = weekSkill(k), l = life[k] || { c: 0, t: 0 }; return `
        <div class="skill">
          <div class="row"><span class="grow">${P.skillName(k)}</span><small class="muted">${l.t ? `${pct(l.c, l.t)}% all-time` : 'no data yet'}${w.t ? ` · ${pct(w.c, w.t)}% this week` : ''}</small></div>
          ${bar(l.t ? pct(l.c, l.t) : 0, l.t && pct(l.c, l.t) < 60 ? 'low' : '')}
        </div>`; }).join('')}
    </section>

    <section class="card diag">
      <p class="kicker">Diagnostics</p>
      ${last ? `
        <div class="row"><div class="grow"><b class="lvl-label">${esc(C.get().levels[P.effectiveLevel(last)])}</b><p class="muted small">Placement ${new Date(last.at).toLocaleDateString()} · ${last.score}% correct</p></div><span class="chip lvl">Level ${P.effectiveLevel(last)}/3</span></div>
        ${last.weak.length ? `<p class="small"><b>Work on:</b> ${last.weak.map(esc).join(', ')}</p>` : '<p class="small">No weak spots found in the test. 🎉</p>'}
        ${rec ? `<p class="small"><b>Suggested next:</b> <a href="#/unit/${rec.id}">${rec.icon} ${esc(rec.title)}</a></p>` : ''}
        <div class="btn-row"><a class="btn ghost" href="#/diagnostics">Full results</a><a class="btn ghost" href="#/placement">Retake test</a></div>
        ${tests.length > 1 ? `<p class="muted small">History: ${tests.slice(-5).map(t => `${new Date(t.at).toLocaleDateString([], { month: 'short', day: 'numeric' })} · L${t.level} (${t.score}%)`).join(' → ')}</p>` : ''}
      ` : `<p>Take the placement test to see your level, your strongest and weakest skills, and where to start.</p><a class="btn primary" href="#/placement">Take placement test</a>`}
    </section>

    ${lessons.length ? `<section class="card"><p class="kicker">Recent lessons</p><ul class="mini-list">${lessons.map(l => `<li><a href="#/unit/${l.unit.id}">${l.unit.icon} ${esc(l.unit.title)}</a><span class="grow"></span>${l.done ? '<span class="chip ok">complete</span>' : ''}<small class="muted">${timeAgo(l.at)}</small></li>`).join('')}</ul></section>` : ''}

    ${weak.length ? `<section class="card"><p class="kicker">What you miss most</p>
      <ul class="mini-list">${weak.map(i => `<li data-say="${esc(i.vi)}"><span class="vi" lang="vi">${esc(i.vi)}</span><span class="muted grow ellip">${esc(i.en)}</span>${cards[i.id].leech ? '<span class="chip leech">🐌 keeps slipping</span>' : ''}<span class="chip warn">×${cards[i.id].lapses}</span></li>`).join('')}</ul></section>` : ''}

    <section class="card">
      <p class="kicker">Units</p>
      <ul class="mini-list">${C.get().units.map(u => { const p = C.unitProgress(u.id); return `<li><a href="#/unit/${u.id}">${u.icon} ${esc(u.title)}</a><span class="grow">${bar(p.pct)}</span><small class="muted">${p.pct}%</small></li>`; }).join('')}</ul>
    </section>
  </div>`;
  wireHeader(root); wireSay(root);
}

// ── PLACEMENT ───────────────────────────────────────────────────────────────
export function placement(root) {
  root.innerHTML = `${header('Placement test', { back: '#/progress' })}
  <div class="page">
    <section class="card">
      <div aria-hidden="true" class="big-emoji">🎯</div>
      <h2>Find your level</h2>
      <p>About 25 quick questions across three levels: vocabulary, reading, grammar, tones${audioAvailable(L()) ? ' and listening' : ''}.</p>
      <ul class="checklist">
        <li>Takes about 4 minutes</li>
        <li>No feedback during the test, so you’re not influenced</li>
        <li>Tap <b>I don’t know</b> instead of guessing. It makes your results more accurate.</li>
      </ul>
      <button class="btn primary wide start">Start test</button>
    </section>
  </div>`;
  wireHeader(root);
  $('.start', root).onclick = () => P.start(r => { if (r) { history.replaceState(null, '', '#/progress'); go('#/diagnostics'); } else toast('Test cancelled'); });
}

export function diagnostics(root) {
  const tests = S.lang().placements, r = tests[tests.length - 1];
  if (!r) { go('#/placement'); return; }
  const rec = P.recommendation(r);
  const eff = P.effectiveLevel(r), rescored = eff < r.level;   // tests taken before v1.4 were too generous
  const label = C.get().levels[eff];
  const skipped = P.unreviewedSkipped();
  const rows = (m, name, thr) => Object.entries(m).map(([k, x]) => `<div class="skill"><div class="row"><span class="grow">${esc(name(k))}</span><small>${x.c}/${x.t} · ${pct(x.c, x.t)}%</small></div>${bar(pct(x.c, x.t), pct(x.c, x.t) < thr ? 'low' : '')}</div>`).join('');
  root.innerHTML = `${header('Your results', { back: '#/progress' })}
  <div class="page">
    <section class="card result-hero">
      <p class="kicker">Your level</p>
      <h1>${esc(label)}</h1>
      <p class="muted">${r.c} of ${r.t} correct (${r.score}%)</p>
      ${rescored ? `<p class="small">Re-scored with the stricter rules (80% per level). The old test said ${esc(r.label)}.</p>` : ''}
      <div class="lvl-steps">${C.get().levels.map((n, i) => `<span class="${i <= eff ? 'on' : ''}">${esc(n)}</span>`).join('')}</div>
    </section>
    <section class="card"><p class="kicker">What this means</p>
      <p><b>You can probably:</b> ${esc(P.CAN_DO[eff].can)}</p>
      <p><b>Next you’ll learn:</b> ${esc(P.CAN_DO[eff].next)}</p>
      ${r.t < 30 ? '<p class="small muted">The test stopped early once a level was clearly too hard, so it didn’t ask about higher ones.</p>' : ''}
    </section>
    ${P.mightKnow(r).length ? `<section class="card"><p class="kicker">Units you might already know</p>
      <p class="small muted">Not marked as known. If one looks easy, open it and tap Test out to prove it.</p>
      <ul class="mini-list">${P.mightKnow(r).map(u => `<li><a href="#/unit/${u.id}">${u.icon} ${esc(u.title)}</a><span class="grow"></span><span class="chip lvl">L${u.level}</span></li>`).join('')}</ul>
    </section>` : ''}
    ${skipped.length ? `<section class="card recheck"><p class="kicker">Re-check what the test skipped</p>
      <p>${plural(skipped.length, 'word')} ${skipped.length === 1 ? 'was' : 'were'} marked as known by the placement test, and you haven’t reviewed ${skipped.length === 1 ? 'it' : 'any of them'} since.</p>
      <p class="small muted">Putting them back reopens their units, so lessons teach them properly. Words you’ve already reviewed stay as they are.</p>
      <div class="btn-row"><button class="btn primary unskip">Put them back into lessons</button><button class="btn ghost keepskips">I know these</button></div>
    </section>` : ''}
    <section class="card"><p class="kicker">What to work on</p>
      ${r.level === 0 && r.score < 40 ? '<p>You’re early on, which is the perfect place to start. Work through the units in order and retake the test in a few weeks to see the change.</p>' : ''}
      ${r.weak.length ? `<ul class="checklist warnlist">${r.weak.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : '<p>Nothing stood out as weak. Keep moving forward!</p>'}
      ${rec ? `<p>Start with <b>${rec.icon} ${esc(rec.title)}</b>. Home’s “Continue learning” now points there.</p><a class="btn primary" href="#/unit/${rec.id}">Go to ${esc(rec.title)}</a>` : ''}
    </section>
    <section class="card"><p class="kicker">How this shapes your lessons</p>
      <ul class="checklist">
        ${r.seeded ? `<li>${plural(r.seeded, 'word')} you clearly know ${r.seeded === 1 ? 'was' : 'were'} added to your reviews, so you confirm ${r.seeded === 1 ? 'it' : 'them'} instead of relearning.</li>` : ''}
        ${focusSkills(r).length ? `<li>Lessons now give you more practice in <b>${focusSkills(r).map(P.skillName).join(', ')}</b>.</li>` : '<li>Your skills are even, so lessons keep a balanced mix.</li>'}
        <li>Retake the test in about ${Math.round(RETEST_AFTER_DAYS / 7)} weeks; Home will remind you. Your newest result always counts.</li>
      </ul>
    </section>
    <section class="card"><p class="kicker">Already know a unit?</p>
      <p class="small">Open it and tap <b>Test out</b>: a short quiz where you produce the Vietnamese yourself. Score 85% and the whole unit moves to your reviews. Units are never skipped just from this test.</p></section>
    <section class="card"><p class="kicker">By level</p>${rows(r.levels, k => `Level ${k} questions`, 80)}</section>
    <section class="card"><p class="kicker">By skill</p>${rows(r.skills, P.skillName, 60)}</section>
    <section class="card"><p class="kicker">By topic</p>${rows(r.sections, k => k, 60)}</section>
    <section class="card"><p class="kicker">Start over</p>
      <p class="small">Reset removes every placement result and the words it marked as known, so lessons teach them properly. Words you’ve reviewed successfully 3+ times and units you tested out of stay.</p>
      <button class="btn danger wide reset-placement">Reset placement</button>
    </section>
  </div>`;
  wireHeader(root);
  $('.reset-placement', root).onclick = async () => {
    const { remove, keep } = P.resetPreview();
    const msg = `Removes ${plural(tests.length, 'placement result')} and ${plural(remove.length, 'word')} ${remove.length === 1 ? 'it' : 'they'} marked as known.${keep.length ? ` ${plural(keep.length, 'word')} you’ve reviewed 3+ times stay.` : ''}`;
    if (!(await confirmSheet('Reset placement?', msg, 'Reset', 'danger'))) return;
    const res = P.resetPlacement();
    toast(`Placement reset: ${plural(res.removed, 'word')} back in lessons`, 3500);
    go('#/progress');
  };
  $('.unskip', root)?.addEventListener('click', async () => {
    if (!(await confirmSheet('Put them back into lessons?', `${plural(skipped.length, 'word')} you never reviewed will be taught again in their units.`, 'Put back'))) return;
    toast(`${plural(P.unskip(), 'word')} back in lessons`); diagnostics(root);
  });
  $('.keepskips', root)?.addEventListener('click', () => {
    // Mark them as reviewed-on-trust so they stop showing here; FSRS still checks them on schedule.
    const cards = C.cards(), now = Date.now(), before = skipped.map(id => [id, cards[id].placed]);
    skipped.forEach(id => { Object.assign(cards[id], { placed: 'kept', edited: now }); }); S.save(); diagnostics(root);
    undoToast(`${plural(skipped.length, 'word')} kept as known`, () => before.forEach(([id, placed]) => { if (cards[id]) Object.assign(cards[id], { placed, edited: Date.now() }); }));
  });
}
