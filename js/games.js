// Game modes for passing the time: Match, Speed Round, Tone Hunter, Listen Up.
// Flow: intro card (rules + best) → 3-2-1 → play → results with missed words.
import * as C from './course.js';
import * as S from './store.js';
import { mcq, tone, clash } from './exercises.js';
import { speak, audioAvailable, stop as stopAudio } from './speech.js';
import { $, $$, esc, shuffle, pick, toast } from './util.js';
import { tick } from './haptics.js';
import { icon } from './icons.js';
import { dismissLayer, trapFocus } from './ui.js';
import { TONE_NAMES, toneOf, stripTones } from './vitext.js';

const L = () => C.get().speechLang;

export const GAME_INFO = {
  match: { ico: 'grid', name: 'Match pairs', rules: 'Tap a Vietnamese word, then its meaning. Clear all 6 pairs as fast as you can.', unit: 's', lower: true },
  speed: { ico: 'bolt', name: 'Speed round', rules: '60 seconds. Pick the meaning of each word. Streaks of 3+ earn bonus points.', unit: '' },
  tones: { ico: 'music', name: 'Tone hunter', rules: '45 seconds. Pick the correct tone mark for the missing word.', unit: '' },
  listen: { ico: 'headphones', name: 'Listen up', rules: '10 words by ear. Choose what you heard. Tap the speaker to replay.', unit: '/10' },
};

// Words you've met; falls back to beginner words so games work on day one.
function pool(min = 10) {
  const seen = C.seenItems().filter(i => i.kind === 'word');
  if (seen.length >= min) return seen;
  const starter = C.words().filter(i => i.level === 1 && i.unit !== 'u00' && !seen.includes(i));
  return [...seen, ...starter];
}
// n words with no two meanings that could be confused
function distinct(list, n) {
  const out = [];
  for (const w of shuffle(list)) { if (!out.some(o => clash(o, w))) out.push(w); if (out.length === n) break; }
  return out;
}

function overlay(key) {
  const info = GAME_INFO[key];
  const root = document.createElement('div');
  root.className = 'session game';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', info.name);
  root.innerHTML = `
    <header class="s-head">
      <button class="icon-btn s-close" aria-label="Close">${icon('x')}</button>
      <div class="g-title">${esc(info.name)}</div>
      <div class="g-hud" aria-live="polite"></div>
    </header>
    <main class="s-body" tabindex="-1"></main>
    <footer class="s-foot"></footer>`;
  document.body.appendChild(root);
  document.body.classList.add('no-scroll');
  const release = trapFocus(root, $('.s-body', root), () => g.close());
  const g = {
    key, info, root, body: $('.s-body', root), foot: $('.s-foot', root), hud: $('.g-hud', root), timers: [], paused: false,
    clearTimers() { g.timers.forEach(t => { clearInterval(t); clearTimeout(t); }); g.timers = []; },
    close() {
      if (g.closed) return; g.closed = true;
      g.clearTimers(); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('hashchange', g.close);
      stopAudio(); release(); dismissLayer(root); document.body.classList.remove('no-scroll'); window.dispatchEvent(new Event('motherland:refresh'));
    },
  };
  window.addEventListener('hashchange', g.close);   // the screen changed underneath: don't strand the game on top
  const onVis = () => { g.paused = document.visibilityState === 'hidden'; };
  document.addEventListener('visibilitychange', onVis);
  $('.s-close', root).onclick = () => g.close();
  return g;
}

function best(key) { return S.lang().games[key]?.best; }

// Your last five runs as small bars: something to beat, in the space under the rules.
function recentRuns(g) {
  const runs = (S.lang().games[g.key]?.runs || []).slice(-5);
  if (runs.length < 2) return '';
  const max = Math.max(...runs.map(r => r.score), 1);
  return `<div class="recent-runs"><p class="kicker">Recent runs</p>
    <div class="rr-bars" role="img" aria-label="Last ${runs.length} scores: ${runs.map(r => `${r.score}${g.info.unit}`).join(', ')}">${runs.map((r, i) =>
      `<span class="${i === runs.length - 1 ? 'last' : ''}"><b>${r.score}</b><i style="height:${Math.max(8, Math.round(r.score / max * 100))}%"></i></span>`).join('')}</div></div>`;
}

function intro(g, start) {
  const b = best(g.key);
  g.hud.textContent = '';
  g.body.innerHTML = `<div class="finish game-intro">
      <div aria-hidden="true" class="finish-star">${icon(g.info.ico)}</div>
      <h2>${esc(g.info.name)}</h2>
      <p class="muted">${esc(g.info.rules)}</p>
      ${b != null ? `<span class="chip">Your best: ${b}${g.info.unit}</span>` : '<span class="chip">No score yet</span>'}
      ${recentRuns(g)}
    </div>`;
  g.foot.innerHTML = `<button class="btn primary go">Start</button>`;
  $('.go', g.foot).onclick = () => countdown(g, start);
}

function countdown(g, start) {
  g.foot.innerHTML = '';
  let n = 3;
  g.body.innerHTML = `<div class="countdown" aria-live="assertive">${n}</div>`;
  const t = setInterval(() => {
    n--;
    if (n > 0) { $('.countdown', g.body).textContent = n; return; }
    clearInterval(t); start();
  }, 650);
  g.timers.push(t);
}

function results(g, { score, label, missed = [], xp = 0 }) {
  const games = S.lang().games;
  const rec = (games[g.key] ||= { runs: [] });
  rec.runs ||= [];
  rec.runs.push({ score, at: Date.now() });
  if (rec.runs.length > 100) rec.runs = rec.runs.slice(-100);
  const prev = rec.best;
  const isBest = prev == null || (g.info.lower ? score < prev : score > prev);
  if (isBest) { rec.best = score; rec.at = Date.now(); }
  S.save();
  g.clearTimers();
  g.hud.textContent = '';
  const uniq = [...new Map(missed.map(m => [m.id, m])).values()].slice(0, 8);
  g.body.innerHTML = `<div class="finish">
      <div aria-hidden="true" class="finish-star">${icon(isBest ? 'trophy' : 'target')}</div>
      <h2>${esc(label)}</h2>
      <div class="stat-row">
        <div class="stat"><b>${score}${g.info.unit}</b><span>${isBest ? (prev == null ? 'first score!' : 'new best!') : `best ${prev}${g.info.unit}`}</span></div>
        <div class="stat"><b>+${xp}</b><span>XP</span></div>
      </div>
      ${uniq.length ? `<div class="missed card"><p class="kicker">Words to review</p>${uniq.map(i => `<div class="missed-row" data-say="${esc(i.vi)}"><b lang="vi">${esc(i.vi)}</b><span class="muted">${esc(i.en)}</span></div>`).join('')}</div>` : ''}
    </div>`;
  if (audioAvailable(L())) $$('[data-say]', g.body).forEach(r => r.onclick = () => speak(r.dataset.say, L()));
  g.foot.innerHTML = `<button class="btn ghost quit">Done</button><button class="btn primary again">Play again</button>`;
  $('.quit', g.foot).onclick = () => g.close();
  return $('.again', g.foot);
}

function award(key, t0, xp, c = 0, t = 0) {
  S.addXP(xp); S.addTime(Date.now() - t0);
  S.logSession(`game:${key}`, { ms: Date.now() - t0, xp, c, t });
  S.save();
}

// ── Match pairs ─────────────────────────────────────────────────────────────
export function match() {
  const g = overlay('match');
  const play = () => {
    const words = distinct(pool(), 6);
    const left = shuffle(words), right = shuffle(words);
    let sel = null, matched = 0, misses = 0; const missed = [];
    const t0 = Date.now(); let pausedMs = 0, pauseStart = 0;
    const elapsed = () => (Date.now() - t0 - pausedMs) / 1000;
    g.timers.push(setInterval(() => {
      if (g.paused) { if (!pauseStart) pauseStart = Date.now(); return; }
      if (pauseStart) { pausedMs += Date.now() - pauseStart; pauseStart = 0; }
      g.hud.textContent = `${elapsed().toFixed(1)}s`;
    }, 100));
    g.body.innerHTML = `<div class="match-grid">
        <div class="col">${left.map(w => `<button class="m-tile vi" data-id="${w.id}" data-side="l" lang="vi">${esc(w.vi)}</button>`).join('')}</div>
        <div class="col">${right.map(w => `<button class="m-tile" data-id="${w.id}" data-side="r">${esc(w.en)}</button>`).join('')}</div>
      </div>`;
    g.foot.innerHTML = '';
    $$('.m-tile', g.body).forEach(b => b.onclick = () => {
      if (b.classList.contains('done')) return;
      if (b.dataset.side === 'l' && audioAvailable(L())) speak(b.textContent, L());
      if (!sel || sel.dataset.side === b.dataset.side) { sel && sel.classList.remove('sel'); sel = b; b.classList.add('sel'); return; }
      if (sel.dataset.id === b.dataset.id) {
        [sel, b].forEach(x => { x.classList.remove('sel'); x.classList.add('done'); x.disabled = true; });
        matched++; tick();
        S.recordAnswer('vocab', true);
        if (matched === words.length) {
          const secs = +elapsed().toFixed(1);
          award('match', t0, 20, matched, matched + misses);
          results(g, { score: secs, xp: 20, missed, label: misses ? `Matched with ${misses} miss${misses > 1 ? 'es' : ''}` : 'Perfect match!' }).onclick = () => { g.clearTimers(); countdown(g, play); };
        }
      } else {
        misses++; S.recordAnswer('vocab', false);
        const w = words.find(x => x.id === (sel.dataset.side === 'l' ? sel.dataset.id : b.dataset.id)); if (w) missed.push(w);
        const pair = [sel, b];
        pair.forEach(x => x.classList.add('shake'));
        setTimeout(() => pair.forEach(x => x.classList.remove('shake', 'sel')), 400);
      }
      sel = null;
    });
  };
  intro(g, play);
}

// ── Timed quiz games (Speed Round, Tone Hunter) ─────────────────────────────
function timedQuiz({ key, seconds, makeStep, label }) {
  const g = overlay(key);
  const play = () => {
    let score = 0, left = seconds, streak = 0, answered = 0, right = 0; const missed = [];
    const t0 = Date.now();
    const words = pool();
    let last = null;
    const tick = () => { g.hud.textContent = `⏱ ${left}s · ${score}`; };
    tick();
    const timer = setInterval(() => { if (g.paused) return; left--; tick(); if (left <= 0) end(); }, 1000);
    g.timers.push(timer);
    let ended = false;
    const end = () => {
      if (ended) return; ended = true;
      clearInterval(timer);
      const xp = score * 3;
      award(key, t0, xp, right, answered);
      results(g, { score, xp, missed, label }).onclick = () => { g.clearTimers(); countdown(g, play); };
    };
    const ask = () => {
      if (ended) return;
      let st = null;
      for (let k = 0; k < 15 && !st; k++) { const w = pick(words); if (w !== last) st = makeStep(w); }
      if (!st) { end(); return; }
      last = st.item;
      const isTone = st.type === 'tone';
      const opts = isTone ? st.options.map(o => ({ v: o, text: o, sub: TONE_NAMES[toneOf(o)] })) : st.options.map(o => ({ v: o.id, text: o.text }));
      const answer = isTone ? st.syl : st.answer;
      const shown = isTone ? st.item.vi.split(' ').map(w => w.replace(/[.,!?“”"]/g, '') === st.syl ? '___' : w).join(' ') : st.item.vi;
      g.body.innerHTML = `
        ${isTone ? `<div class="prompt en-prompt">${esc(st.item.en)}</div><div class="prompt vi big" lang="vi">${esc(shown)}</div><p class="kicker center">Which tone is right for “${esc(stripTones(st.syl))}”?</p>`
          : `<div class="prompt vi big" lang="vi">${esc(shown)}</div>`}
        <div class="options ${isTone ? 'grid2' : ''}">${opts.map(o => `<button class="option" data-v="${esc(o.v)}" ${isTone ? 'lang="vi"' : ''}>${esc(o.text)}${o.sub ? `<small>${o.sub}</small>` : ''}</button>`).join('')}</div>
        <p class="streak-pop">${streak >= 3 ? `🔥 ${streak} in a row` : '&nbsp;'}</p>`;
      let locked = false;
      $$('.option', g.body).forEach(b => b.onclick = () => {
        if (locked || ended) return; locked = true;
        const ok = b.dataset.v === answer;
        answered++;
        b.classList.add(ok ? 'right' : 'wrong');
        if (!ok) $$('.option', g.body).find(x => x.dataset.v === answer)?.classList.add('right');
        if (ok) { right++; streak++; score += streak >= 3 ? 2 : 1; tick(); } else { streak = 0; missed.push(st.item); }
        S.recordAnswer(isTone ? 'tones' : 'vocab', ok);
        tick();
        g.timers.push(setTimeout(ask, ok ? 350 : 1000));
      });
    };
    g.foot.innerHTML = '';
    ask();
  };
  intro(g, play);
}

export const speed = () => timedQuiz({ key: 'speed', seconds: 60, label: 'Time’s up!', makeStep: i => mcq(i, 'vi2en') });
export const toneHunter = () => timedQuiz({ key: 'tones', seconds: 45, label: 'Tone hunter done!', makeStep: i => tone(i) });

// ── Listen up: 10 audio rounds ──────────────────────────────────────────────
export function listen() {
  if (!audioAvailable(L())) { toast('No Vietnamese voice found on this device. See Settings → Audio.'); return; }
  const g = overlay('listen');
  const play = () => {
    const words = distinct(pool(), 10); let i = 0, score = 0; const missed = []; const t0 = Date.now();
    const ask = () => {
      if (i >= words.length) {
        award('listen', t0, score * 3, score, words.length);
        results(g, { score, xp: score * 3, missed, label: 'Listening done!' }).onclick = () => { g.clearTimers(); countdown(g, play); };
        return;
      }
      const st = mcq(words[i], 'audio2en');
      g.hud.textContent = `${i + 1}/${words.length} · ${score}`;
      g.body.innerHTML = `<p class="kicker center">What did you hear?</p>
        <div class="audio-row center"><button class="audio-btn big" aria-label="Play again">${icon('speaker')}</button></div>
        <div class="options">${st.options.map(o => `<button class="option" data-v="${o.id}">${esc(o.text)}</button>`).join('')}</div>`;
      g.foot.innerHTML = '';
      const say = () => speak(st.item.vi, L());
      $('.audio-btn', g.body).onclick = say; g.timers.push(setTimeout(say, 250));
      let locked = false;
      $$('.option', g.body).forEach(b => b.onclick = () => {
        if (locked) return; locked = true;
        const ok = b.dataset.v === st.answer;
        b.classList.add(ok ? 'right' : 'wrong');
        if (!ok) { $$('.option', g.body).find(x => x.dataset.v === st.answer)?.classList.add('right'); missed.push(st.item); }
        if (ok) { score++; tick(); }
        S.recordAnswer('listening', ok);
        g.foot.className = `s-foot fb ${ok ? 'good' : 'bad'}`;
        g.foot.innerHTML = `<div class="fb-msg"><strong>${ok ? 'Đúng rồi!' : 'Not quite'}</strong><div class="fb-ans"><span lang="vi">${esc(st.item.vi)}</span> — ${esc(st.item.en)}</div></div><button class="btn primary">${i + 1 < words.length ? 'Next' : 'See results'}</button>`;
        $('button', g.foot).onclick = () => { g.foot.className = 's-foot'; i++; ask(); };
      });
    };
    ask();
  };
  intro(g, play);
}
