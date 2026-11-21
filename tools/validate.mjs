// Motherland content validator — run: node tools/validate.mjs
// Checks every Vietnamese string against Vietnamese spelling rules so a typo
// or a wrong/double tone mark can never ship. Exit code 1 if any error.
import vi from '../data/vi.js';

const TONES = /[̣̀́̃̉]/g;     // huyền, sắc, ngã, hỏi, nặng
const ACUTE = '́', DOT = '̣';
// Loanwords / brand names / chat shorthand that are allowed as-is.
const ALLOW = new Set(['wifi', 'grab', 'size', 'ok', 'alo', 'zalo', 'messenger', 'gym', 'game', 'karaoke',
  'menu', 'm', 's', 'k', 'ko', 'dc', 'đc', 'deadline', 'marketing', 'xanh', 'sm', 'be']);
const ONSET = '(ngh|ng|nh|ch|gh|gi|kh|ph|th|tr|qu|b|c|d|đ|g|h|k|l|m|n|p|r|s|t|v|x)?';
const SYL = new RegExp('^' + ONSET + '([aăâeêioôơuưy]{1,3})(ch|ng|nh|c|m|n|p|t)?$');

const errors = [], warnings = [];
const base = s => s.normalize('NFD').replace(TONES, '').normalize('NFC');

function checkSyllable(raw, where) {
  const s = raw.toLowerCase().normalize('NFC');
  if (!s || /\d/.test(s) || ALLOW.has(s)) return;
  const nfd = s.normalize('NFD');
  const tones = nfd.match(TONES) || [];
  if (tones.length > 1) errors.push(`${where}: “${raw}” has ${tones.length} tone marks`);
  const b = base(s);
  const m = b.match(SYL);
  if (!m) { errors.push(`${where}: “${raw}” is not a valid Vietnamese syllable`); return; }
  const [, on = '', nuc, coda = ''] = m;
  // Stop endings (p, t, c, ch) only take sắc or nặng.
  if (['p', 't', 'c', 'ch'].includes(coda) && !(tones[0] === ACUTE || tones[0] === DOT))
    errors.push(`${where}: “${raw}” ends in -${coda} so it needs sắc or nặng`);
  // Spelling rules
  const first = nuc[0];
  if (on === 'c' && /[ieêy]/.test(first)) errors.push(`${where}: “${raw}” should use k-, not c-`);
  if (on === 'k' && !/[ieêy]/.test(first)) errors.push(`${where}: “${raw}” should use c-, not k-`);
  if ((on === 'g' || on === 'ng') && /[eê]/.test(first)) errors.push(`${where}: “${raw}” should use gh-/ngh-`);
  if (on === 'ng' && first === 'i') errors.push(`${where}: “${raw}” should use ngh-`);
  if ((on === 'gh' || on === 'ngh') && !/[ieê]/.test(first)) errors.push(`${where}: “${raw}” misuses gh-/ngh-`);
  if (nuc.includes('ă') && !coda) errors.push(`${where}: “${raw}” — ă needs a final consonant`);
  if (/â$/.test(nuc) && !coda) errors.push(`${where}: “${raw}” — â needs a final consonant or -u/-y`);
}

function checkText(text, where) {
  if (typeof text !== 'string' || !text.trim()) { errors.push(`${where}: empty text`); return; }
  if (/[fjwz]/i.test(text.replace(/wifi|zalo|game|gym|size|deadline|marketing|karaoke|messenger|be/gi, '')))
    warnings.push(`${where}: contains f/j/w/z — check “${text}”`);
  text.split(/[\s,.!?“”"():;…–—\-/]+/).forEach(t => t && checkSyllable(t, where));
}

const seen = new Map();
let wordCount = 0, phraseCount = 0, lineCount = 0, grammarCount = 0, drillCount = 0;
for (const u of vi.units) {
  const tag = u.id;
  for (const k of ['id', 'title', 'vi', 'icon', 'level', 'section', 'tip']) if (u[k] === undefined) errors.push(`${tag}: missing ${k}`);
  checkText(u.vi, `${tag} title`);
  if (u.words.length < 6) warnings.push(`${tag}: only ${u.words.length} words`);
  u.words.forEach((w, i) => {
    wordCount++;
    if (w.length !== 4) errors.push(`${tag} word ${i}: needs 4 fields`);
    checkText(w[0], `${tag} word “${w[0]}”`);
    if (!w[1]) errors.push(`${tag} word “${w[0]}”: missing English`);
    if (w[2]) checkText(w[2], `${tag} Hanoi variant “${w[2]}”`);
    const key = w[0].toLowerCase();
    if (seen.has(key) && !(key === 'ba' && tag === 'u08')) warnings.push(`duplicate word “${w[0]}” in ${seen.get(key)} and ${tag}`);
    else if (!seen.has(key)) seen.set(key, tag);
  });
  u.phrases.forEach(p => { phraseCount++; checkText(p[0], `${tag} phrase`); if (!p[1]) errors.push(`${tag}: phrase missing English`); });
  u.dialogue.forEach(d => { lineCount++; checkText(d[1], `${tag} dialogue`); if (!d[2]) errors.push(`${tag}: dialogue missing English`); });
  if (u.reading) checkText(u.reading.vi, `${tag} reading`);
  if (u.id !== 'u00' && !(u.grammar || []).length) warnings.push(`${tag}: no grammar point`);
  (u.grammar || []).forEach((g, gi) => {
    const gt = `${tag} grammar ${gi + 1}`;
    grammarCount++;
    if (!g.title || !g.explain) errors.push(`${gt}: missing title/explain`);
    if (!g.examples?.length) errors.push(`${gt}: no examples`);
    g.examples.forEach(([v, en]) => { checkText(v, `${gt} example`); if (!en) errors.push(`${gt}: example missing English`); });
    (g.table || []).slice(1).forEach(row => { const ex = row[row.length - 1]; if (/[ăâđêôơư]|[\u0300-\u036f]/.test(ex.normalize('NFD')) || /^[a-z ]+\.$/.test(ex)) checkText(ex.replace(/…/g, ''), `${gt} table`); });
    if ((g.drills || []).length < 3) warnings.push(`${gt}: fewer than 3 drills`);
    g.drills.forEach((d, di) => {
      const dt = `${gt} drill ${di + 1}`; drillCount++;
      if (d[0] === 'fill') {
        const [, sent, opts, ans, en] = d;
        if ((sent.match(/___/g) || []).length !== 1) errors.push(`${dt}: needs exactly one ___`);
        if (!opts.includes(ans)) errors.push(`${dt}: answer not among options`);
        if (new Set(opts).size !== opts.length) errors.push(`${dt}: duplicate options`);
        if (!en) errors.push(`${dt}: missing English`);
        checkText(sent.replace('___', ans), dt); opts.forEach(o => checkText(o, dt + ' option'));
      } else if (d[0] === 'choose') {
        const [, en, opts, idx] = d;
        if (!en || !opts[idx]) errors.push(`${dt}: bad choose drill`);
        opts.forEach(o => checkText(o, dt + ' option'));
      } else if (d[0] === 'order') {
        const [, sent, en] = d; checkText(sent, dt);
        const n = sent.split(/\s+/).length; if (n < 3 || n > 12) errors.push(`${dt}: order drills need 3–12 words`);
        if (!en) errors.push(`${dt}: missing English`);
      } else errors.push(`${dt}: unknown drill type ${d[0]}`);
    });
  });
}

console.log(`Units: ${vi.units.length} · Words: ${wordCount} · Phrases: ${phraseCount} · Dialogue lines: ${lineCount} · Grammar points: ${grammarCount} · Grammar drills: ${drillCount}`);
warnings.forEach(w => console.log('⚠️  ' + w));
errors.forEach(e => console.log('❌ ' + e));
console.log(errors.length ? `\n${errors.length} error(s)` : '\n✅ All Vietnamese text passed spelling and tone checks');
process.exit(errors.length ? 1 : 0);
