// Play tab and leaderboards.
import * as S from '../store.js';
import * as G from '../games.js';
import * as T from '../stats.js';
import { audioAvailable } from '../speech.js';
import { $, $$, esc } from '../util.js';
import { icon } from '../icons.js';
import { L, plural, header, wireHeader, GAMES } from './shared.js';

// ── PLAY ────────────────────────────────────────────────────────────────────
export function play(root) {
  const g = S.lang().games;
  const audio = audioAvailable(L());
  root.innerHTML = `${header('Play', { sub: 'Games for when you have a few minutes' })}
  <div class="page">
    ${Object.entries(G.GAME_INFO).map(([k, info]) => `<button class="card game-card" data-game="${k}" ${k === 'listen' && !audio ? 'disabled' : ''}>
      <span aria-hidden="true" class="mode-ico">${icon(info.ico)}</span><div class="grow"><b>${info.name}</b><p class="muted">${k === 'listen' && !audio ? 'Needs a Vietnamese voice (see Settings).' : esc(info.rules)}</p>
      ${g[k]?.best != null ? `<span class="chip">Best: ${g[k].best}${info.unit} · ${plural(g[k].runs?.length || 1, 'play')}</span>` : ''}</div>${icon('chevron')}</button>`).join('')}
    <a class="card link-card" href="#/leaderboard"><span aria-hidden="true" class="mode-ico">🏆</span><div class="grow"><b>Leaderboards</b><p class="muted small">Your best weeks, months and game runs</p></div>${icon('chevron')}</a>
    <p class="muted small center pad">Games use words you’ve learned, plus beginner words until you have enough.</p>
  </div>`;
  wireHeader(root);
  $$('[data-game]', root).forEach(b => b.onclick = () => GAMES[b.dataset.game]());
}

// ── LEADERBOARDS ────────────────────────────────────────────────────────────
export function leaderboard(root, tab = 'week') {
  const medal = r => (['🥇', '🥈', '🥉'][r - 1] || `#${r}`);
  const board = kind => {
    const { ranked, cur, prev, change, prevSoFar } = T.periods(kind);
    const name = kind === 'week' ? 'week' : 'month';
    return `
      <section class="card cmp">
        <div class="row"><div class="grow"><p class="kicker">This ${name}</p><b class="big-num">${cur.xp} XP</b>
          <p class="muted small">Rank #${cur.rank} of ${ranked.length} · ${cur.words} new items · ${cur.acc}% accuracy · ${Math.round(cur.ms / 60000)} min</p></div>
          ${change != null ? `<span class="chip ${change >= 0 ? 'ok' : 'warn'}">${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}%</span>` : ''}</div>
        ${prev ? `<p class="small muted">Last ${name} at this point: ${prevSoFar} XP · full ${name}: ${prev.xp} XP</p>` : ''}
      </section>
      <ol class="board card">${ranked.slice(0, 10).map(p => `
        <li class="${p.current ? 'me' : ''}"><span class="medal">${medal(p.rank)}</span>
          <div class="grow"><b>${esc(p.label)}</b><div class="muted small">${p.words} new · ${p.acc}% · ${p.days} active day${p.days === 1 ? '' : 's'}</div></div>
          <b class="xp">${p.xp}</b></li>`).join('')}</ol>`;
  };
  const games = () => Object.entries(G.GAME_INFO).map(([k, info]) => {
    const runs = T.gameBoard(k, 5);
    return `<section class="card"><p class="kicker">${esc(info.name)}</p>
      ${runs.length ? `<ol class="board flat">${runs.map((r, i) => `<li><span class="medal">${medal(i + 1)}</span><span class="grow muted small">${new Date(r.at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span><b>${r.score}${info.unit}</b></li>`).join('')}</ol>`
        : '<p class="muted small">No runs yet.</p>'}</section>`;
  }).join('');
  const recs = () => {
    const r = T.records();
    const row = (label, x) => `<li><span class="grow">${label}</span>${x ? `<div class="rec-val"><b>${esc(x.value)}</b><small class="muted">${esc(x.when)}</small></div>` : '<span class="muted">—</span>'}</li>`;
    return `<ul class="card records">${row('🔥 Longest streak', r.streak)}${row('⚡ Best day', r.bestDay)}${row('📅 Best week', r.bestWeek)}${row('🌱 Most new items in a day', r.mostWords)}${row('🎯 Most accurate week', r.accuracy)}</ul>`;
  };
  const tabs = [['week', 'Weeks'], ['month', 'Months'], ['games', 'Games'], ['records', 'Records']];
  root.innerHTML = `${header('Leaderboards', { back: '#/progress', sub: 'You vs. your past self' })}
  <div class="page">
    <nav class="seg">${tabs.map(([k, n]) => `<button class="${k === tab ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</nav>
    <div class="panel stack">${tab === 'week' ? board('week') : tab === 'month' ? board('month') : tab === 'games' ? games() : recs()}</div>
  </div>`;
  wireHeader(root);
  $$('.seg button', root).forEach(b => b.onclick = () => { history.replaceState(null, '', `#/leaderboard/${b.dataset.tab}`); leaderboard(root, b.dataset.tab); });
}
