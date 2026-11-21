// Vietnamese text tools: answer comparison and tone variants.
const TONE_RE = /[̣̀́̃̉]/g;
export const TONE_MARKS = ['', '́', '̀', '̉', '̃', '̣']; // ngang sắc huyền hỏi ngã nặng
export const TONE_NAMES = ['ngang', 'sắc', 'huyền', 'hỏi', 'ngã', 'nặng'];

export const nfc = s => String(s ?? '').normalize('NFC');
// Lowercase, strip punctuation, collapse spaces.
export function clean(s) {
  return nfc(s).toLowerCase().replace(/[.,!?;:“”"'’‘()…\-–—/]/g, ' ').replace(/\s+/g, ' ').trim();
}
export const stripTones = s => nfc(s).normalize('NFD').replace(TONE_RE, '').normalize('NFC');
export const stripAll = s => nfc(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFC');

// Compare a typed answer to the target.
// Returns 'exact' | 'tones' (right letters & vowel marks, wrong/missing tones) | 'letters' (no diacritics at all, letters right) | 'wrong'
export function compare(input, target) {
  const a = clean(input), b = clean(target);
  if (!a) return 'wrong';
  if (a === b) return 'exact';
  if (stripTones(a) === stripTones(b)) return 'tones';
  if (stripAll(a) === stripAll(b)) return 'letters';
  return 'wrong';
}

// Per-syllable diff for feedback: [{t: targetSyllable, ok: bool}]
export function syllableDiff(input, target) {
  const a = clean(input).split(' '), b = clean(target).split(' ');
  return b.map((t, i) => ({ t, ok: a[i] === t, tonesOnly: a[i] !== t && a[i] && stripTones(a[i]) === stripTones(t) }));
}

export function toneOf(syl) {
  const m = nfc(syl).normalize('NFD').match(TONE_RE);
  return m ? TONE_MARKS.indexOf(m[0]) : 0;
}

const STOP = /(p|t|c|ch)$/;
// Return all valid tone spellings of a syllable that already carries a tone mark
// (so we know which vowel the mark sits on). Stop-final syllables only get sắc/nặng.
export function toneVariants(syl) {
  const d = nfc(syl).normalize('NFD');
  const m = d.match(TONE_RE);
  if (!m) return null;
  const idx = d.search(TONE_RE);
  const bare = d.slice(0, idx) + d.slice(idx + 1);
  // Insert the new tone after the base vowel *and* its vowel marks (ˆ ˘ ʼ),
  // otherwise e.g. ệ → é + ˆ would not recompose into ế.
  let i = idx;
  while (i > 0 && /[̀-ͯ]/.test(bare[i - 1])) i--;
  let j = i;
  while (j < bare.length && /[̀-ͯ]/.test(bare[j])) j++;
  const allowed = STOP.test(stripAll(syl).toLowerCase()) ? [1, 5] : [0, 1, 2, 3, 4, 5];
  return allowed.map(t => (bare.slice(0, j) + TONE_MARKS[t] + bare.slice(j)).normalize('NFC'));
}

// Split Vietnamese text into tappable tokens (keeps punctuation attached to words).
export const tokens = s => nfc(s).split(/\s+/).filter(Boolean);
