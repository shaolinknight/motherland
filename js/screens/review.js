// Review tab: review modes, custom decks, deck word picker.
import * as C from '../course.js';
import * as X from '../exercises.js';
import { $, $$, esc, toast } from '../util.js';
import { icon } from '../icons.js';
import { isMastered } from '../srs.js';
import { confirmSheet, itemOptions, sheet, askText, undoToast } from '../ui.js';
import * as D from '../decks.js';
import * as P from '../planner.js';
import { continueUnit } from '../placement.js';
import { stripAll } from '../vitext.js';
import { spellingProblems } from '../vispell.js';
import { say, go, wireSay, bar, plural, header, wireHeader, startLesson, statusDot } from './shared.js';

// ── REVIEW ──────────────────────────────────────────────────────────────────
export function review(root) {
  const dueAll = C.dueItems().length, left = P.capLeft(), due = Math.min(dueAll, left), waiting = dueAll - due;
  const seen = C.seenItems().length, mastered = C.masteredCount();
  const cards = C.cards();
  const upcoming = Object.values(cards).filter(c => c.due > Date.now()).sort((a, b) => a.due - b.due)[0];
  const weak = C.weakItems(12);
  const gSeen = C.seenItems().filter(i => i.kind === 'grammar');
  root.innerHTML = `${header('Review', { sub: 'Spaced repetition: right before you forget' })}
  <div class="page">
    ${seen ? `<section class="card stats3">
      <div class="stat"><b>${due}</b><span>due now</span></div>
      <div class="stat"><b>${seen}</b><span>learning</span></div>
      <div class="stat"><b>${mastered}</b><span>mastered</span></div>
    </section>` : `<section class="card empty-state">
      <span aria-hidden="true" class="mode-ico">${icon('cards')}</span>
      <h2>Reviews start after your first lesson</h2>
      <p class="muted">Every word you learn comes back here, right before you’d forget it.</p>
      <button class="btn primary start-first">Start a lesson</button>
    </section>`}
    ${waiting ? `<p class="muted center small cap-note">${left ? `Today’s limit leaves room for ${due}.` : 'You’ve reached today’s review limit.'} ${waiting} more waiting for tomorrow · <a href="#/settings/study">Change</a></p>` : ''}
    ${!dueAll && upcoming ? `<p class="muted center small">Next card due ${new Date(upcoming.due).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</p>` : ''}
    ${seen ? weekChart() : ''}
    ${seen ? `<button class="card mode" data-mode="flash" ${due ? '' : 'disabled'}><span aria-hidden="true" class="mode-ico">${icon('cards')}</span><div class="grow"><b>Flashcards</b><p class="muted">Flip and rate how well you knew it. Classic and fast.</p></div>${icon('chevron')}</button>
    <button class="card mode" data-mode="quiz" ${due ? '' : 'disabled'}><span aria-hidden="true" class="mode-ico">${icon('check')}</span><div class="grow"><b>Quiz review</b><p class="muted">Due cards as mixed exercises: meaning, grammar, tones, listening, typing.</p></div>${icon('chevron')}</button>
    <button class="card mode" data-mode="endless" ${seen ? '' : 'disabled'}><span aria-hidden="true" class="mode-ico">${icon('infinity')}</span><div class="grow"><b>Endless review</b><p class="muted">Keeps going as long as you want. Focuses on what you miss.</p></div>${icon('chevron')}</button>
    <button class="card mode" data-mode="grammar" ${gSeen.length ? '' : 'disabled'}><span aria-hidden="true" class="mode-ico">${icon('book')}</span><div class="grow"><b>Grammar drills</b><p class="muted">${gSeen.length ? `Mixed drills from the ${plural(gSeen.length, 'grammar point')} you’ve learned.` : 'Unlocks after your first lesson.'}</p></div>${icon('chevron')}</button>
    <button class="card mode" data-mode="weak" ${weak.length ? '' : 'disabled'}><span aria-hidden="true" class="mode-ico">${icon('target')}</span><div class="grow"><b>Weak spots</b><p class="muted">${weak.length ? `${plural(weak.length, 'item')} you’ve missed before${weak.some(i => cards[i.id].leech) ? ', hardest first' : ''}.` : 'Things you miss will show up here.'}</p></div>${icon('chevron')}</button>` : ''}
    <section class="decks-sec">
      <div class="row"><h2 class="section-title grow">Your decks</h2><button class="btn ghost small new-deck">+ New deck</button></div>
      ${D.list().length ? `<div class="deck-list">${D.list().map(d => { const st = D.stats(d.id); return `
        <a class="card link-card deck-row" href="#/deck/${d.id}"><span aria-hidden="true" class="mode-ico">🗂️</span>
          <div class="grow"><b>${esc(d.name)}</b><p class="muted small">${plural(st.total, 'card')}${st.due ? ` · ${st.due} due` : ''}${st.fresh ? ` · ${st.fresh} new` : ''}</p></div>${icon('chevron')}</a>`; }).join('')}</div>`
        : '<p class="muted small">Make your own decks: fill them with words from any unit, or write every card yourself. Study each deck on its own.</p>'}
    </section>
  </div>`;
  wireHeader(root);
  $('.new-deck', root).onclick = async () => { const name = await askText('New deck', 'Deck name', 'e.g. Wedding speech'); if (name) go(`#/deck/${D.create(name).id}`); };
  const modes = {
    flash: () => X.run({ steps: X.flashSteps(), activity: 'flashcards' }),
    quiz: () => X.run({ steps: X.reviewSteps(), activity: 'review' }),
    endless: () => X.run({ endless: true, steps: [], activity: 'endless' }),
    grammar: () => X.run({ steps: gSeen.flatMap(i => X.grammarDrills(i)).sort(() => Math.random() - 0.5).slice(0, 12), activity: 'grammar' }),
    weak: () => X.run({ steps: weak.map(i => X.choose(i, 2)), activity: 'weak' }),
  };
  $$('[data-mode]', root).forEach(b => b.onclick = () => modes[b.dataset.mode]());
  $('.start-first', root)?.addEventListener('click', () => startLesson(continueUnit().id));
}

// Reviews due on each of the next 7 days, as a small bar chart. Today includes anything overdue.
function weekChart() {
  const days = P.forecast(7), max = Math.max(1, ...days.map(d => d.n)), total = days.reduce((a, d) => a + d.n, 0);
  // One letter per day (today underlined) so labels never collide, even at the largest text sizes.
  const name = d => d.date.toLocaleDateString([], { weekday: 'narrow' });
  const full = d => (d.today ? 'today' : d.date.toLocaleDateString([], { weekday: 'long' }));
  return `<section class="card week-plan">
    <div class="row"><h2 class="section-title grow">This week</h2><span class="muted small">${plural(total, 'review')}</span></div>
    <ol class="wp-bars">${days.map(d => `<li class="${d.today ? 'today' : ''}" aria-label="${plural(d.n, 'review')} ${full(d)}">
      <span class="wp-n" aria-hidden="true">${d.n || ''}</span>
      <span class="wp-bar" aria-hidden="true"><i style="height:${d.n ? Math.max(6, Math.round(d.n / max * 100)) : 0}%"></i></span>
      <span class="wp-day" aria-hidden="true">${name(d)}</span></li>`).join('')}</ol>
    ${P.cap() ? `<p class="muted small">Limit: ${P.cap()} a day. ${P.reviewedToday()} done today.</p>` : ''}
  </section>`;
}

// ── DECK ────────────────────────────────────────────────────────────────────
export function deck(root, id, sub) {
  const d = D.get(id);
  if (!d) { go('#/review'); return; }
  if (sub === 'add') return deckPicker(root, d);
  const its = D.items(id), cards = C.cards(), st = D.stats(id);
  root.innerHTML = `${header(d.name, { back: '#/review', sub: plural(st.total, 'card') })}
  <div class="page has-action">
    <section class="card">
      <div class="stats3"><div class="stat"><b>${st.total}</b><span>cards</span></div><div class="stat"><b>${st.due}</b><span>due</span></div><div class="stat"><b>${st.fresh}</b><span>new</span></div></div>
      <div class="btn-row"><button class="btn ghost small rename">Rename</button><button class="btn danger small delete">Delete deck</button></div>
    </section>
    ${its.length ? `<ul class="word-list deck-cards">${its.map(it => { const c = cards[it.id]; return `
      <li class="word-row" data-say="${esc(it.vi)}" data-id="${it.id}">
        ${statusDot(!c ? 'new' : isMastered(c) ? 'mastered' : 'learning')}
        <div class="grow"><div class="vi" lang="vi">${esc(it.vi)}</div><div class="muted">${esc(it.en)}${it.edited ? ' <span class="edited-mark">✏️ edited</span>' : ''}</div>
          <div class="small muted">${it.mine ? '📝 your card' : `${C.unit(it.unit)?.icon || ''} ${esc(C.unit(it.unit)?.title || '')}`}</div></div>
        <button class="icon-btn opts" aria-label="Options for ${esc(it.vi)}">${icon('more')}</button>
      </li>`; }).join('')}</ul>`
      : '<p class="muted center pad">This deck is empty. Add words from the course, or write your own cards.</p>'}
  </div>
  <div class="action-bar">
    <button class="btn primary study" ${its.length ? '' : 'disabled'}>Study</button>
    <a class="btn ghost" href="#/deck/${id}/add" aria-label="Add words from the course">Add words</a>
    <button class="btn ghost write-card" aria-label="Write your own card">New card</button>
  </div>`;
  wireHeader(root); wireSay(root);
  $('.study', root).onclick = () => X.run({ steps: D.studySteps(id), activity: `deck:${id}`, emptyMsg: 'Nothing to study in this deck yet.' });
  $('.write-card', root).onclick = async () => {
    const v = await sheet({ title: 'Write a card', html: `<label class="field"><span>Front: Vietnamese</span><input class="wc-vi" lang="vi" autocapitalize="off" autocomplete="off" spellcheck="false"></label>
        <label class="field"><span>Back: English</span><input class="wc-en" autocomplete="off"></label>
        <label class="field"><span>Note (optional)</span><input class="wc-note" autocomplete="off"></label>`,
      actions: [{ label: 'Cancel', value: null }, { label: 'Add card', kind: 'primary', value: w => ({ vi: $('.wc-vi', w).value.trim().normalize('NFC'), en: $('.wc-en', w).value.trim(), note: $('.wc-note', w).value.trim() }) }],
      onOpen: w => setTimeout(() => $('.wc-vi', w).focus(), 250) });
    if (!v) return;
    if (!v.vi || !v.en) { toast('A card needs a front and a back'); return; }
    const problems = spellingProblems(v.vi);
    if (problems.length && !(await confirmSheet('Check the spelling?', `${problems.slice(0, 2).join('. ')}. Add it anyway?`, 'Add anyway'))) return;
    D.newCard(id, v); toast('Card added 📝'); deck(root, id);
  };
  $('.rename', root).onclick = async () => { const name = await askText('Rename deck', 'Deck name', '', d.name); if (name) { D.rename(id, name); deck(root, id); } };
  $('.delete', root).onclick = async () => {
    if (!(await confirmSheet(`Delete “${d.name}”?`, 'The deck goes away. The words and your review progress on them stay.', 'Delete', 'danger'))) return;
    D.remove(id); toast('Deck deleted'); go('#/review');
  };
  $$('.deck-cards .opts', root).forEach(b => b.addEventListener('click', async e => {
    e.stopPropagation();
    if (await itemOptions(C.item(b.closest('.word-row').dataset.id), { deckId: id })) { const y = scrollY; deck(root, id); scrollTo(0, y); }
  }));
}

// Pick words for a deck: search everything (accents optional), or filter by unit; tap to add/remove.
function deckPicker(root, d) {
  const all = [...C.all().filter(i => i.kind !== 'grammar'), ...C.myItems()];
  const units = C.get().units;
  root.innerHTML = `${header('Add words', { back: `#/deck/${d.id}`, sub: d.name })}
  <div class="page">
    <input class="search pick-search" type="search" placeholder="Search Vietnamese or English…" aria-label="Search words" autocomplete="off" autocorrect="off" autocapitalize="off">
    <label class="field"><span>Unit</span><select class="pick-unit"><option value="">All units</option><option value="my">📝 My words</option>${units.map(u => `<option value="${u.id}">${u.icon} ${esc(u.title)}</option>`).join('')}</select></label>
    <button class="btn ghost small add-unit hidden">Add the whole unit</button>
    <ul class="word-list pick-list"></ul>
    <p class="muted small center pick-more"></p>
  </div>`;
  wireHeader(root);
  const listEl = $('.pick-list', root), q = $('.pick-search', root), sel = $('.pick-unit', root), addUnit = $('.add-unit', root);
  const draw = () => {
    const term = stripAll(q.value.trim()).toLowerCase(), u = sel.value;
    const hits = all.filter(i => (!u || i.unit === u) && (!term || stripAll(`${i.vi} ${i.en}`).toLowerCase().includes(term)));
    addUnit.classList.toggle('hidden', !u); addUnit.textContent = `Add all ${hits.length} from this unit`;
    listEl.innerHTML = hits.slice(0, 80).map(i => { const inDeck = D.has(d.id, i.id); return `
      <li class="word-row pick-row ${inDeck ? 'in' : ''}" data-id="${i.id}">
        <div class="grow"><div class="vi" lang="vi">${esc(i.vi)}</div><div class="muted small">${esc(i.en)}</div></div>
        <span class="pick-mark" aria-hidden="true">${inDeck ? '✓' : '+'}</span>
      </li>`; }).join('');
    $('.pick-more', root).textContent = hits.length > 80 ? `Showing 80 of ${hits.length}. Search or pick a unit to narrow it down.` : hits.length ? '' : 'No matches.';
    $$('.pick-row', listEl).forEach(li => li.onclick = () => {
      const id = li.dataset.id;
      if (D.has(d.id, id)) D.removeItem(d.id, id); else D.add(d.id, [id]);
      const on = D.has(d.id, id); li.classList.toggle('in', on); $('.pick-mark', li).textContent = on ? '✓' : '+';
    });
  };
  q.oninput = draw; sel.onchange = draw;
  addUnit.onclick = () => {
    const before = [...d.items], n = D.add(d.id, all.filter(i => i.unit === sel.value).map(i => i.id)); draw();
    if (n) undoToast(`${plural(n, 'word')} added`, () => D.restoreItems(d.id, before)); else toast('Already all in the deck');
  };
  draw();
}
