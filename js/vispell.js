// Vietnamese spelling and tone-mark rules, shared by the content validator (tools/validate.mjs) and
// the app (a typo warning when you add your own words). These catch impossible spellings; they can't
// tell whether a word is real or natural. That still needs a person.
const TONES = /[̣̀́̃̉]/g;     // huyền, sắc, ngã, hỏi, nặng
const ACUTE = '́', DOT = '̣';
// Loanwords / brand names / chat shorthand that are allowed as-is.
export const ALLOW = new Set(['wifi', 'grab', 'size', 'ok', 'alo', 'zalo', 'messenger', 'gym', 'game', 'karaoke',
  'menu', 'm', 's', 'k', 'ko', 'dc', 'đc', 'deadline', 'marketing', 'xanh', 'sm', 'be']);
const ONSET = '(ngh|ng|nh|ch|gh|gi|kh|ph|th|tr|qu|b|c|d|đ|g|h|k|l|m|n|p|r|s|t|v|x)?';
const SYL = new RegExp('^' + ONSET + '([aăâeêioôơuưy]{1,3})(ch|ng|nh|c|m|n|p|t)?$');
const base = s => s.normalize('NFD').replace(TONES, '').normalize('NFC');

// Problems with one syllable, as human-readable messages (empty = fine).
export function syllableProblems(raw) {
  const out = [];
  const s = raw.toLowerCase().normalize('NFC');
  if (!s || /\d/.test(s) || ALLOW.has(s)) return out;
  const tones = s.normalize('NFD').match(TONES) || [];
  if (tones.length > 1) out.push(`“${raw}” has ${tones.length} tone marks`);
  const m = base(s).match(SYL);
  if (!m) { out.push(`“${raw}” is not a valid Vietnamese syllable`); return out; }
  const [, on = '', nuc, coda = ''] = m;
  // Stop endings (p, t, c, ch) only take sắc or nặng.
  if (['p', 't', 'c', 'ch'].includes(coda) && !(tones[0] === ACUTE || tones[0] === DOT)) out.push(`“${raw}” ends in -${coda} so it needs sắc or nặng`);
  const first = nuc[0];
  if (on === 'c' && /[ieêy]/.test(first)) out.push(`“${raw}” should use k-, not c-`);
  if (on === 'k' && !/[ieêy]/.test(first)) out.push(`“${raw}” should use c-, not k-`);
  if ((on === 'g' || on === 'ng') && /[eê]/.test(first)) out.push(`“${raw}” should use gh-/ngh-`);
  if (on === 'ng' && first === 'i') out.push(`“${raw}” should use ngh-`);
  if ((on === 'gh' || on === 'ngh') && !/[ieê]/.test(first)) out.push(`“${raw}” misuses gh-/ngh-`);
  if (nuc.includes('ă') && !coda) out.push(`“${raw}” — ă needs a final consonant`);
  if (/â$/.test(nuc) && !coda) out.push(`“${raw}” — â needs a final consonant or -u/-y`);
  return out;
}

export const splitSyllables = text => text.split(/[\s,.!?“”"():;…–—\-/]+/).filter(Boolean);

// All problems in a phrase or sentence.
export const spellingProblems = text => splitSyllables(text).flatMap(syllableProblems);
