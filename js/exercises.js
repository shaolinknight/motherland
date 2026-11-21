// Exercise types + the full-screen session runner used by lessons, reviews,
// endless mode and the placement test.
import * as C from './course.js';
import * as S from './store.js';
import { newCard, grade as srsGrade } from './srs.js';
import { speak, audioAvailable, canRecord, record, stop as stopAudio } from './speech.js';
import { compare, syllableDiff, toneVariants, toneOf, TONE_NAMES, tokens, clean } from './vitext.js';
import { $, $$, esc, shuffle, sample, pick, toast, pct } from './util.js';
import { tick } from './haptics.js';
import { icon } from './icons.js';
import { flagSheet, confirmSheet, fitToViewport, dismissLayer, trapFocus } from './ui.js';

const L = () => C.get().speechLang;
const hasAudio = () => audioAvailable(L());
const PUNCT = /[.,!?“”"]/g;

// ── Step makers ─────────────────────────────────────────────────────────────
export const intro = item => ({ type: 'intro', item });
export const flash = item => item.kind === 'grammar' ? gdrill(item) : ({ type: 'flash', item });
export const speakStep = item => ({ type: 'speak', item, skill: 'speaking' });

// Key words of an English gloss, used to keep near-synonyms out of the answer choices
// (e.g. “mom” vs “mom (South) / cheek”, “large bowl” vs “small rice bowl”).
const STOP = new Set(['a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'for', 'and', 'or', 'you', 'i', 'it', 'is', 'be', 'with', 'your', 'my', 'me', 'up', 'out', 'go', 'get', 'do', 'have', 'used', 'said', 'south', 'north', 'please', 'very', 'so', 'one']);
const keyWords = en => new Set(String(en).toLowerCase().replace(/\(.*?\)/g, ' ').split(/[^a-z’']+/).filter(w => w.length > 2 && !STOP.has(w)));
export function clash(a, b) {
  if (clean(a.vi) === clean(b.vi) || clean(a.en) === clean(b.en)) return true;
  const ka = keyWords(a.en); for (const w of keyWords(b.en)) if (ka.has(w)) return true;
  return false;
}

function distractors(item, field, n = 3) {
  const same = C.all().filter(i => i.kind === item.kind && i.id !== item.id && !clash(i, item) && !(item.unit !== 'u00' && i.unit === 'u00'));
  const near = same.filter(i => i.unit === item.unit);
  const pool = shuffle(near).concat(shuffle(same.filter(i => i.unit !== item.unit)));
  const out = [], seen = new Set([clean(item[field])]);
  for (const i of pool) {
    const k = clean(i[field]);
    if (!seen.has(k) && !out.some(o => clash(o, i))) { seen.add(k); out.push(i); }
    if (out.length === n) break;
  }
  return out;
}

export function mcq(item, dir = 'vi2en') {
  const field = dir === 'en2vi' ? 'vi' : 'en';
  const opts = shuffle([item, ...distractors(item, field)]);
  const skill = dir === 'audio2en' ? 'listening' : dir === 'en2vi' ? 'vocab' : item.kind === 'phrase' ? 'reading' : 'vocab';
  return { type: 'mcq', dir, item, options: opts.map(o => ({ id: o.id, text: o[field] })), answer: item.id, skill };
}

// Pick a toned syllable from the item and offer its tone variants.
export function tone(item) {
  if (item.kind === 'grammar') return null;
  const syls = tokens(item.vi).map(s => s.replace(PUNCT, '')).filter(s => toneVariants(s)?.length >= 4);
  if (!syls.length) return null;
  const syl = pick(syls);
  const variants = toneVariants(syl);
  const opts = sample(variants.filter(v => v !== syl), 3).concat(syl);
  return { type: 'tone', item, syl, options: shuffle(opts), skill: 'tones' };
}

function buildStep(item, sentence, en, skill) {
  const toks = tokens(sentence).map(t => t.replace(PUNCT, '')).filter(Boolean);
  if (toks.length < 3 || toks.length > 12) return null;
  return { type: 'build', item, vi: sentence, en, tiles: shuffle(toks.map((t, i) => ({ t, i }))), target: toks.join(' '), skill };
}
export const build = item => buildStep(item, item.vi, item.en, 'reading');
export const dictation = item => ({ type: 'dict', item, skill: 'listening' });

// ── Grammar ────────────────────────────────────────────────────────────────
export const gexplain = item => ({ type: 'gexplain', item });
export function gdrill(item, index) {
  const drills = item.point.drills;
  const d = drills[index ?? Math.floor(Math.random() * drills.length)];
  if (d[0] === 'fill') return { type: 'gfill', item, sent: d[1], options: shuffle(d[2]), answer: d[3], en: d[4], skill: 'grammar' };
  if (d[0] === 'choose') return { type: 'gchoose', item, en: d[1], options: shuffle(d[2].map((t, i) => ({ t, ok: i === d[3] }))), skill: 'grammar' };
  return buildStep(item, d[1], d[2], 'grammar');
}
export const grammarDrills = item => shuffle(item.point.drills.map((_, i) => gdrill(item, i)).filter(Boolean));

// Choose a varied exercise for an item. round 1 = recognise, round 2+ = produce.
export function choose(item, round = 2) {
  if (item.kind === 'grammar') return gdrill(item) || gdrill(item, 0);
  const audio = hasAudio();
  if (round === 1) return mcq(item, audio && item.kind === 'word' && Math.random() < 0.3 ? 'audio2en' : 'vi2en');
  const opts = [];
  if (item.kind === 'word') {
    opts.push(() => mcq(item, 'en2vi'), () => mcq(item, 'vi2en'));
    opts.push(() => tone(item));
    if (audio) opts.push(() => mcq(item, 'audio2en'), () => dictation(item));
  } else {
    opts.push(() => build(item), () => build(item), () => mcq(item, 'vi2en'));
    if (audio && tokens(item.vi).length <= 7) opts.push(() => dictation(item));
  }
  for (const fn of shuffle(opts)) { const s = fn(); if (s) return s; }
  return mcq(item, 'vi2en');
}

// ── Session builders ────────────────────────────────────────────────────────
export function lessonSteps(unitId) {
  const list = C.unitItems(unitId);
  const cards = C.cards();
  const fresh = list.filter(i => i.kind !== 'grammar' && !cards[i.id]).slice(0, S.settings().newPerLesson || 8);
  const freshGrammar = list.filter(i => i.kind === 'grammar' && !cards[i.id]);
  if (!fresh.length && !freshGrammar.length) return practiceSteps(list, 12);
  const steps = [];
  for (let g = 0; g < fresh.length; g += 4) {
    const grp = fresh.slice(g, g + 4);
    grp.forEach(i => steps.push(intro(i)));
    shuffle(grp).forEach(i => steps.push(choose(i, 1)));
  }
  // Grammar spotlight sits between recognising and producing the new words.
  freshGrammar.forEach(gi => { steps.push(gexplain(gi)); steps.push(...grammarDrills(gi)); });
  shuffle(fresh).forEach(i => steps.push(choose(i, 2)));
  if (!fresh.length) steps.push(...practiceSteps(list.filter(i => i.kind !== 'grammar' && cards[i.id]), 6));
  if (hasAudio() && fresh.length) sample(fresh, Math.min(2, fresh.length)).forEach(i => steps.push(speakStep(i)));
  return steps.filter(Boolean);
}

export function grammarSteps(item) {
  return [...(C.card(item.id) ? [] : [gexplain(item)]), ...grammarDrills(item)];
}

export function practiceSteps(list, n = 12) {
  return sample(list, Math.min(n, list.length)).map(i => choose(i, 2)).filter(Boolean);
}

const byDue = (a, b) => C.card(a.id).due - C.card(b.id).due;
export const reviewSteps = (limit = 20) => C.dueItems().sort(byDue).slice(0, limit).map(i => choose(i, 2)).filter(Boolean);
export const flashSteps = (limit = 30) => C.dueItems().sort(byDue).slice(0, limit).map(flash).filter(Boolean);

// Endless: due first, then learned items weighted toward ones you miss.
export function endlessNext() {
  const due = C.dueItems();
  if (due.length) return choose(pick(due), 2);
  const seen = C.seenItems();
  if (!seen.length) return null;
  const weighted = seen.flatMap(i => Array(1 + Math.min(4, C.card(i.id).lapses)).fill(i));
  return choose(pick(weighted), 2);
}

// ── Runner ──────────────────────────────────────────────────────────────────
// opts: { steps, endless, test, onFinish(result), activity, emptyMsg }
export function run(opts) {
  const s = {
    ...opts, queue: (opts.steps || []).filter(Boolean), i: 0, done: 0, c: 0, t: 0, xp: 0,
    start: Date.now(), retried: new Set(), results: [], learned: 0, missed: [],
  };
  if (s.endless && !s.queue.length) { const n = endlessNext(); if (n) s.queue.push(n); }
  if (!s.queue.length) { toast(s.emptyMsg || 'Nothing to practice yet. Start a lesson first!'); return; }

  const root = document.createElement('div');
  root.className = 'session';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', s.test ? 'Placement test' : s.endless ? 'Endless review' : 'Practice session');
  root.innerHTML = `
    <header class="s-head">
      <button class="icon-btn s-close" aria-label="Close">${icon('x')}</button>
      <div class="s-progress"><div class="s-bar"></div></div>
      <button class="icon-btn s-flag" aria-label="Report a problem with this item">${icon('flag')}</button>
    </header>
    <main class="s-body" tabindex="-1"></main>
    <footer class="s-foot"></footer>`;
  document.body.appendChild(root);
  document.body.classList.add('no-scroll');
  s.root = root;
  s.unfit = fitToViewport(root);
  s.release = trapFocus(root, $('.s-body', root), () => $('.s-close', root).click());
  $('.s-close', root).onclick = () => {
    if (s.finished) { close(s); s.onFinish && s.onFinish(s.out); return; }   // X on the results screen
    (s.done && !s.test) || s.endless ? finish(s) : confirmClose(s);
  };
  $('.s-flag', root).onclick = () => { const st = s.queue[s.i]; st?.item && flagSheet(st.item); };
  render(s);
}

async function confirmClose(s) {
  if (s.done === 0 || await confirmSheet(s.test ? 'Stop the test?' : 'Leave this session?', s.test ? 'Your answers so far won’t be scored.' : 'Progress so far is saved.', 'Leave', 'danger')) finish(s, true);
}

function progress(s) {
  const bar = $('.s-bar', s.root);
  // scaleX (not width) so the bar animates on the compositor.
  if (s.endless) { bar.parentElement.dataset.label = `${s.done} done · ${pct(s.c, s.t)}%`; bar.style.transform = 'none'; bar.classList.add('endless'); return; }
  bar.style.transform = `scaleX(${(s.i / s.queue.length).toFixed(3)})`;
}

function render(s) {
  stopAudio();
  const st = s.queue[s.i];
  const body = $('.s-body', s.root), foot = $('.s-foot', s.root);
  foot.className = 's-foot'; foot.innerHTML = '';
  delete body.dataset.locked;   // each step starts unlocked (the body element is reused)
  progress(s);
  $('.s-flag', s.root).style.visibility = st.item ? 'visible' : 'hidden';
  RENDER[st.type](s, st, body, foot);
  body.scrollTop = 0;
  body.classList.remove('step-in'); void body.offsetWidth; body.classList.add('step-in');
  // Screen readers: start reading the new step (unless the step focused its own input).
  if (!body.contains(document.activeElement)) body.focus({ preventScroll: true });
}

function audioBtn(text, big = false) {
  if (!hasAudio()) return '';
  return `<button class="audio-btn ${big ? 'big' : ''}" data-say="${esc(text)}" aria-label="Play audio">${icon('speaker')}</button>
          <button class="audio-btn slow" data-say="${esc(text)}" data-rate="0.55" aria-label="Play slowly">🐢</button>`;
}
function wireAudio(root) {
  $$('[data-say]', root).forEach(b => b.onclick = () => speak(b.dataset.say, L(), b.dataset.rate ? { rate: +b.dataset.rate } : {}));
}
function hanoiLine(item) {
  if (!item.north || !S.settings().showHanoi) return '';
  return `<div class="hanoi">Hanoi: <b lang="vi">${esc(item.north)}</b></div>`;
}
const idkBtn = (s, attr) => s.test ? `<button class="option idk" ${attr}="__idk">I don’t know</button>` : '';

// ── Grading ─────────────────────────────────────────────────────────────────
function answer(s, st, result) {           // result: 'right' | 'close' | 'wrong'
  const correct = result !== 'wrong';
  s.t++; if (correct) s.c++;
  s.results.push({ skill: st.skill, level: st.item?.level, unit: st.item?.unit, correct, id: st.item?.id });
  if (!correct && st.item && !s.missed.includes(st.item)) s.missed.push(st.item);
  if (!s.test && st.skill) {
    S.recordAnswer(st.skill, correct);
    if (correct) s.xp += 10;
  }
  if (!s.test && st.item) {
    const cards = C.cards();
    const prev = cards[st.item.id] || newCard();
    cards[st.item.id] = srsGrade(prev, result === 'right' ? 2 : result === 'close' ? 1 : 0);
  }
  // Missed items come back once at the end with a different exercise.
  if (!correct && !s.test && !s.endless && st.item && !s.retried.has(st.item.id)) {
    s.retried.add(st.item.id);
    const again = choose(st.item, 2); if (again) s.queue.push(again);
  }
  S.save();
  if (correct && !s.test) tick();   // one pulse type, only for right answers (silent during the placement test)
}

function feedback(s, foot, result, html = '') {
  if (s.test) { setTimeout(() => next(s), 120); return; }
  const cls = result === 'wrong' ? 'bad' : 'good';
  const msg = result === 'right' ? pick(['Đúng rồi! 🎉', 'Giỏi quá!', 'Chính xác!', 'Tuyệt vời!']) : result === 'close' ? 'Almost — check the tones' : 'Not quite';
  foot.className = `s-foot fb ${cls}`;
  foot.innerHTML = `<div class="fb-msg"><strong>${msg}</strong>${html}</div><button class="btn primary next">Continue</button>`;
  const b = $('.next', foot); b.focus({ preventScroll: true }); b.onclick = () => next(s);
}

function next(s) {
  if (s.finished) return;
  s.i++; s.done++;
  if (s.endless && s.i >= s.queue.length) { const n = endlessNext(); if (n) s.queue.push(n); }
  if (s.i >= s.queue.length) return finish(s);
  render(s);
}

function finish(s, early = false) {
  if (s.finished) return;
  s.finished = true;
  stopAudio();
  const ms = Date.now() - s.start;
  if (!s.test) {
    S.addTime(ms);
    if (s.done) S.logSession(s.activity || 'practice', { ms, xp: s.xp, c: s.c, t: s.t });
    S.save();
  }
  const out = s.out = { c: s.c, t: s.t, xp: s.xp, ms, results: s.results, early, learned: s.learned };
  if (s.test) { close(s); s.onFinish && s.onFinish(out); return; }
  if (!s.done) { close(s); return; }
  const body = $('.s-body', s.root), foot = $('.s-foot', s.root);
  $('.s-bar', s.root).style.transform = 'none';
  $('.s-flag', s.root).style.visibility = 'hidden';
  const acc = pct(s.c, s.t);
  const missed = s.missed.filter(i => i.kind !== 'grammar').slice(0, 8);
  body.innerHTML = `
    <div class="finish">
      <div aria-hidden="true" class="finish-star">${acc >= 80 ? '🌟' : acc >= 50 ? '⭐' : '💪'}</div>
      <h2>${acc >= 80 ? 'Xuất sắc!' : acc >= 50 ? 'Làm tốt lắm!' : 'Cố lên!'}</h2>
      <p class="muted">${acc >= 80 ? 'Excellent work.' : acc >= 50 ? 'Nice job — keep going.' : 'Every miss is a word you’ll see again soon.'}</p>
      <div class="stat-row">
        <div class="stat"><b>${acc}%</b><span>accuracy</span></div>
        <div class="stat"><b>+${s.xp}</b><span>XP</span></div>
        <div class="stat"><b>${Math.max(1, Math.round(ms / 60000))}</b><span>min</span></div>
        ${s.learned ? `<div class="stat"><b>${s.learned}</b><span>new</span></div>` : ''}
      </div>
      ${missed.length ? `<div class="missed card"><p class="kicker">Review these</p>${missed.map(i => `<div class="missed-row" data-say="${esc(i.vi)}"><b lang="vi">${esc(i.vi)}</b><span class="muted">${esc(i.en)}</span></div>`).join('')}</div>` : ''}
    </div>`;
  wireAudio(body);
  foot.className = 's-foot';
  foot.innerHTML = `<button class="btn primary done">Done</button>`;
  $('.done', foot).onclick = () => { close(s); s.onFinish && s.onFinish(out); };
}

function close(s) {
  s.unfit && s.unfit();
  s.release && s.release();
  dismissLayer(s.root);
  document.body.classList.remove('no-scroll');
  window.dispatchEvent(new Event('motherland:refresh'));
}

function markIntroduced(s, it, xp = 2) {
  const cards = C.cards();
  if (!cards[it.id]) { cards[it.id] = newCard(); s.learned++; S.day().words++; S.addXP(xp); s.xp += xp; S.save(); }
}

function lockOnce(body) { if (body.dataset.locked) return false; body.dataset.locked = '1'; return true; }

// ── Renderers ───────────────────────────────────────────────────────────────
const RENDER = {
  intro(s, st, body, foot) {
    const it = st.item;
    body.innerHTML = `
      <p class="kicker">${it.kind === 'word' ? 'New word' : 'New phrase'}</p>
      <div class="card hero-card">
        <div class="vi big" lang="vi">${esc(it.vi)}</div>
        <div class="audio-row">${audioBtn(it.vi, true)}</div>
        <div class="en">${esc(it.en)}</div>
        ${hanoiLine(it)}
        ${it.note ? `<div class="note">💡 ${esc(it.note)}</div>` : ''}
      </div>`;
    wireAudio(body);
    if (hasAudio()) setTimeout(() => speak(it.vi, L()), 250);
    foot.innerHTML = `<button class="btn primary">Got it</button>`;
    $('button', foot).onclick = () => { markIntroduced(s, it); next(s); };
  },

  gexplain(s, st, body, foot) {
    const it = st.item, g = it.point;
    body.innerHTML = `
      <p class="kicker">Grammar spotlight</p>
      <div class="card grammar-card">
        <h2>${esc(g.title)}</h2>
        <p>${esc(g.explain)}</p>
        ${g.pattern ? `<div class="pattern">${esc(g.pattern)}</div>` : ''}
        ${g.table ? grammarTable(g.table) : ''}
        <div class="examples">${g.examples.map(([v, en]) => `<button class="ex-row" data-say="${esc(v)}"><b lang="vi">${esc(v)}</b><span class="muted">${esc(en)}</span></button>`).join('')}</div>
      </div>`;
    wireAudio(body);
    foot.innerHTML = `<button class="btn primary">Got it — let’s practice</button>`;
    $('button', foot).onclick = () => { markIntroduced(s, it, 5); next(s); };
  },

  gfill(s, st, body, foot) {
    const [a, b] = st.sent.split('___');
    const full = `${a}${st.answer}${b}`;
    body.innerHTML = `
      <p class="kicker">Grammar · fill the gap</p>
      <div class="prompt en-prompt">${esc(st.en)}</div>
      <div class="prompt vi big gap-sent" lang="vi">${esc(a)}<span class="gap">___</span>${esc(b)}</div>
      <div class="options grid-auto">${st.options.map(o => `<button class="option center" data-v="${esc(o)}" lang="vi">${esc(o)}</button>`).join('')}${idkBtn(s, 'data-v')}</div>`;
    $$('.option', body).forEach(btn => btn.onclick = () => {
      if (!lockOnce(body)) return;
      const ok = btn.dataset.v === st.answer;
      if (!s.test) {
        btn.classList.add(ok ? 'right' : 'wrong');
        $$('.option', body).find(x => x.dataset.v === st.answer)?.classList.add('right');
        const gap = $('.gap', body); gap.textContent = st.answer; gap.classList.add(ok ? 'ok' : 'fix');
      }
      answer(s, st, ok ? 'right' : 'wrong');
      feedback(s, foot, ok ? 'right' : 'wrong', `<div class="fb-ans" lang="vi">${esc(full)}</div><div class="fb-sub">${esc(st.item.en)}</div>`);
      if (!s.test && hasAudio()) speak(full, L());
    });
  },

  gchoose(s, st, body, foot) {
    body.innerHTML = `
      <p class="kicker">Grammar · which is correct?</p>
      <div class="prompt en-prompt">${esc(st.en)}</div>
      <div class="options">${st.options.map((o, i) => `<button class="option" data-i="${i}" lang="vi">${esc(o.t)}</button>`).join('')}${idkBtn(s, 'data-i')}</div>`;
    $$('.option', body).forEach(btn => btn.onclick = () => {
      if (!lockOnce(body)) return;
      const ok = btn.dataset.i !== '__idk' && st.options[+btn.dataset.i].ok;
      const right = st.options.find(o => o.ok);
      if (!s.test) { btn.classList.add(ok ? 'right' : 'wrong'); $$('.option', body)[st.options.indexOf(right)].classList.add('right'); }
      answer(s, st, ok ? 'right' : 'wrong');
      feedback(s, foot, ok ? 'right' : 'wrong', `<div class="fb-ans" lang="vi">${esc(right.t)}</div><div class="fb-sub">${esc(st.item.en)}</div>`);
    });
  },

  mcq(s, st, body, foot) {
    const it = st.item;
    const prompt = st.dir === 'audio2en'
      ? `<p class="kicker">Listen and choose the meaning</p><div class="audio-row center">${audioBtn(it.vi, true)}</div>`
      : st.dir === 'en2vi'
        ? `<p class="kicker">How do you say…</p><div class="prompt en-prompt">${esc(it.en)}</div>`
        : `<p class="kicker">What does this mean?</p><div class="prompt vi big" lang="vi">${esc(it.vi)}</div><div class="audio-row center">${audioBtn(it.vi)}</div>`;
    body.innerHTML = `${prompt}
      <div class="options">${st.options.map(o => `<button class="option" data-id="${o.id}" ${st.dir === 'en2vi' ? 'lang="vi"' : ''}>${esc(o.text)}</button>`).join('')}${idkBtn(s, 'data-id')}</div>`;
    wireAudio(body);
    if (st.dir === 'audio2en') setTimeout(() => speak(it.vi, L()), 250);
    $$('.option', body).forEach(b => b.onclick = () => {
      if (!lockOnce(body)) return;
      const ok = b.dataset.id === st.answer;
      if (!s.test) {
        b.classList.add(ok ? 'right' : 'wrong');
        $(`.option[data-id="${st.answer}"]`, body)?.classList.add('right');
      }
      answer(s, st, ok ? 'right' : 'wrong');
      feedback(s, foot, ok ? 'right' : 'wrong', `<div class="fb-ans"><span lang="vi">${esc(it.vi)}</span> — ${esc(it.en)}</div>${hanoiLine(it)}`);
    });
  },

  tone(s, st, body, foot) {
    const it = st.item;
    let swapped = false;
    const blanked = tokens(it.vi).map(t => {
      if (!swapped && t.replace(PUNCT, '') === st.syl) { swapped = true; return t.replace(st.syl, '___'); }
      return t;
    }).join(' ');
    body.innerHTML = `
      <p class="kicker">Pick the right tone</p>
      <div class="prompt en-prompt">${esc(it.en)}</div>
      <div class="prompt vi big" lang="vi">${esc(blanked)}</div>
      <div class="audio-row center">${audioBtn(it.vi)}</div>
      <div class="options grid2">${st.options.map(o => `<button class="option tone-opt" data-v="${esc(o)}" lang="vi">${esc(o)}<small>${TONE_NAMES[toneOf(o)]}</small></button>`).join('')}${idkBtn(s, 'data-v')}</div>`;
    wireAudio(body);
    $$('.option', body).forEach(b => b.onclick = () => {
      if (!lockOnce(body)) return;
      const ok = b.dataset.v === st.syl;
      if (!s.test) { b.classList.add(ok ? 'right' : 'wrong'); $$('.option', body).find(x => x.dataset.v === st.syl)?.classList.add('right'); }
      answer(s, st, ok ? 'right' : 'wrong');
      feedback(s, foot, ok ? 'right' : 'wrong', `<div class="fb-ans"><span lang="vi">${esc(it.vi)}</span> — tone: ${TONE_NAMES[toneOf(st.syl)]}</div>`);
    });
  },

  build(s, st, body, foot) {
    const picked = [];
    body.innerHTML = `
      <p class="kicker">${st.skill === 'grammar' ? 'Grammar · put it in order' : 'Build the sentence'}</p>
      <div class="prompt en-prompt">${esc(st.en)}</div>
      <div class="build-line" aria-live="polite"></div>
      <div class="tiles">${st.tiles.map(t => `<button class="tile" data-i="${t.i}" lang="vi">${esc(t.t)}</button>`).join('')}</div>`;
    const line = $('.build-line', body);
    foot.innerHTML = `<button class="btn ghost reset-tiles" disabled>Clear</button><button class="btn primary check" disabled>Check</button>`;
    const check = $('.check', foot), clear = $('.reset-tiles', foot);
    const draw = () => {
      line.innerHTML = picked.length ? picked.map((t, k) => `<button class="tile in" data-k="${k}" lang="vi">${esc(t.t)}</button>`).join('') : '<span class="placeholder">Tap the words in order</span>';
      $$('.tile.in', line).forEach(b => b.onclick = () => { const [t] = picked.splice(+b.dataset.k, 1); $(`.tiles .tile[data-i="${t.i}"]`, body).disabled = false; draw(); });
      check.disabled = picked.length !== st.tiles.length;
      clear.disabled = !picked.length;
    };
    $$('.tiles .tile', body).forEach(b => b.onclick = () => { b.disabled = true; picked.push(st.tiles.find(t => t.i === +b.dataset.i)); draw(); });
    clear.onclick = () => { picked.length = 0; $$('.tiles .tile', body).forEach(b => (b.disabled = false)); draw(); };
    draw();
    check.onclick = () => {
      const ok = clean(picked.map(t => t.t).join(' ')) === clean(st.target);
      $$('.tile', body).forEach(b => (b.disabled = true));
      answer(s, st, ok ? 'right' : 'wrong');
      feedback(s, foot, ok ? 'right' : 'wrong', `<div class="fb-ans" lang="vi">${esc(st.vi)}</div>`);
      if (hasAudio()) speak(st.vi, L());
    };
  },

  dict(s, st, body, foot) {
    const it = st.item;
    body.innerHTML = `
      <p class="kicker">Type what you hear</p>
      <div class="audio-row center">${audioBtn(it.vi, true)}</div>
      <input class="dict-input" lang="vi" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="Type in Vietnamese…" aria-label="Your answer">
      <p class="hint">No Vietnamese keyboard? Type without accents for partial credit.</p>`;
    wireAudio(body);
    setTimeout(() => speak(it.vi, L()), 250);
    foot.innerHTML = `<button class="btn ghost skip">Can’t listen now</button><button class="btn primary check">Check</button>`;
    const input = $('.dict-input', body);
    const go = () => {
      if (input.disabled) return;
      if (!input.value.trim()) { input.focus(); return; }
      input.blur();
      const r = compare(input.value, it.vi);
      const result = r === 'exact' ? 'right' : r === 'tones' || r === 'letters' ? 'close' : 'wrong';
      input.disabled = true;
      const diff = syllableDiff(input.value, it.vi).map(d => `<span class="${d.ok ? 'ok' : d.tonesOnly ? 'tone' : 'miss'}" lang="vi">${esc(d.t)}</span>`).join(' ');
      answer(s, st, result);
      feedback(s, foot, result, `<div class="fb-ans diff">${diff}</div><div class="fb-sub">${esc(it.en)}</div>`);
    };
    $('.check', foot).onclick = go;
    $('.skip', foot).onclick = () => { s.queue[s.i] = mcq(it, 'vi2en'); render(s); };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  },

  speak(s, st, body, foot) {
    const it = st.item;
    let mine = null;
    body.innerHTML = `
      <p class="kicker">Say it out loud</p>
      <div class="card hero-card">
        <div class="vi big" lang="vi">${esc(it.vi)}</div>
        <div class="en">${esc(it.en)}</div>
        <div class="audio-row">${audioBtn(it.vi, true)}</div>
      </div>
      ${canRecord() ? `<div class="rec-row">
        <button class="btn rec">${icon('mic')} Record me</button>
        <button class="btn ghost play-mine" disabled>${icon('play')} Play mine</button>
      </div><p class="hint">Listen, record yourself, then compare. Recordings stay on your phone.</p>` : `<p class="hint">Listen, repeat it out loud, then rate yourself.</p>`}`;
    wireAudio(body);
    setTimeout(() => speak(it.vi, L()), 250);
    const rec = $('.rec', body);
    if (rec) {
      let active = null;
      rec.onclick = async () => {
        if (active) { active.stop(); return; }
        try {
          stopAudio();
          active = await record(8000);
          rec.classList.add('recording'); rec.innerHTML = `${icon('stop')} Stop`;
          mine = await active.done; active = null;
          rec.classList.remove('recording'); rec.innerHTML = `${icon('mic')} Record again`;
          $('.play-mine', body).disabled = false;
        } catch { toast('Microphone not available. Allow mic access in iPhone Settings.'); active = null; }
      };
      $('.play-mine', body).onclick = () => mine && new Audio(mine).play();
    }
    foot.innerHTML = `<button class="btn ghost again">Needs practice</button><button class="btn primary good">Sounded right</button>`;
    $('.good', foot).onclick = () => { answer(s, st, 'right'); next(s); };
    $('.again', foot).onclick = () => { answer(s, st, 'close'); next(s); };
  },

  flash(s, st, body, foot) {
    const it = st.item;
    const reverse = (C.card(it.id)?.ivl || 0) >= 3 && Math.random() < 0.5;
    body.innerHTML = `
      <p class="kicker">${reverse ? 'Say it in Vietnamese' : 'Do you remember?'}</p>
      <button class="card flip-card" aria-label="Show answer">
        <div class="front">${reverse ? `<div class="en-prompt">${esc(it.en)}</div>` : `<div class="vi big" lang="vi">${esc(it.vi)}</div>`}</div>
        <div class="back hidden">
          ${reverse ? `<div class="vi big" lang="vi">${esc(it.vi)}</div>` : `<div class="en">${esc(it.en)}</div>`}
          ${hanoiLine(it)}${it.note ? `<div class="note">💡 ${esc(it.note)}</div>` : ''}
        </div>
        <span class="tap-hint">Tap to flip</span>
      </button>
      <div class="audio-row center">${audioBtn(it.vi)}</div>`;
    wireAudio(body);
    if (!reverse && hasAudio()) setTimeout(() => speak(it.vi, L()), 250);
    const card = $('.flip-card', body);
    const reveal = () => {
      if (card.classList.contains('flipped')) return;
      card.classList.add('flipped'); $('.back', card).classList.remove('hidden'); $('.tap-hint', card)?.remove();
      if (reverse && hasAudio()) speak(it.vi, L());
      foot.innerHTML = `<div class="grades">
        <button class="btn g0" data-g="0">Again</button><button class="btn g1" data-g="1">Hard</button>
        <button class="btn g2" data-g="2">Good</button><button class="btn g3" data-g="3">Easy</button></div>`;
      $$('[data-g]', foot).forEach(b => b.onclick = () => {
        if (!lockOnce(body)) return;
        const g = +b.dataset.g;
        const cards = C.cards();
        cards[it.id] = srsGrade(cards[it.id] || newCard(), g);
        s.t++; if (g > 0) { s.c++; s.xp += 10; } else if (!s.missed.includes(it)) s.missed.push(it);
        S.recordAnswer('vocab', g > 0);   // also adds the day's XP
        if (g === 0 && !s.retried.has(it.id)) { s.retried.add(it.id); s.queue.push(flash(it)); }
        S.save(); next(s);
      });
    };
    card.onclick = reveal;
    foot.innerHTML = `<button class="btn primary">Show answer</button>`;
    $('button', foot).onclick = reveal;
  },
};

export function grammarTable(rows) {
  const [head, ...rest] = rows;
  return `<div class="g-table-wrap"><table class="g-table"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rest.map(r => `<tr>${r.map((c, i) => `<td ${i ? 'lang="vi"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
