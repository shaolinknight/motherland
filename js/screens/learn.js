// Learn tab: unit list, unit detail, grammar guide, My words.
import * as C from '../course.js';
import * as S from '../store.js';
import * as X from '../exercises.js';
import * as P from '../placement.js';
import { stop as stopAudio } from '../speech.js';
import { $, $$, esc, toast, uid } from '../util.js';
import { icon } from '../icons.js';
import { isMastered } from '../srs.js';
import { flagSheet, confirmSheet, itemOptions, sheet, undoToast } from '../ui.js';
import { stripAll } from '../vitext.js';
import { spellingProblems } from '../vispell.js';
import { L, say, go, wireSay, bar, plural, header, wireHeader, startLesson, statusDot, statusLegend } from './shared.js';

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
  const tabs = [['words', 'Words'], ['phrases', 'Phrases'], ...(gItems.length ? [['grammar', 'Grammar']] : []), ...(u.dialogue.length ? [['dialogue', 'Dialogue']] : []), ...(u.reading ? [['reading', 'Reading']] : [])];
  if (!tabs.some(t => t[0] === tab)) tab = 'words';
  const remaining = items.filter(i => !cards[i.id]).length;
  const newVocab = items.filter(i => i.kind !== 'grammar' && !cards[i.id]).length;
  // ⋯ per word: edit the card, add it to a deck, bury/suspend it, or report a problem.
  const flagBtn = it => `<button class="icon-btn flag-it" data-id="${it.id}" aria-label="Options for ${esc(it.vi)}: edit, report…">${it.kind === 'grammar' ? icon('flag') : icon('more')}</button>`;

  const panels = {
    words: () => `${statusLegend()}<ul class="word-list">${items.filter(i => i.kind === 'word').map(it => `
      <li class="word-row" data-say="${esc(it.vi)}">
        ${statusDot(status(it))}
        <div class="grow">
          <div class="vi" lang="vi">${esc(it.vi)}</div>
          <div class="muted">${esc(it.en)}${it.edited ? ' <span class="edited-mark">✏️ edited</span>' : ''}</div>
          ${it.north && showH ? `<div class="hanoi">Hanoi: <b lang="vi">${esc(it.north)}</b></div>` : ''}
          ${it.note ? `<div class="note small">💡 ${esc(it.note)}</div>` : ''}
        </div>${flagBtn(it)}
      </li>`).join('')}</ul>`,
    phrases: () => `<ul class="word-list">${items.filter(i => i.kind === 'phrase').map(it => `
      <li class="word-row" data-say="${esc(it.vi)}">
        ${statusDot(status(it))}
        <div class="grow"><div class="vi" lang="vi">${esc(it.vi)}</div><div class="muted">${esc(it.en)}${it.edited ? ' <span class="edited-mark">✏️ edited</span>' : ''}</div></div>${flagBtn(it)}
      </li>`).join('')}</ul>`,
    grammar: () => gItems.map(it => { const g = it.point; return `
      <section class="card grammar-card">
        <div class="row">${statusDot(status(it))}<h2 class="grow">${esc(g.title)}</h2>${flagBtn(it)}</div>
        <p>${esc(g.explain)}</p>
        ${g.pattern ? `<div class="pattern">${esc(g.pattern)}</div>` : ''}
        ${g.table ? X.grammarTable(g.table) : ''}
        ${X.exampleRows(g.examples)}
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
    </section>
    <details class="card tip" ${p.learned ? '' : 'open'}><summary>💡 Culture & usage note</summary><p>${esc(u.tip)}</p></details>
    <nav class="seg" role="tablist">${tabs.map(([k, n]) => `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</nav>
    <div class="panel">${panels[tab]()}</div>
  </div>
  <div class="action-bar">
    <button class="btn primary learn-new">${remaining ? (newVocab ? `Learn ${Math.min(newVocab, S.settings().newPerLesson)} new` : 'Learn the grammar') : 'Practice unit'}</button>
    ${p.learned && remaining ? `<button class="btn ghost practice">Practice</button>` : ''}
    ${remaining && !p.learned ? `<button class="btn ghost test-out">Test out</button>` : ''}
  </div>`;
  root.querySelector('.page').classList.add('has-action');
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
  $$('.flag-it', root).forEach(b => b.onclick = async e => {
    e.stopPropagation();
    const it = C.item(b.dataset.id);
    if (it.kind === 'grammar') { flagSheet(it); return; }
    if (await itemOptions(it)) { const y = scrollY; unit(root, id, tab); scrollTo(0, y); }
  });
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
          ${statusDot(!cards[i.id] ? 'new' : isMastered(cards[i.id]) ? 'mastered' : 'learning')}
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
        ${statusDot(!c ? 'new' : isMastered(c) ? 'mastered' : 'learning')}
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
    if (act === 'verify') {
      w.verified = !w.verified; w.edited = Date.now(); S.save();
      undoToast(w.verified ? 'Marked as checked ✓' : 'Marked as not checked', () => { w.verified = !w.verified; w.edited = Date.now(); });
    }
    if (act === 'edit' && !(await editMyWord(w))) return;
    if (act === 'delete') {
      if (!(await confirmSheet(`Delete “${w.vi}”?`, 'Its review history is removed too.', 'Delete', 'danger'))) return;
      Object.assign(w, { deleted: true, edited: Date.now() }); delete C.cards()[w.id]; S.forget('c', w.id); S.save();
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
