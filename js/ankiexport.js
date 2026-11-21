// Export what you've learned as a text file that Anki imports directly (File → Import).
// Uses Anki's file headers (Anki 2.1.55+) so the separator, note type, deck and tags column are set
// automatically. Note type "Basic (and reversed card)" ships with every Anki install, so each item
// becomes two cards: Vietnamese → English and English → Vietnamese.
// Review history doesn't transfer (Anki's text import can't carry it); Anki schedules from scratch.

// Tabs and line breaks would break the columns; keep everything on one line.
const cell = s => String(s ?? '').replace(/[\t\r\n]+/g, ' ').trim();
const tag = s => String(s).replace(/\s+/g, '_');

export function ankiText(items, cards = {}, deck = 'Motherland::Vietnamese') {
  const lines = [
    '#separator:tab', '#html:false', '#notetype:Basic (and reversed card)', `#deck:${deck}`, '#tags column:3',
  ];
  for (const it of items) {
    if (it.kind === 'grammar') continue;   // grammar points are drills, not flashcards
    const c = cards[it.id] || {};
    const back = [it.en, it.north ? `Hanoi: ${it.north}` : '', it.note || ''].filter(Boolean).join(' · ');
    const tags = ['motherland', it.unit && tag(it.unit), tag(it.kind), c.leech && 'leech', c.suspended && 'suspended'].filter(Boolean);
    lines.push([cell(it.vi), cell(back), tags.join(' ')].join('\t'));
  }
  return lines.join('\n') + '\n';
}
