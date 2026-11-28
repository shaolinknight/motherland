// Word bank.
import * as C from '../course.js';
import { $, $$, esc } from '../util.js';
import { icon } from '../icons.js';
import { isMastered, isHidden } from '../srs.js';
import { itemOptions } from '../ui.js';
import { stripAll } from '../vitext.js';
import { say, wireSay, header, wireHeader, statusDot, statusLegend } from './shared.js';

// ── WORD BANK ───────────────────────────────────────────────────────────────
export function words(root, filter = 'all') {
  const cards = C.cards(), now = Date.now();
  const learned = C.seenItems().filter(i => i.kind !== 'grammar').sort((a, b) => (cards[b.id].seen || 0) - (cards[a.id].seen || 0));
  const hidden = c => isHidden(c, now);
  const counts = { all: learned.length, learning: learned.filter(i => !isMastered(cards[i.id])).length, mastered: learned.filter(i => isMastered(cards[i.id])).length, missed: learned.filter(i => cards[i.id].lapses > 0).length, hidden: learned.filter(i => hidden(cards[i.id])).length };
  const when = c => { const d = Math.round((c.due - now) / 86400000); return c.due <= now ? 'due now' : d < 1 ? 'later today' : `in ${d}d`; };
  root.innerHTML = `${header('Word bank', { back: '#/learn', sub: `${learned.length} learned` })}
  <div class="page">
    <input class="search" type="search" placeholder="Search Vietnamese or English…" aria-label="Search words" autocomplete="off" autocorrect="off" autocapitalize="off">
    <nav class="seg filters">${[['all', 'All'], ['learning', 'Learning'], ['mastered', 'Mastered'], ['missed', 'Missed'], ['hidden', 'Hidden']].map(([k, n]) => `<button class="${k === filter ? 'on' : ''}" data-f="${k}">${n} <small>${counts[k]}</small></button>`).join('')}</nav>
    ${statusLegend(['learning', 'mastered'])}
    ${learned.length ? `<ul class="word-list bank">${learned.map(it => { const c = cards[it.id], u = C.unit(it.unit); return `
      <li class="word-row" data-say="${esc(it.vi)}" data-id="${it.id}" data-st="${isMastered(c) ? 'mastered' : 'learning'}${c.lapses ? ' missed' : ''}${hidden(c) ? ' hidden-card' : ''}" data-q="${esc(stripAll(`${it.vi} ${it.en} ${it.north}`).toLowerCase())}">
        ${statusDot(isMastered(c) ? 'mastered' : 'learning')}
        <div class="grow"><div class="vi" lang="vi">${esc(it.vi)}</div><div class="muted">${esc(it.en)}${it.edited ? ' <span class="edited-mark">✏️ edited</span>' : ''}</div>
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
