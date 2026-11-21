// All app screens. Each renders into #app and wires its own events.
import * as C from './course.js';
import * as S from './store.js';
import * as X from './exercises.js';
import * as G from './games.js';
import * as P from './placement.js';
import * as T from './stats.js';
import { sync } from './sync.js';
import { speak, audioAvailable, voicesFor, voicesReady, stop as stopAudio } from './speech.js';
import { $, $$, esc, toast, dayKey, weekKeys, pct, timeAgo } from './util.js';
import { icon } from './icons.js';
import { isMastered } from './srs.js';
import { flagSheet, confirmSheet } from './ui.js';
import { hapticsSupported, tick } from './haptics.js';
import { stripAll } from './vitext.js';

const VERSION = '1.2';
const L = () => C.get().speechLang;
const say = (t, opts) => speak(t, L(), opts);
const go = h => { location.hash = h; };

function wireSay(root) {
  $$('[data-say]', root).forEach(b => b.addEventListener('click', e => {
    if (e.target.closest('.flag-it, a')) return;
    e.stopPropagation(); say(b.dataset.say, b.dataset.rate ? { rate: +b.dataset.rate } : {});
  }));
}
const sayBtn = (t, label = 'Play audio') => audioAvailable(L()) ? `<button class="icon-btn say" data-say="${esc(t)}" aria-label="${label}">${icon('speaker')}</button>` : '';
const bar = (p, cls = '') => `<div class="bar ${cls}"><div style="width:${Math.max(0, Math.min(100, p))}%"></div></div>`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// Tab pages: brand bar + large title. Detail pages: back button that returns to `back` if opened directly.
function header(title, { back, sub } = {}) {
  if (back) return `<header class="top">
    <button class="icon-btn back" data-parent="${esc(back)}" aria-label="Back">${icon('back')}</button>
    <h1 class="top-title">${esc(title)}${sub ? `<small lang="vi">${esc(sub)}</small>` : ''}</h1>
    <span class="icon-btn-spacer"></span>
  </header>`;
  return `<header class="top">
    <div class="brand"><span class="star">★</span> Motherland</div>
    <span class="grow"></span>
    <button class="icon-btn gear" aria-label="Settings">${icon('gear')}</button>
  </header>${title ? `<div class="large-title"><h1>${esc(title)}</h1>${sub ? `<p class="muted">${esc(sub)}</p>` : ''}</div>` : ''}`;
}
function wireHeader(root) {
  const b = $('.back', root);
  if (b) b.onclick = () => { if (window.__navDepth > 0) { window.__goingBack = true; history.back(); } else go(b.dataset.parent); };
  $('.gear', root)?.addEventListener('click', () => go('#/settings'));
}

function audioBanner() {
  if (!voicesReady() || audioAvailable(L())) return '';
  return `<a class="banner warn" href="#/settings">🔇 No Vietnamese voice found on this device, so listening drills are off. Tap to fix.</a>`;
}

const GAMES = { match: G.match, speed: G.speed, tones: G.toneHunter, listen: G.listen };

export function startLesson(unitId) {
  const steps = X.lessonSteps(unitId);
  X.run({ steps, activity: `lesson:${unitId}`, onFinish: () => {
    const p = C.unitProgress(unitId);
    const rec = (S.lang().lessons[unitId] ||= {});
    rec.at = Date.now(); rec.done = p.learned === p.total;
    S.save();
  } });
}

// ── HOME ────────────────────────────────────────────────────────────────────
export function home(root) {
  const st = S.get(), today = S.day(dayKey()), goal = st.settings.dailyGoal;
  const due = C.dueItems().length, nextU = C.nextUnit(), np = C.unitProgress(nextU.id);
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
    ${audioBanner()}
    <section class="hello card">
      <div>
        <h1 lang="vi">${greet}</h1>
        <p class="muted">${C.get().flag} ${C.get().native} · ${S.streak() ? `🔥 ${S.streak()}-day streak` : 'Start a streak today'}</p>
        ${wk.change != null ? `<p class="small ${wk.change >= 0 ? 'up' : 'down'}">${wk.change >= 0 ? '▲' : '▼'} ${Math.abs(wk.change)}% XP vs this point last week</p>` : ''}
      </div>
      <div class="ring" style="--p:${ring}" role="img" aria-label="Daily goal ${today.xp} of ${goal} XP"><span><b>${today.xp}</b><small>/${goal} XP</small></span></div>
    </section>

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
  $('.do-flash', root)?.addEventListener('click', () => X.run({ steps: X.flashSteps(), activity: 'flashcards' }));
  $('.do-quiz', root)?.addEventListener('click', () => X.run({ steps: X.reviewSteps(), activity: 'review' }));
  $('.do-endless', root)?.addEventListener('click', () => X.run({ endless: true, activity: 'endless', steps: [] }));
  $$('[data-game]', root).forEach(b => b.onclick = () => GAMES[b.dataset.game]());
}

// ── LEARN (unit list) ───────────────────────────────────────────────────────
export function learn(root) {
  const course = C.get();
  const groups = course.sections.map(sec => ({ sec, units: course.units.filter(u => u.section === sec) })).filter(g => g.units.length);
  const gCount = C.grammarItems().length, gLearned = C.grammarItems().filter(i => C.card(i.id)).length;
  root.innerHTML = `${header('Learn', { sub: `${course.units.length} units · ${C.vocabItems().length} words & phrases · ${gCount} grammar points` })}
  <div class="page">
    <div class="link-row">
      <a class="card link-card" href="#/grammar"><span aria-hidden="true" class="mode-ico">${icon('book')}</span><div class="grow"><b>Grammar guide</b><p class="muted small">${gLearned}/${gCount} learned</p></div></a>
      <a class="card link-card" href="#/words"><span aria-hidden="true" class="mode-ico">${icon('cards')}</span><div class="grow"><b>Word bank</b><p class="muted small">${C.seenItems().filter(i => i.kind !== 'grammar').length} learned</p></div></a>
    </div>
    ${groups.map(g => `<h2 class="section-title">${esc(g.sec)}</h2>
      <div class="unit-list">${g.units.map(u => { const p = C.unitProgress(u.id); return `
        <a class="unit-row card" href="#/unit/${u.id}">
          <div aria-hidden="true" class="unit-ico">${u.icon}</div>
          <div class="grow">
            <div class="unit-name"><b>${esc(u.title)}</b>${p.pct === 100 ? '<span class="chip ok">✓</span>' : ''}</div>
            <div class="muted small" lang="vi">${esc(u.vi)}</div>
            ${bar(p.pct)}
          </div>
          <span class="chip lvl">L${u.level}</span>
        </a>`; }).join('')}</div>`).join('')}
    <p class="muted small center pad">More units can be added any time. Ask Claude for a new lesson pack.</p>
  </div>`;
  wireHeader(root);
}

// ── UNIT DETAIL ─────────────────────────────────────────────────────────────
export function unit(root, id, tab = 'words') {
  const u = C.unit(id);
  if (!u) { go('#/learn'); return; }
  const p = C.unitProgress(id);
  const items = C.unitItems(id), cards = C.cards();
  const status = it => { const c = cards[it.id]; return !c ? 'new' : isMastered(c) ? 'mastered' : 'learning'; };
  const showH = S.settings().showHanoi;
  const gItems = items.filter(i => i.kind === 'grammar');
  const tabs = [['words', 'Words'], ['phrases', 'Phrases'], ...(gItems.length ? [['grammar', 'Grammar']] : []), ...(u.dialogue.length ? [['dialogue', 'Talk']] : []), ...(u.reading ? [['reading', 'Read']] : [])];
  if (!tabs.some(t => t[0] === tab)) tab = 'words';
  const remaining = items.filter(i => !cards[i.id]).length;
  const newVocab = items.filter(i => i.kind !== 'grammar' && !cards[i.id]).length;
  const flagBtn = it => `<button class="icon-btn flag-it" data-id="${it.id}" aria-label="Report a problem">${icon('flag')}</button>`;

  const panels = {
    words: () => `<ul class="word-list">${items.filter(i => i.kind === 'word').map(it => `
      <li class="word-row" data-say="${esc(it.vi)}">
        <span class="dot ${status(it)}" title="${status(it)}"></span>
        <div class="grow">
          <div class="vi" lang="vi">${esc(it.vi)}</div>
          <div class="muted">${esc(it.en)}</div>
          ${it.north && showH ? `<div class="hanoi">Hanoi: <b lang="vi">${esc(it.north)}</b></div>` : ''}
          ${it.note ? `<div class="note small">💡 ${esc(it.note)}</div>` : ''}
        </div>${flagBtn(it)}
      </li>`).join('')}</ul>`,
    phrases: () => `<ul class="word-list">${items.filter(i => i.kind === 'phrase').map(it => `
      <li class="word-row" data-say="${esc(it.vi)}">
        <span class="dot ${status(it)}"></span>
        <div class="grow"><div class="vi" lang="vi">${esc(it.vi)}</div><div class="muted">${esc(it.en)}</div></div>${flagBtn(it)}
      </li>`).join('')}</ul>`,
    grammar: () => gItems.map(it => { const g = it.point; return `
      <section class="card grammar-card">
        <div class="row"><span class="dot ${status(it)}"></span><h2 class="grow">${esc(g.title)}</h2>${flagBtn(it)}</div>
        <p>${esc(g.explain)}</p>
        ${g.pattern ? `<div class="pattern">${esc(g.pattern)}</div>` : ''}
        ${g.table ? X.grammarTable(g.table) : ''}
        <div class="examples">${g.examples.map(([v, en]) => `<button class="ex-row" data-say="${esc(v)}"><b lang="vi">${esc(v)}</b><span class="muted">${esc(en)}</span></button>`).join('')}</div>
        <button class="btn ghost wide practice-g" data-id="${it.id}">Practice this (${g.drills.length} drills)</button>
      </section>`; }).join(''),
    dialogue: () => {
      const speakers = [...new Set(u.dialogue.map(d => d[0]))];
      return `<div class="dlg-tools"><button class="btn ghost small play-all">${icon('play')} Play all</button>
        <label class="switch"><input type="checkbox" class="tr-toggle" checked><span>Translations</span></label></div>
      <div class="dialogue">${u.dialogue.map(([who, v, en]) => `<div class="bubble ${speakers.indexOf(who) % 2 ? 'right' : 'left'}" data-say="${esc(v)}"><small>${esc(who)}</small><div class="vi" lang="vi">${esc(v)}</div><div class="tr muted">${esc(en)}</div></div>`).join('')}</div>`;
    },
    reading: () => `<div class="dlg-tools"><button class="btn ghost small read-all">${icon('play')} Read aloud</button>
        <label class="switch"><input type="checkbox" class="tr-toggle"><span>Translation</span></label></div>
      <div class="reading card"><p lang="vi">${u.reading.vi.split(/(?<=[.!?”])\s+/).map(sn => `<span class="sent" data-say="${esc(sn)}">${esc(sn)}</span>`).join(' ')}</p>
      <p class="tr muted hidden">${esc(u.reading.en)}</p></div>
      <p class="hint">Tap any sentence to hear it. Read once without the translation, then check.</p>`,
  };

  root.innerHTML = `${header(u.title, { back: '#/learn', sub: u.vi })}
  <div class="page">
    <section class="card unit-hero">
      <div class="row"><div aria-hidden="true" class="unit-ico big">${u.icon}</div>
        <div class="grow"><b>${p.learned}/${p.total} learned</b>${bar(p.pct)}<span class="chip lvl">Level ${u.level} · ${esc(u.section)}</span></div></div>
      <div class="btn-row">
        <button class="btn primary learn-new">${remaining ? (newVocab ? `Learn ${Math.min(newVocab, S.settings().newPerLesson)} new` : 'Learn the grammar') : 'Practice unit'}</button>
        ${p.learned && remaining ? `<button class="btn ghost practice">Practice</button>` : ''}
      </div>
    </section>
    <details class="card tip" ${p.learned ? '' : 'open'}><summary>💡 Culture & usage note</summary><p>${esc(u.tip)}</p></details>
    <nav class="seg" role="tablist">${tabs.map(([k, n]) => `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</nav>
    <div class="panel">${panels[tab]()}</div>
  </div>`;
  wireHeader(root); wireSay(root);
  $('.learn-new', root).onclick = () => remaining ? startLesson(id) : X.run({ steps: X.practiceSteps(items, 12), activity: `practice:${id}` });
  $('.practice', root)?.addEventListener('click', () => X.run({ steps: X.practiceSteps(items.filter(i => cards[i.id]), 12), activity: `practice:${id}` }));
  $$('.practice-g', root).forEach(b => b.onclick = () => X.run({ steps: X.grammarSteps(C.item(b.dataset.id)), activity: `grammar:${b.dataset.id}` }));
  $$('.seg button', root).forEach(b => b.onclick = () => { stopAudio(); history.replaceState(null, '', `#/unit/${id}/${b.dataset.tab}`); unit(root, id, b.dataset.tab); });
  $$('.flag-it', root).forEach(b => b.onclick = e => { e.stopPropagation(); flagSheet(C.item(b.dataset.id)); });
  const tr = $('.tr-toggle', root);
  if (tr) tr.onchange = () => $$('.tr', root).forEach(x => x.classList.toggle('hidden', !tr.checked));
  const playSeq = (els) => {
    let k = 0;
    const nextLine = () => {
      $$('.playing', root).forEach(x => x.classList.remove('playing'));
      if (k >= els.length || !document.body.contains(els[0])) return;
      const el = els[k++]; el.classList.add('playing'); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      say(el.dataset.say, { onend: () => setTimeout(nextLine, 350) });
    };
    nextLine();
  };
  $('.play-all', root)?.addEventListener('click', () => playSeq($$('.bubble', root)));
  $('.read-all', root)?.addEventListener('click', () => playSeq($$('.sent', root)));
}

// ── GRAMMAR GUIDE ───────────────────────────────────────────────────────────
export function grammar(root) {
  const course = C.get(), cards = C.cards();
  root.innerHTML = `${header('Grammar guide', { back: '#/learn', sub: 'Ngữ pháp' })}
  <div class="page">
    <p class="muted small">Each point is taught inside its unit’s first lesson, then comes back in your reviews. Tap one to read it or practice.</p>
    ${course.sections.map(sec => {
      const pts = course.units.filter(u => u.section === sec).flatMap(u => C.unitItems(u.id).filter(i => i.kind === 'grammar').map(i => ({ i, u })));
      if (!pts.length) return '';
      return `<h2 class="section-title">${esc(sec)}</h2><ul class="word-list">${pts.map(({ i, u }) => `
        <li class="word-row g-link" data-href="#/unit/${u.id}/grammar">
          <span class="dot ${!cards[i.id] ? 'new' : isMastered(cards[i.id]) ? 'mastered' : 'learning'}"></span>
          <div class="grow"><b>${esc(i.point.title)}</b><div class="muted small">${u.icon} ${esc(u.title)}</div></div>${icon('chevron')}
        </li>`).join('')}</ul>`;
    }).join('')}
  </div>`;
  wireHeader(root);
  $$('.g-link', root).forEach(li => li.onclick = () => go(li.dataset.href));
}

// ── WORD BANK ───────────────────────────────────────────────────────────────
export function words(root, filter = 'all') {
  const cards = C.cards(), now = Date.now();
  const learned = C.seenItems().filter(i => i.kind !== 'grammar').sort((a, b) => (cards[b.id].seen || 0) - (cards[a.id].seen || 0));
  const counts = { all: learned.length, learning: learned.filter(i => !isMastered(cards[i.id])).length, mastered: learned.filter(i => isMastered(cards[i.id])).length, missed: learned.filter(i => cards[i.id].lapses > 0).length };
  const when = c => { const d = Math.round((c.due - now) / 86400000); return c.due <= now ? 'due now' : d < 1 ? 'later today' : `in ${d}d`; };
  root.innerHTML = `${header('Word bank', { back: '#/progress', sub: `${learned.length} learned` })}
  <div class="page">
    <input class="search" type="search" placeholder="Search Vietnamese or English…" aria-label="Search words" autocomplete="off" autocorrect="off" autocapitalize="off">
    <nav class="seg filters">${[['all', 'All'], ['learning', 'Learning'], ['mastered', 'Mastered'], ['missed', 'Missed']].map(([k, n]) => `<button class="${k === filter ? 'on' : ''}" data-f="${k}">${n} <small>${counts[k]}</small></button>`).join('')}</nav>
    ${learned.length ? `<ul class="word-list bank">${learned.map(it => { const c = cards[it.id], u = C.unit(it.unit); return `
      <li class="word-row" data-say="${esc(it.vi)}" data-st="${isMastered(c) ? 'mastered' : 'learning'}${c.lapses ? ' missed' : ''}" data-q="${esc(stripAll(`${it.vi} ${it.en} ${it.north}`).toLowerCase())}">
        <span class="dot ${isMastered(c) ? 'mastered' : 'learning'}"></span>
        <div class="grow"><div class="vi" lang="vi">${esc(it.vi)}</div><div class="muted">${esc(it.en)}</div>
          <div class="small muted">${u.icon} ${esc(u.title)} · review ${when(c)}${c.lapses ? ` · missed ×${c.lapses}` : ''}</div></div>
      </li>`; }).join('')}</ul><p class="muted small center empty-msg hidden">No matches.</p>`
      : `<p class="muted center pad">Words you learn in lessons will collect here.</p><a class="btn primary" href="#/learn">Start a lesson</a>`}
  </div>`;
  wireHeader(root); wireSay(root);
  const input = $('.search', root);
  const apply = () => {
    const q = stripAll(input.value.trim()).toLowerCase(), f = $('.filters .on', root).dataset.f;
    let shown = 0;
    $$('.bank .word-row', root).forEach(li => {
      const ok = (!q || li.dataset.q.includes(q)) && (f === 'all' || li.dataset.st.includes(f));
      li.classList.toggle('hidden', !ok); if (ok) shown++;
    });
    $('.empty-msg', root)?.classList.toggle('hidden', shown > 0 || !learned.length);
  };
  input.oninput = apply;
  $$('.filters button', root).forEach(b => b.onclick = () => { $$('.filters button', root).forEach(x => x.classList.remove('on')); b.classList.add('on'); apply(); });
  apply();
}

// ── REVIEW ──────────────────────────────────────────────────────────────────
export function review(root) {
  const due = C.dueItems().length, seen = C.seenItems().length, mastered = C.masteredCount();
  const cards = C.cards();
  const upcoming = Object.values(cards).filter(c => c.due > Date.now()).sort((a, b) => a.due - b.due)[0];
  const weak = C.seenItems().filter(i => cards[i.id].lapses > 0).sort((a, b) => cards[b.id].lapses - cards[a.id].lapses).slice(0, 12);
  const gSeen = C.seenItems().filter(i => i.kind === 'grammar');
  root.innerHTML = `${header('Review', { sub: 'Spaced repetition: right before you forget' })}
  <div class="page">
    <section class="card stats3">
      <div class="stat"><b>${due}</b><span>due now</span></div>
      <div class="stat"><b>${seen}</b><span>learning</span></div>
      <div class="stat"><b>${mastered}</b><span>mastered</span></div>
    </section>
    ${!due && upcoming ? `<p class="muted center small">Next card due ${new Date(upcoming.due).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</p>` : ''}
    <button class="card mode" data-mode="flash" ${due ? '' : 'disabled'}><span aria-hidden="true" class="mode-ico">${icon('cards')}</span><div class="grow"><b>Flashcards</b><p class="muted">Flip and rate how well you knew it. Classic and fast.</p></div>${icon('chevron')}</button>
    <button class="card mode" data-mode="quiz" ${due ? '' : 'disabled'}><span aria-hidden="true" class="mode-ico">${icon('check')}</span><div class="grow"><b>Quiz review</b><p class="muted">Due cards as mixed exercises: meaning, grammar, tones, listening, typing.</p></div>${icon('chevron')}</button>
    <button class="card mode" data-mode="endless" ${seen ? '' : 'disabled'}><span aria-hidden="true" class="mode-ico">${icon('infinity')}</span><div class="grow"><b>Endless review</b><p class="muted">Keeps going as long as you want. Focuses on what you miss.</p></div>${icon('chevron')}</button>
    <button class="card mode" data-mode="grammar" ${gSeen.length ? '' : 'disabled'}><span aria-hidden="true" class="mode-ico">${icon('book')}</span><div class="grow"><b>Grammar drills</b><p class="muted">${gSeen.length ? `Mixed drills from the ${plural(gSeen.length, 'grammar point')} you’ve learned.` : 'Unlocks after your first lesson.'}</p></div>${icon('chevron')}</button>
    <button class="card mode" data-mode="weak" ${weak.length ? '' : 'disabled'}><span aria-hidden="true" class="mode-ico">${icon('target')}</span><div class="grow"><b>Weak spots</b><p class="muted">${weak.length ? `${plural(weak.length, 'item')} you’ve missed before.` : 'Things you miss will show up here.'}</p></div>${icon('chevron')}</button>
    ${!seen ? `<p class="muted center pad">Finish your first lesson to unlock reviews.</p>` : ''}
  </div>`;
  wireHeader(root);
  const modes = {
    flash: () => X.run({ steps: X.flashSteps(), activity: 'flashcards' }),
    quiz: () => X.run({ steps: X.reviewSteps(), activity: 'review' }),
    endless: () => X.run({ endless: true, steps: [], activity: 'endless' }),
    grammar: () => X.run({ steps: gSeen.flatMap(i => X.grammarDrills(i)).sort(() => Math.random() - 0.5).slice(0, 12), activity: 'grammar' }),
    weak: () => X.run({ steps: weak.map(i => X.choose(i, 2)), activity: 'weak' }),
  };
  $$('[data-mode]', root).forEach(b => b.onclick = () => modes[b.dataset.mode]());
}

// ── PLAY ────────────────────────────────────────────────────────────────────
export function play(root) {
  const g = S.lang().games;
  const audio = audioAvailable(L());
  root.innerHTML = `${header('Play', { sub: 'Games for when you have a few minutes' })}
  <div class="page">
    ${Object.entries(G.GAME_INFO).map(([k, info]) => `<button class="card game-card" data-game="${k}" ${k === 'listen' && !audio ? 'disabled' : ''}>
      <span aria-hidden="true" class="g-emoji">${info.emoji}</span><div class="grow"><b>${info.name}</b><p class="muted">${k === 'listen' && !audio ? 'Needs a Vietnamese voice (see Settings).' : esc(info.rules)}</p>
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
    return `<section class="card"><p class="kicker">${info.emoji} ${esc(info.name)}</p>
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
  const weak = C.seenItems().filter(i => cards[i.id].lapses > 0).sort((a, b) => cards[b.id].lapses - cards[a.id].lapses).slice(0, 6);
  const rec = last ? P.recommendation(last) : null;
  const growth = T.growth(30), heat = T.heatmap(12);
  const gained = growth[growth.length - 1].n - growth[0].n;
  const seenV = C.seenItems().filter(i => i.kind !== 'grammar').length;
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
      <a class="card link-card" href="#/leaderboard"><span aria-hidden="true" class="mode-ico">🏆</span><div class="grow"><b>Leaderboards</b><p class="muted small">Weeks · months · games</p></div></a>
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
        <div class="row"><div class="grow"><b class="lvl-label">${esc(last.label)}</b><p class="muted small">Placement ${new Date(last.at).toLocaleDateString()} · ${last.score}% correct</p></div><span class="chip lvl">Level ${last.level}/3</span></div>
        ${last.weak.length ? `<p class="small"><b>Work on:</b> ${last.weak.map(esc).join(', ')}</p>` : '<p class="small">No weak spots found in the test. 🎉</p>'}
        ${rec ? `<p class="small"><b>Suggested next:</b> <a href="#/unit/${rec.id}">${rec.icon} ${esc(rec.title)}</a></p>` : ''}
        <div class="btn-row"><a class="btn ghost" href="#/diagnostics">Full results</a><a class="btn ghost" href="#/placement">Retake test</a></div>
        ${tests.length > 1 ? `<p class="muted small">History: ${tests.slice(-5).map(t => `${new Date(t.at).toLocaleDateString([], { month: 'short', day: 'numeric' })} · L${t.level} (${t.score}%)`).join(' → ')}</p>` : ''}
      ` : `<p>Take the placement test to see your level, your strongest and weakest skills, and where to start.</p><a class="btn primary" href="#/placement">Take placement test</a>`}
    </section>

    ${lessons.length ? `<section class="card"><p class="kicker">Recent lessons</p><ul class="mini-list">${lessons.map(l => `<li><a href="#/unit/${l.unit.id}">${l.unit.icon} ${esc(l.unit.title)}</a><span class="grow"></span>${l.done ? '<span class="chip ok">complete</span>' : ''}<small class="muted">${timeAgo(l.at)}</small></li>`).join('')}</ul></section>` : ''}

    ${weak.length ? `<section class="card"><p class="kicker">What you miss most</p>
      <ul class="mini-list">${weak.map(i => `<li data-say="${esc(i.vi)}"><span class="vi" lang="vi">${esc(i.vi)}</span><span class="muted grow ellip">${esc(i.en)}</span><span class="chip warn">×${cards[i.id].lapses}</span></li>`).join('')}</ul></section>` : ''}

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
  const rows = (m, name, thr) => Object.entries(m).map(([k, x]) => `<div class="skill"><div class="row"><span class="grow">${esc(name(k))}</span><small>${x.c}/${x.t} · ${pct(x.c, x.t)}%</small></div>${bar(pct(x.c, x.t), pct(x.c, x.t) < thr ? 'low' : '')}</div>`).join('');
  root.innerHTML = `${header('Your results', { back: '#/progress' })}
  <div class="page">
    <section class="card result-hero">
      <p class="kicker">Your level</p>
      <h1>${esc(r.label)}</h1>
      <p class="muted">${r.c} of ${r.t} correct (${r.score}%)</p>
      <div class="lvl-steps">${C.get().levels.map((n, i) => `<span class="${i <= r.level ? 'on' : ''}">${esc(n)}</span>`).join('')}</div>
    </section>
    <section class="card"><p class="kicker">What to work on</p>
      ${r.level === 0 && r.score < 40 ? '<p>You’re early on, which is the perfect place to start. Work through the units in order and retake the test in a few weeks to see the change.</p>' : ''}
      ${r.weak.length ? `<ul class="checklist warnlist">${r.weak.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : '<p>Nothing stood out as weak. Keep moving forward!</p>'}
      ${rec ? `<p>Start with <b>${rec.icon} ${esc(rec.title)}</b>.</p><a class="btn primary" href="#/unit/${rec.id}">Go to ${esc(rec.title)}</a>` : ''}
    </section>
    ${r.level > 0 && !r.applied ? `<section class="card"><p class="kicker">Skip ahead?</p>
      <p class="small">You passed level ${r.level}. Add those units to your review queue so you can confirm them quickly instead of relearning from scratch.</p>
      <button class="btn ghost apply">Add level 1${r.level > 1 ? `–${r.level}` : ''} units to review</button></section>` : ''}
    <section class="card"><p class="kicker">By level</p>${rows(r.levels, k => `Level ${k} questions`, 67)}</section>
    <section class="card"><p class="kicker">By skill</p>${rows(r.skills, P.skillName, 60)}</section>
    <section class="card"><p class="kicker">By topic</p>${rows(r.sections, k => k, 60)}</section>
  </div>`;
  wireHeader(root);
  $('.apply', root)?.addEventListener('click', () => { const n = P.applyLevel(r.level); r.applied = true; S.save(); toast(`${n} items added to review`); diagnostics(root); });
}

// ── SETTINGS ────────────────────────────────────────────────────────────────
export function settings(root) {
  const st = S.settings();
  const vlist = voicesFor(L());
  const flags = S.get().flags;
  root.innerHTML = `${header('Settings', { back: '#/home' })}
  <div class="page">
    <section class="card">
      <p class="kicker">Languages</p>
      <div class="lang-row on"><span class="flag">${C.get().flag}</span><div class="grow"><b>${C.get().name}</b><p class="muted small">${esc(C.get().accent)}</p></div><span class="chip ok">Active</span></div>
      ${C.UPCOMING.map(u => `<div class="lang-row"><span class="flag">${u.flag}</span><div class="grow"><b>${u.name}</b> <span class="muted">${u.native}</span><p class="muted small">${esc(u.plan)}</p></div><span class="chip">Soon</span></div>`).join('')}
    </section>

    <section class="card">
      <p class="kicker">Accent</p>
      <label class="switch row"><span class="grow">Show Hanoi (Northern) word variants</span><input type="checkbox" class="opt-hanoi" ${st.showHanoi ? 'checked' : ''}></label>
      <p class="muted small">Lessons teach Saigon (Southern) Vietnamese first. Where Hanoi uses a different word, it’s shown underneath.</p>
    </section>

    <section class="card">
      <p class="kicker">Audio</p>
      <p class="small">${vlist.length ? `✅ ${plural(vlist.length, 'Vietnamese voice')} found.` : '🔇 No Vietnamese voice found yet.'}</p>
      ${vlist.length ? `<label class="field"><span>Voice</span><select class="opt-voice">${vlist.map(v => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === st.voiceURI ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}</select></label>` : ''}
      <label class="field"><span>Speed <b class="rate-val">${st.rate.toFixed(2)}×</b></span><input type="range" class="opt-rate" min="0.5" max="1.1" step="0.05" value="${st.rate}"></label>
      <div class="btn-row"><button class="btn ghost test-voice">${icon('speaker')} Test voice</button></div>
      <details><summary>No voice or wrong accent?</summary>
        <ol class="small">
          <li>iPhone <b>Settings → Accessibility → Spoken Content → Voices → Vietnamese</b> and download a voice.</li>
          <li>Close Motherland completely and reopen it.</li>
          <li>The built-in voice may sound more Northern than Saigon. It’s still great for tones and listening; the written words in lessons are Saigon-first.</li>
        </ol>
        <label class="switch row"><span class="grow">Turn on audio drills anyway</span><input type="checkbox" class="opt-force" ${st.forceAudio ? 'checked' : ''}></label>
      </details>
    </section>

    <section class="card">
      <p class="kicker">Study</p>
      <label class="field"><span>Daily goal</span><select class="opt-goal">${[30, 60, 100, 150].map(n => `<option value="${n}" ${n === st.dailyGoal ? 'selected' : ''}>${n} XP (${{ 30: 'casual', 60: 'regular', 100: 'serious', 150: 'intense' }[n]})</option>`).join('')}</select></label>
      <label class="field"><span>New items per lesson</span><select class="opt-new">${[5, 8, 10, 12].map(n => `<option value="${n}" ${n === st.newPerLesson ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="switch row"><span class="grow">Haptic tap on right answers</span><input type="checkbox" class="opt-haptics" ${st.haptics !== false ? 'checked' : ''}></label>
      ${hapticsSupported() ? '' : '<p class="muted small">Needs iOS 17.4 or later on iPhone.</p>'}
    </section>

    <section class="card">
      <p class="kicker">Google Sheet sync (free backup)</p>
      <label class="field"><span>Web app URL</span><input class="opt-url" type="url" inputmode="url" autocapitalize="off" autocorrect="off" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(st.syncUrl)}"></label>
      <label class="field"><span>Sync password</span><input class="opt-key" type="password" autocapitalize="off" placeholder="The SECRET from your script" value="${esc(st.syncKey)}"></label>
      <div class="btn-row"><button class="btn primary sync-now">${icon('cloud')} Sync now</button></div>
      <p class="small muted sync-status">${st.syncUrl ? `Last synced ${timeAgo(st.lastSync)}${st.syncError ? ` · ⚠️ ${esc(st.syncError)}` : ''}` : 'Not connected. Progress is saved on this iPhone.'}</p>
      <details><summary>How to set it up (3 minutes)</summary>
        <ol class="small">
          <li>Create a Google Sheet called “Motherland Progress”.</li>
          <li>Open <b>Extensions → Apps Script</b>, paste the code from <code>apps-script/Code.gs</code>, and change <code>SECRET</code>.</li>
          <li><b>Deploy → New deployment → Web app</b>. Execute as <b>Me</b>, access <b>Anyone</b>. Copy the URL.</li>
          <li>Paste the URL and your SECRET here, then tap Sync now.</li>
        </ol>
      </details>
    </section>

    <section class="card">
      <p class="kicker">Flagged items (${flags.length})</p>
      ${flags.length ? `<ul class="mini-list">${flags.slice().reverse().map(f => `<li><div class="grow"><span class="vi" lang="vi">${esc(f.vi)}</span> <span class="muted">${esc(f.en)}</span>${f.note ? `<div class="small">“${esc(f.note)}”</div>` : ''}</div><button class="icon-btn unflag" data-id="${f.id}" aria-label="Remove flag">${icon('x')}</button></li>`).join('')}</ul>
        <p class="muted small">Share these with Claude to get the lesson content fixed. They also sync to the Flags tab of your Sheet.</p>`
        : '<p class="muted small">Tap 🚩 on any word or exercise that sounds off to you or your family.</p>'}
    </section>

    <section class="card">
      <p class="kicker">Your data</p>
      <div class="btn-row wrap">
        <button class="btn ghost export">Export backup</button>
        <label class="btn ghost import">Import backup<input type="file" accept="application/json,.json" hidden></label>
        <button class="btn danger reset">Reset progress</button>
      </div>
    </section>
    <p class="muted small center">Motherland v${VERSION} · ${C.vocabItems().length} words & phrases · ${C.grammarItems().length} grammar points · free forever</p>
  </div>`;
  wireHeader(root);
  const set = (k, v) => { st[k] = v; S.save(); };
  $('.opt-hanoi', root).onchange = e => set('showHanoi', e.target.checked);
  $('.opt-force', root).onchange = e => set('forceAudio', e.target.checked);
  $('.opt-haptics', root).onchange = e => { set('haptics', e.target.checked); tick(); };   // feel it once when turned on
  $('.opt-voice', root)?.addEventListener('change', e => set('voiceURI', e.target.value));
  $('.opt-rate', root).oninput = e => { $('.rate-val', root).textContent = `${(+e.target.value).toFixed(2)}×`; set('rate', +e.target.value); };
  $('.test-voice', root).onclick = () => say('Xin chào! Chúc bạn một ngày vui vẻ.');
  $('.opt-goal', root).onchange = e => set('dailyGoal', +e.target.value);
  $('.opt-new', root).onchange = e => set('newPerLesson', +e.target.value);
  $('.opt-url', root).onchange = e => set('syncUrl', e.target.value.trim());
  $('.opt-key', root).onchange = e => set('syncKey', e.target.value);
  $('.sync-now', root).onclick = async (e) => {
    st.syncUrl = $('.opt-url', root).value.trim(); st.syncKey = $('.opt-key', root).value; S.save({ touch: false });
    if (!st.syncUrl) { toast('Paste your web app URL first'); return; }
    e.currentTarget.disabled = true; e.currentTarget.textContent = 'Syncing…';
    try { await sync({ quiet: false }); toast('Synced ✅'); } catch (err) { toast(`Sync failed: ${err.message}`, 3500); }
    settings(root);
  };
  $$('.unflag', root).forEach(b => b.onclick = () => { S.get().flags = S.get().flags.filter(f => f.id !== b.dataset.id); S.save(); settings(root); });
  $('.export', root).onclick = () => {
    const blob = new Blob([JSON.stringify(S.get(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `motherland-backup-${dayKey()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('.import input', root).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text()); if (!data.langs) throw new Error('Not a Motherland backup');
      if (await confirmSheet('Restore this backup?', 'It replaces the progress currently on this phone.', 'Restore')) { S.replace(data); toast('Backup restored'); settings(root); }
    } catch (err) { toast(`Import failed: ${err.message}`); }
    e.target.value = '';
  };
  $('.reset', root).onclick = async () => {
    if (!await confirmSheet('Erase all progress?', 'Everything on this phone will be reset. Export a backup first if you might want it.', 'Continue', 'danger')) return;
    if (!await confirmSheet('Are you sure?', 'This cannot be undone.', 'Erase everything', 'danger')) return;
    S.reset(); toast('Progress reset'); go('#/home');
  };
}
