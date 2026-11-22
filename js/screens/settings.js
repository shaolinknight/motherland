// Settings (collapsed rows, one open at a time).
import * as C from '../course.js';
import * as S from '../store.js';
import { sync } from '../sync.js';
import { voicesFor } from '../speech.js';
import { $, $$, esc, toast, dayKey, timeAgo, uid } from '../util.js';
import { icon } from '../icons.js';
import { confirmSheet, undoToast } from '../ui.js';
import { ankiText } from '../ankiexport.js';
import { isPreview, resetDemo } from '../demo.js';
import { applyTheme } from '../theme.js';
import { hapticsSupported, tick } from '../haptics.js';
import { CAP_CHOICES } from '../planner.js';
import { VERSION, L, say, go, plural, header, wireHeader, download, exportBackup } from './shared.js';

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
    ${isPreview() ? `<details class="card set-sec" name="settings" data-sec="preview" ${openSection === 'preview' ? 'open' : ''}>
      <summary><span class="set-ico" aria-hidden="true">🧪</span><span class="grow"><b>Preview</b><small class="muted">Sample data for testing</small></span><span class="set-chev" aria-hidden="true">${icon('chevron')}</span></summary>
      <div class="set-body">
        <p class="small">This preview link started with sample progress so you can try everything: due cards, a leech, buried and suspended cards, My words, two decks, an edited card, a streak freeze, and an old over-generous placement to re-check or reset. It’s separate from your real app.</p>
        <button class="btn ghost wide reset-demo">Reset sample data</button>
      </div>
    </details>` : ''}
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
      <summary><span class="set-ico" aria-hidden="true">📚</span><span class="grow"><b>Study</b><small class="muted">${st.dailyGoal} XP a day · remember ${Math.round((st.retention || 0.9) * 100)}%${st.reviewCap ? ` · ${st.reviewCap} reviews max` : ''}</small></span><span class="set-chev" aria-hidden="true">${icon('chevron')}</span></summary>
      <div class="set-body">
      <label class="field"><span>Daily goal</span><select class="opt-goal">${[30, 60, 100, 150].map(n => `<option value="${n}" ${n === st.dailyGoal ? 'selected' : ''}>${n} XP (${{ 30: 'casual', 60: 'regular', 100: 'serious', 150: 'intense' }[n]})</option>`).join('')}</select></label>
      <label class="field"><span>Remember target</span><select class="opt-retention">${[[0.8, '80% (fewer reviews)'], [0.85, '85%'], [0.9, '90% (recommended)'], [0.95, '95% (more reviews)']].map(([v, n]) => `<option value="${v}" ${v === (st.retention || 0.9) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <p class="muted small">Reviews are scheduled with FSRS, the method modern Anki uses: each word comes back when your chance of remembering it drops to this level.</p>
      <label class="field"><span>Daily review limit</span><select class="opt-cap">${CAP_CHOICES.map(n => `<option value="${n}" ${n === (st.reviewCap || 0) ? 'selected' : ''}>${n ? `${n} reviews a day` : 'No limit (recommended)'}</option>`).join('')}</select></label>
      <p class="muted small">For busy days. Cards past the limit wait until tomorrow. A limit keeps sessions short, but a long backlog then takes longer to clear.</p>
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
      ${flags.length ? `<ul class="mini-list">${flags.slice().reverse().map(f => `<li><div class="grow"><span class="vi"${f.itemId === 'app-error' ? '' : ' lang="vi"'}>${esc(f.vi)}</span> <span class="muted">${esc(f.en)}</span>${f.note ? `<div class="small">“${esc(f.note)}”</div>` : ''}</div><button class="icon-btn unflag" data-id="${f.id}" aria-label="Remove flag">${icon('x')}</button></li>`).join('')}</ul>
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
  $('.opt-cap', root).onchange = e => set('reviewCap', +e.target.value);
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
  $$('.unflag', root).forEach(b => b.onclick = () => {
    const f = S.get().flags.find(x => x.id === b.dataset.id);
    S.get().flags = S.get().flags.filter(x => x !== f); S.forget('f', f.id); S.save(); settings(root);
    // Undo re-adds it under a new id: the old id has a tombstone a sync may already have shared.
    undoToast('Flag removed', () => S.get().flags.push({ ...f, id: uid(), synced: false }));
  });
  $('.export', root).onclick = exportBackup;
  $('.reset-demo', root)?.addEventListener('click', async () => {
    if (!(await confirmSheet('Reset sample data?', 'Everything on this preview goes back to the starting sample.', 'Reset'))) return;
    resetDemo(); toast('Sample data restored'); go('#/home');
  });
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
