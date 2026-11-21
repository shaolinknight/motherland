// All app screens. Each renders into #app and wires its own events.
import * as C from './course.js';
import * as S from './store.js';
import * as X from './exercises.js';
import * as G from './games.js';
import * as P from './placement.js';
import * as T from './stats.js';
import { sync } from './sync.js';
import { speak, audioAvailable, voicesFor, voicesReady, stop as stopAudio } from './speech.js';
import { $, $$, esc, toast, dayKey, weekKeys, pct, timeAgo, uid } from './util.js';
import { icon } from './icons.js';
import { isMastered, isHidden } from './srs.js';
import { flagSheet, confirmSheet, itemOptions, sheet } from './ui.js';
import { ankiText } from './ankiexport.js';
import { applyTheme } from './theme.js';
import { focusSkills, retestDue, daysSincePlacement, RETEST_AFTER_DAYS } from './focus.js';
import { hapticsSupported, tick } from './haptics.js';
import { stripAll } from './vitext.js';
import { spellingProblems } from './vispell.js';

const VERSION = '1.3';
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
  return `<a class="banner warn" href="#/settings/audio">🔇 No Vietnamese voice found on this device, so listening drills are off. Tap to fix.</a>`;
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

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Download all progress as a JSON file (Settings → Backup, and the Home reminder).
// The sync password is left out: the file may end up in Files, iCloud or a chat.
function exportBackup() {
  const st = S.get();
  const copy = { ...st, settings: { ...st.settings, syncKey: '' } };
  download(`motherland-backup-${dayKey()}.json`, JSON.stringify(copy, null, 1), 'application/json');
  st.settings.lastBackup = Date.now(); S.save({ touch: false });
}

// Without Sheet sync, progress lives only in Safari's storage for this site. Nudge a backup every
// two weeks once there's something worth keeping (10+ items studied).
const BACKUP_EVERY = 14 * 86400000;
function backupDue() {
  const st = S.settings();
  if (st.syncUrl || Object.keys(C.cards()).length < 10) return false;
  return Date.now() - Math.max(st.lastBackup || 0, st.backupSnooze || 0) > BACKUP_EVERY;
}

// "🔥 12-day streak · 🧊 freeze ready": one missed day a week is forgiven.
function streakLine() {
  const { n, freezeLeft } = S.streakDetails();
  if (!n) return 'Start a streak today';
  const freeze = freezeLeft ? '🧊 freeze ready' : '🧊 freeze used this week';
  return `🔥 ${n}-day streak · <span title="One missed day a week won’t break your streak">${freeze}</span>`;
}

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
    <a class="card link-card my-link" href="#/mywords"><span aria-hidden="true" class="mode-ico">📝</span><div class="grow"><b>My words</b><p class="muted small">${C.myItems().length ? `${plural(C.myItems().length, 'word')} you added${C.myItems().some(i => !i.verified) ? ` · ${C.myItems().filter(i => !i.verified).length} to check with family` : ''}` : 'Add words you hear from family'}</p></div>${icon('chevron')}</a>
    ${groups.map(g => `<h2 class="section-title">${esc(g.sec)}</h2>
      <div class="unit-list">${g.units.map(u => { const p = C.unitProgress(u.id); return `
        <a class="unit-row card" href="#/unit/${u.id}">
          <div aria-hidden="true" class="unit-ico">${u.icon}</div>
          <div class="grow">
            <div class="unit-name"><b>${esc(u.title)}</b>${p.pct === 100 ? '<span class="chip ok">✓</span>' : ''}</div>
            <div class="muted small" lang="vi">${esc(u.vi)}</div>
            ${u.review ? '<span class="chip warn review-chip">🧐 New · needs family check</span>' : ''}
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
        ${u.review ? '<p class="small review-note">🧐 <b>Needs family check.</b> This unit is new and hasn’t been checked by a native speaker yet. Tap 🚩 on anything that sounds off.</p>' : ''}
      <div class="btn-row">
        <button class="btn primary learn-new">${remaining ? (newVocab ? `Learn ${Math.min(newVocab, S.settings().newPerLesson)} new` : 'Learn the grammar') : 'Practice unit'}</button>
        ${p.learned && remaining ? `<button class="btn ghost practice">Practice</button>` : ''}
        ${remaining && !p.learned ? `<button class="btn ghost test-out">Test out</button>` : ''}
      </div>
    </section>
    <details class="card tip" ${p.learned ? '' : 'open'}><summary>💡 Culture & usage note</summary><p>${esc(u.tip)}</p></details>
    <nav class="seg" role="tablist">${tabs.map(([k, n]) => `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</nav>
    <div class="panel">${panels[tab]()}</div>
  </div>`;
  wireHeader(root); wireSay(root);
  $('.learn-new', root).onclick = () => remaining ? startLesson(id) : X.run({ steps: X.practiceSteps(items, 12), activity: `practice:${id}` });
  $('.test-out', root)?.addEventListener('click', async () => {
    if (!(await confirmSheet('Test out of this unit?', `Up to 10 quick questions where you produce the Vietnamese. Score ${Math.round(P.TEST_OUT_PASS * 100)}% and the unit moves to your reviews.`, 'Start'))) return;
    P.testOut(id, res => {
      if (!res) return;
      toast(res.passed ? `${res.pct}%: passed! ${plural(res.n, 'item')} moved to reviews` : `${res.pct}%: not quite. Learn this one with lessons.`, 3500);
      unit(root, id, tab);
    });
  });
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

// Everything searchable about a grammar point, lowercased; accents removed unless keepAccents
// (used for queries typed with accents, so “chưa” = yet doesn't also find “chua” = sour).
function grammarSearchText(g, u, keepAccents = false) {
  const parts = [g.title, g.explain, g.pattern || '', ...(g.table || []).flat(), ...g.examples.flat(), u.title, u.vi];
  const text = parts.join(' ').normalize('NFC').toLowerCase().replace(/\s+/g, ' ');
  return keepAccents ? text : stripAll(text);
}

// ── GRAMMAR GUIDE ───────────────────────────────────────────────────────────
export function grammar(root) {
  const course = C.get(), cards = C.cards();
  root.innerHTML = `${header('Grammar guide', { back: '#/learn', sub: 'Ngữ pháp' })}
  <div class="page">
    <input class="search g-search" type="search" placeholder="Search grammar: là, chưa, “already”…" aria-label="Search grammar" autocomplete="off" autocorrect="off" autocapitalize="off">
    <p class="muted small g-intro">Each point is taught inside its unit’s first lesson, then comes back in your reviews. Tap one to read it or practice.</p>
    ${course.sections.map(sec => {
      const pts = course.units.filter(u => u.section === sec).flatMap(u => C.unitItems(u.id).filter(i => i.kind === 'grammar').map(i => ({ i, u })));
      if (!pts.length) return '';
      return `<section class="g-sec"><h2 class="section-title">${esc(sec)}</h2><ul class="word-list">${pts.map(({ i, u }) => `
        <li class="word-row g-link" data-href="#/unit/${u.id}/grammar" data-id="${i.id}" data-q="${esc(grammarSearchText(i.point, u))}" data-qa="${esc(grammarSearchText(i.point, u, true))}">
          <span class="dot ${!cards[i.id] ? 'new' : isMastered(cards[i.id]) ? 'mastered' : 'learning'}"></span>
          <div class="grow"><b>${esc(i.point.title)}</b><div class="muted small">${u.icon} ${esc(u.title)}</div><div class="small g-hit hidden" lang="vi"></div></div>${icon('chevron')}
        </li>`).join('')}</ul></section>`;
    }).join('')}
    <p class="muted small center g-empty hidden">No grammar points match. Try a Vietnamese word without accents, like “chua”.</p>
  </div>`;
  wireHeader(root);
  // Search title, explanation, pattern, table and examples, with or without accents. When the match
  // is in an example sentence, show that sentence under the title.
  const input = $('.g-search', root);
  input.oninput = () => {
    const raw = input.value.trim().normalize('NFC').toLowerCase(), plain = stripAll(raw);
    const accented = raw !== plain, q = accented ? raw : plain;
    const norm = t => (accented ? t.normalize('NFC').toLowerCase() : stripAll(t).toLowerCase());
    let shown = 0;
    $$('.g-link', root).forEach(li => {
      const ok = !q || (accented ? li.dataset.qa : li.dataset.q).includes(q);
      li.classList.toggle('hidden', !ok); if (ok) shown++;
      const hit = $('.g-hit', li);
      const ex = q && ok && C.item(li.dataset.id).point.examples.find(([v, en]) => norm(`${v} ${en}`).includes(q));
      hit.textContent = ex ? `${ex[0]} — ${ex[1]}` : ''; hit.classList.toggle('hidden', !ex);
    });
    $$('.g-sec', root).forEach(sec => sec.classList.toggle('hidden', !$$('.g-link:not(.hidden)', sec).length));
    $('.g-intro', root).classList.toggle('hidden', !!q);
    $('.g-empty', root).classList.toggle('hidden', shown > 0);
  };
  $$('.g-link', root).forEach(li => li.onclick = () => go(li.dataset.href));
}

// ── MY WORDS ────────────────────────────────────────────────────────────────
// Your own words and phrases. They are reviewed like course items but marked "not yet checked"
// until you confirm them with family, because nothing here has been through the content checks.
export function mywords(root) {
  const list = C.myItems(), cards = C.cards();
  const fresh = list.filter(i => !cards[i.id]).length;
  root.innerHTML = `${header('My words', { back: '#/learn', sub: 'Từ của tôi' })}
  <div class="page">
    <section class="card">
      <p class="muted small">Add words and phrases you hear from family. They join your reviews like any other word. Mark each one checked once someone in the family confirms it.</p>
      <div class="btn-row"><button class="btn primary add-word">+ Add a word</button>${list.length ? `<button class="btn ghost practice-mine">${fresh ? `Learn ${fresh} new` : 'Practice'}</button>` : ''}</div>
    </section>
    ${list.length ? `<ul class="word-list mine">${list.map(it => { const c = cards[it.id]; return `
      <li class="word-row" data-say="${esc(it.vi)}" data-id="${it.id}">
        <span class="dot ${!c ? 'new' : isMastered(c) ? 'mastered' : 'learning'}"></span>
        <div class="grow"><div class="vi" lang="vi">${esc(it.vi)}</div><div class="muted">${esc(it.en)}</div>
          ${it.north ? `<div class="hanoi">Hanoi: <b lang="vi">${esc(it.north)}</b></div>` : ''}${it.note ? `<div class="note">💡 ${esc(it.note)}</div>` : ''}
          <span class="chip ${it.verified ? 'ok' : 'warn'}">${it.verified ? '✓ checked with family' : 'not yet checked'}</span></div>
        <button class="icon-btn opts" aria-label="Options for ${esc(it.vi)}">${icon('more')}</button>
      </li>`; }).join('')}</ul>` : '<p class="muted center pad">Nothing yet. Tap “Add a word” the next time you hear something new.</p>'}
  </div>`;
  wireHeader(root); wireSay(root);
  $('.add-word', root).onclick = async () => { if (await editMyWord()) mywords(root); };
  $('.practice-mine', root)?.addEventListener('click', () => X.run({ steps: X.lessonSteps('my'), activity: 'lesson:my' }));
  $$('.mine .opts', root).forEach(b => b.addEventListener('click', async e => {
    e.stopPropagation();
    const w = C.myWordsMap()[b.closest('.word-row').dataset.id];
    const act = await sheet({ title: w.vi, text: w.en, stack: true, actions: [
      { label: w.verified ? 'Mark as not checked' : '✓ Checked with family', value: 'verify', kind: 'primary' },
      { label: 'Edit', value: 'edit' }, { label: 'Delete', value: 'delete', kind: 'danger' }, { label: 'Cancel', value: null }] });
    if (act === 'verify') { w.verified = !w.verified; w.edited = Date.now(); S.save(); }
    if (act === 'edit' && !(await editMyWord(w))) return;
    if (act === 'delete') {
      if (!(await confirmSheet(`Delete “${w.vi}”?`, 'Its review history is removed too.', 'Delete', 'danger'))) return;
      Object.assign(w, { deleted: true, edited: Date.now() }); delete C.cards()[w.id]; S.save();
    }
    if (act) mywords(root);
  }));
}

// Add or edit one of your own words. Warns (doesn't block) on spelling that can't be Vietnamese.
async function editMyWord(w) {
  const field = (cls, label, val = '', ph = '', viLang = false) => `<label class="field"><span>${label}</span><input class="${cls}" ${viLang ? 'lang="vi"' : ''} value="${esc(val)}" placeholder="${esc(ph)}" autocomplete="off" autocorrect="off" ${viLang ? 'autocapitalize="off" spellcheck="false"' : ''}></label>`;
  const read = wrap => ({ vi: $('.mw-vi', wrap).value.trim().normalize('NFC'), en: $('.mw-en', wrap).value.trim(), north: $('.mw-north', wrap).value.trim().normalize('NFC'), note: $('.mw-note', wrap).value.trim() });
  for (;;) {
    const v = await sheet({ title: w ? 'Edit word' : 'Add a word',
      html: `${field('mw-vi', 'Vietnamese (Saigon)', w?.vi, 'e.g. ba má', true)}${field('mw-en', 'English', w?.en, 'e.g. mom and dad')}
        ${field('mw-north', 'Hanoi word, if different (optional)', w?.north, 'e.g. bố mẹ', true)}${field('mw-note', 'Note (optional)', w?.note, 'Who says it, when…')}
        <p class="muted small mw-warn"></p>`,
      actions: [{ label: 'Cancel', value: null }, { label: 'Save', kind: 'primary', value: read }],
      onOpen: wrap => setTimeout(() => $('.mw-vi', wrap).focus(), 250) });
    if (!v) return false;
    if (!v.vi || !v.en) { toast('Add both the Vietnamese and the English'); continue; }
    const problems = [...spellingProblems(v.vi), ...(v.north ? spellingProblems(v.north) : [])];
    if (problems.length && !(await confirmSheet('Check the spelling?', `${problems.slice(0, 2).join('. ')}. Save it anyway?`, 'Save anyway'))) { w = { ...(w || {}), ...v }; continue; }
    const map = C.myWordsMap(), now = Date.now();
    if (w?.id && map[w.id]) Object.assign(map[w.id], v, { edited: now, verified: false });   // an edited word needs re-checking
    else { const id = `my-${uid()}`; map[id] = { id, ...v, verified: false, at: now, edited: now }; }
    S.save(); toast(w?.id ? 'Saved' : 'Added to My words 📝');
    return true;
  }
}

// ── WORD BANK ───────────────────────────────────────────────────────────────
export function words(root, filter = 'all') {
  const cards = C.cards(), now = Date.now();
  const learned = C.seenItems().filter(i => i.kind !== 'grammar').sort((a, b) => (cards[b.id].seen || 0) - (cards[a.id].seen || 0));
  const hidden = c => isHidden(c, now);
  const counts = { all: learned.length, learning: learned.filter(i => !isMastered(cards[i.id])).length, mastered: learned.filter(i => isMastered(cards[i.id])).length, missed: learned.filter(i => cards[i.id].lapses > 0).length, hidden: learned.filter(i => hidden(cards[i.id])).length };
  const when = c => { const d = Math.round((c.due - now) / 86400000); return c.due <= now ? 'due now' : d < 1 ? 'later today' : `in ${d}d`; };
  root.innerHTML = `${header('Word bank', { back: '#/progress', sub: `${learned.length} learned` })}
  <div class="page">
    <input class="search" type="search" placeholder="Search Vietnamese or English…" aria-label="Search words" autocomplete="off" autocorrect="off" autocapitalize="off">
    <nav class="seg filters">${[['all', 'All'], ['learning', 'Learning'], ['mastered', 'Mastered'], ['missed', 'Missed'], ['hidden', 'Hidden']].map(([k, n]) => `<button class="${k === filter ? 'on' : ''}" data-f="${k}">${n} <small>${counts[k]}</small></button>`).join('')}</nav>
    ${learned.length ? `<ul class="word-list bank">${learned.map(it => { const c = cards[it.id], u = C.unit(it.unit); return `
      <li class="word-row" data-say="${esc(it.vi)}" data-id="${it.id}" data-st="${isMastered(c) ? 'mastered' : 'learning'}${c.lapses ? ' missed' : ''}${hidden(c) ? ' hidden-card' : ''}" data-q="${esc(stripAll(`${it.vi} ${it.en} ${it.north}`).toLowerCase())}">
        <span class="dot ${isMastered(c) ? 'mastered' : 'learning'}"></span>
        <div class="grow"><div class="vi" lang="vi">${esc(it.vi)}</div><div class="muted">${esc(it.en)}</div>
          <div class="small muted">${u.icon} ${esc(u.title)} · ${c.suspended ? 'suspended' : (c.buriedUntil || 0) > now ? 'buried until tomorrow' : `review ${when(c)}`}${c.lapses ? ` · missed ×${c.lapses}` : ''}${c.leech ? ' · 🐌 leech' : ''}</div></div>
        <button class="icon-btn opts" aria-label="Options for ${esc(it.vi)}">${icon('more')}</button>
      </li>`; }).join('')}</ul><p class="muted small center empty-msg hidden">No matches.</p>`
      : `<p class="muted center pad">Words you learn in lessons will collect here.</p><a class="btn primary" href="#/learn">Start a lesson</a>`}
  </div>`;
  wireHeader(root); wireSay(root);
  const input = $('.search', root);
  const apply = () => {
    const q = stripAll(input.value.trim()).toLowerCase(), f = $('.filters .on', root).dataset.f;
    let shown = 0;
    $$('.bank .word-row', root).forEach(li => {
      const ok = (!q || li.dataset.q.includes(q)) && (f === 'all' || li.dataset.st.split(' ').includes(f === 'hidden' ? 'hidden-card' : f));
      li.classList.toggle('hidden', !ok); if (ok) shown++;
    });
    $('.empty-msg', root)?.classList.toggle('hidden', shown > 0 || !learned.length);
  };
  input.oninput = apply;
  $$('.bank .opts', root).forEach(b => b.addEventListener('click', async e => {
    e.stopPropagation();
    const act = await itemOptions(C.item(b.closest('.word-row').dataset.id));
    if (act && act !== 'report') {   // re-draw with the same filter, search and scroll
      const f = $('.filters .on', root).dataset.f, q = input.value, y = scrollY;
      words(root, f); const s2 = $('.search', root); s2.value = q; s2.dispatchEvent(new Event('input')); scrollTo(0, y);
    }
  }));
  $$('.filters button', root).forEach(b => b.onclick = () => { $$('.filters button', root).forEach(x => x.classList.remove('on')); b.classList.add('on'); apply(); });
  apply();
}

// ── REVIEW ──────────────────────────────────────────────────────────────────
export function review(root) {
  const due = C.dueItems().length, seen = C.seenItems().length, mastered = C.masteredCount();
  const cards = C.cards();
  const upcoming = Object.values(cards).filter(c => c.due > Date.now()).sort((a, b) => a.due - b.due)[0];
  const weak = C.weakItems(12);
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
    <button class="card mode" data-mode="weak" ${weak.length ? '' : 'disabled'}><span aria-hidden="true" class="mode-ico">${icon('target')}</span><div class="grow"><b>Weak spots</b><p class="muted">${weak.length ? `${plural(weak.length, 'item')} you’ve missed before${weak.some(i => cards[i.id].leech) ? ', leeches first' : ''}.` : 'Things you miss will show up here.'}</p></div>${icon('chevron')}</button>
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
        <div class="row"><div class="grow"><b class="lvl-label">${esc(C.get().levels[P.effectiveLevel(last)])}</b><p class="muted small">Placement ${new Date(last.at).toLocaleDateString()} · ${last.score}% correct</p></div><span class="chip lvl">Level ${P.effectiveLevel(last)}/3</span></div>
        ${last.weak.length ? `<p class="small"><b>Work on:</b> ${last.weak.map(esc).join(', ')}</p>` : '<p class="small">No weak spots found in the test. 🎉</p>'}
        ${rec ? `<p class="small"><b>Suggested next:</b> <a href="#/unit/${rec.id}">${rec.icon} ${esc(rec.title)}</a></p>` : ''}
        <div class="btn-row"><a class="btn ghost" href="#/diagnostics">Full results</a><a class="btn ghost" href="#/placement">Retake test</a></div>
        ${tests.length > 1 ? `<p class="muted small">History: ${tests.slice(-5).map(t => `${new Date(t.at).toLocaleDateString([], { month: 'short', day: 'numeric' })} · L${t.level} (${t.score}%)`).join(' → ')}</p>` : ''}
      ` : `<p>Take the placement test to see your level, your strongest and weakest skills, and where to start.</p><a class="btn primary" href="#/placement">Take placement test</a>`}
    </section>

    ${lessons.length ? `<section class="card"><p class="kicker">Recent lessons</p><ul class="mini-list">${lessons.map(l => `<li><a href="#/unit/${l.unit.id}">${l.unit.icon} ${esc(l.unit.title)}</a><span class="grow"></span>${l.done ? '<span class="chip ok">complete</span>' : ''}<small class="muted">${timeAgo(l.at)}</small></li>`).join('')}</ul></section>` : ''}

    ${weak.length ? `<section class="card"><p class="kicker">What you miss most</p>
      <ul class="mini-list">${weak.map(i => `<li data-say="${esc(i.vi)}"><span class="vi" lang="vi">${esc(i.vi)}</span><span class="muted grow ellip">${esc(i.en)}</span>${cards[i.id].leech ? '<span class="chip leech">🐌 leech</span>' : ''}<span class="chip warn">×${cards[i.id].lapses}</span></li>`).join('')}</ul></section>` : ''}

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
  </div>`;
  wireHeader(root);
  $('.unskip', root)?.addEventListener('click', async () => {
    if (!(await confirmSheet('Put them back into lessons?', `${plural(skipped.length, 'word')} you never reviewed will be taught again in their units.`, 'Put back'))) return;
    toast(`${plural(P.unskip(), 'word')} back in lessons`); diagnostics(root);
  });
  $('.keepskips', root)?.addEventListener('click', () => {
    // Mark them as reviewed-on-trust so they stop showing here; FSRS still checks them on schedule.
    const cards = C.cards(); skipped.forEach(id => { cards[id].placed = 'kept'; }); S.save(); diagnostics(root);
  });
}

// ── SETTINGS ────────────────────────────────────────────────────────────────
// Settings are collapsed rows like iOS Settings; tap one to open it. Only one is open at a time
// (<details name> does that natively on iOS 17.2+; the toggle handler below covers older versions).
// The open row is remembered so re-draws (after Sync now, unflagging…) don't snap it shut.
let openSection = null;
export function settings(root, section) {
  if (section) openSection = section;
  const st = S.settings();
  const vlist = voicesFor(L());
  const flags = S.get().flags;
  root.innerHTML = `${header('Settings', { back: '#/home' })}
  <div class="page">
    <details class="card set-sec" name="settings" data-sec="languages" ${openSection === 'languages' ? 'open' : ''}>
      <summary><span class="set-ico" aria-hidden="true">🌏</span><span class="grow"><b>Languages</b><small class="muted">${C.get().flag} ${esc(C.get().name)} · ${C.UPCOMING.length} more coming</small></span><span class="set-chev" aria-hidden="true">${icon('chevron')}</span></summary>
      <div class="set-body">
      <div class="lang-row on"><span class="flag">${C.get().flag}</span><div class="grow"><b>${C.get().name}</b><p class="muted small">${esc(C.get().accent)}</p></div><span class="chip ok">Active</span></div>
      ${C.UPCOMING.map(u => `<div class="lang-row"><span class="flag">${u.flag}</span><div class="grow"><b>${u.name}</b> <span class="muted">${u.native}</span><p class="muted small">${esc(u.plan)}</p></div><span class="chip">Soon</span></div>`).join('')}
      </div>
    </details>

    <details class="card set-sec" name="settings" data-sec="accent" ${openSection === 'accent' ? 'open' : ''}>
      <summary><span class="set-ico" aria-hidden="true">🗣️</span><span class="grow"><b>Accent</b><small class="muted">Saigon first · Hanoi ${st.showHanoi ? 'shown' : 'hidden'}</small></span><span class="set-chev" aria-hidden="true">${icon('chevron')}</span></summary>
      <div class="set-body">
      <label class="switch row"><span class="grow">Show Hanoi (Northern) word variants</span><input type="checkbox" class="opt-hanoi" ${st.showHanoi ? 'checked' : ''}></label>
      <p class="muted small">Lessons teach Saigon (Southern) Vietnamese first. Where Hanoi uses a different word, it’s shown underneath.</p>
      </div>
    </details>

    <details class="card set-sec" name="settings" data-sec="audio" ${openSection === 'audio' ? 'open' : ''}>
      <summary><span class="set-ico" aria-hidden="true">🔊</span><span class="grow"><b>Audio</b><small class="muted">${vlist.length ? esc((vlist.find(v => v.voiceURI === st.voiceURI) || vlist[0]).name) : 'No voice found'} · ${st.rate.toFixed(2)}×</small></span><span class="set-chev" aria-hidden="true">${icon('chevron')}</span></summary>
      <div class="set-body">
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
      </div>
    </details>

    <details class="card set-sec" name="settings" data-sec="appearance" ${openSection === 'appearance' ? 'open' : ''}>
      <summary><span class="set-ico" aria-hidden="true">🎨</span><span class="grow"><b>Appearance</b><small class="muted">${{ auto: 'Match iPhone', light: 'Light', dark: 'Dark' }[st.theme || 'auto']}</small></span><span class="set-chev" aria-hidden="true">${icon('chevron')}</span></summary>
      <div class="set-body">
      <label class="field"><span>Theme</span><select class="opt-theme">${[['auto', 'Match iPhone'], ['light', 'Light'], ['dark', 'Dark']].map(([v, n]) => `<option value="${v}" ${v === (st.theme || 'auto') ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      </div>
    </details>

    <details class="card set-sec" name="settings" data-sec="study" ${openSection === 'study' ? 'open' : ''}>
      <summary><span class="set-ico" aria-hidden="true">📚</span><span class="grow"><b>Study</b><small class="muted">${st.dailyGoal} XP a day · remember ${Math.round((st.retention || 0.9) * 100)}%</small></span><span class="set-chev" aria-hidden="true">${icon('chevron')}</span></summary>
      <div class="set-body">
      <label class="field"><span>Daily goal</span><select class="opt-goal">${[30, 60, 100, 150].map(n => `<option value="${n}" ${n === st.dailyGoal ? 'selected' : ''}>${n} XP (${{ 30: 'casual', 60: 'regular', 100: 'serious', 150: 'intense' }[n]})</option>`).join('')}</select></label>
      <label class="field"><span>Remember target</span><select class="opt-retention">${[[0.8, '80% (fewer reviews)'], [0.85, '85%'], [0.9, '90% (recommended)'], [0.95, '95% (more reviews)']].map(([v, n]) => `<option value="${v}" ${v === (st.retention || 0.9) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <p class="muted small">Reviews are scheduled with FSRS, the method modern Anki uses: each word comes back when your chance of remembering it drops to this level.</p>
      <label class="field"><span>New items per lesson</span><select class="opt-new">${[5, 8, 10, 12].map(n => `<option value="${n}" ${n === st.newPerLesson ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="switch row"><span class="grow">Haptic tap on right answers</span><input type="checkbox" class="opt-haptics" ${st.haptics !== false ? 'checked' : ''}></label>
      ${hapticsSupported() ? '' : '<p class="muted small">Needs iOS 17.4 or later on iPhone.</p>'}
      </div>
    </details>

    <details class="card set-sec" name="settings" data-sec="sync" ${openSection === 'sync' ? 'open' : ''}>
      <summary><span class="set-ico" aria-hidden="true">☁️</span><span class="grow"><b>Google Sheet sync</b><small class="muted">${st.syncUrl ? `Synced ${timeAgo(st.lastSync)}${st.syncError ? ' · ⚠️' : ''}` : 'Not connected'}</small></span><span class="set-chev" aria-hidden="true">${icon('chevron')}</span></summary>
      <div class="set-body">
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
      </div>
    </details>

    <details class="card set-sec" name="settings" data-sec="flags" ${openSection === 'flags' ? 'open' : ''}>
      <summary><span class="set-ico" aria-hidden="true">🚩</span><span class="grow"><b>Flagged items</b><small class="muted">${flags.length ? plural(flags.length, 'item') : 'None'}</small></span><span class="set-chev" aria-hidden="true">${icon('chevron')}</span></summary>
      <div class="set-body">
      ${flags.length ? `<ul class="mini-list">${flags.slice().reverse().map(f => `<li><div class="grow"><span class="vi" lang="vi">${esc(f.vi)}</span> <span class="muted">${esc(f.en)}</span>${f.note ? `<div class="small">“${esc(f.note)}”</div>` : ''}</div><button class="icon-btn unflag" data-id="${f.id}" aria-label="Remove flag">${icon('x')}</button></li>`).join('')}</ul>
        <p class="muted small">Share these with Claude to get the lesson content fixed. They also sync to the Flags tab of your Sheet.</p>`
        : '<p class="muted small">Tap 🚩 on any word or exercise that sounds off to you or your family.</p>'}
      </div>
    </details>

    <details class="card set-sec" name="settings" data-sec="data" ${openSection === 'data' ? 'open' : ''}>
      <summary><span class="set-ico" aria-hidden="true">💾</span><span class="grow"><b>Your data</b><small class="muted">Backup, Anki export, reset</small></span><span class="set-chev" aria-hidden="true">${icon('chevron')}</span></summary>
      <div class="set-body">
      <div class="btn-row wrap">
        <button class="btn ghost export">Export backup</button>
        <button class="btn ghost export-anki">Export for Anki</button>
        <label class="btn ghost import">Import backup<input type="file" accept="application/json,.json" hidden></label>
        <button class="btn danger reset">Reset progress</button>
      </div>
      </div>
    </details>
    <p class="muted small center">Motherland v${VERSION} · ${C.vocabItems().length} words & phrases · ${C.grammarItems().length} grammar points · free forever</p>
  </div>`;
  wireHeader(root);
  $$('.set-sec', root).forEach(d => d.addEventListener('toggle', () => {
    // toggle fires asynchronously; if the screen was re-drawn meanwhile (e.g. voices loaded), this
    // row is gone and must not close the new one.
    if (!d.isConnected) return;
    if (d.open) {
      openSection = d.dataset.sec;
      $$('.set-sec[open]', root).forEach(o => { if (o !== d) o.open = false; });
      if (d.getBoundingClientRect().top < 80) d.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } else if (openSection === d.dataset.sec) openSection = null;
  }));
  const set = (k, v) => { st[k] = v; S.save(); };
  $('.opt-hanoi', root).onchange = e => set('showHanoi', e.target.checked);
  $('.opt-force', root).onchange = e => set('forceAudio', e.target.checked);
  $('.opt-haptics', root).onchange = e => { set('haptics', e.target.checked); tick(); };   // feel it once when turned on
  $('.opt-voice', root)?.addEventListener('change', e => set('voiceURI', e.target.value));
  $('.opt-rate', root).oninput = e => { $('.rate-val', root).textContent = `${(+e.target.value).toFixed(2)}×`; set('rate', +e.target.value); };
  $('.test-voice', root).onclick = () => say('Xin chào! Chúc bạn một ngày vui vẻ.');
  $('.opt-goal', root).onchange = e => set('dailyGoal', +e.target.value);
  $('.opt-new', root).onchange = e => set('newPerLesson', +e.target.value);
  $('.opt-retention', root).onchange = e => set('retention', +e.target.value);
  $('.opt-theme', root).onchange = e => { set('theme', e.target.value); applyTheme(); };
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
  $('.export', root).onclick = exportBackup;
  $('.export-anki', root).onclick = () => {
    const learned = C.seenItems();
    if (!learned.length) { toast('Learn some words first'); return; }
    download(`motherland-anki-${dayKey()}.txt`, ankiText(learned, C.cards()), 'text/plain');
    toast(`${learned.filter(i => i.kind !== 'grammar').length} items exported. In Anki: File → Import.`, 3500);
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
