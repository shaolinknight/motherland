// Vietnamese course entry point. Add new units to vi-a.js / vi-b.js (or a new file)
// and list it here. Run `node tools/validate.mjs` after any content change.
import a from './vi-a.js';
import b from './vi-b.js';
import c from './vi-c.js';   // v1.3 units, marked review: true (needs family check)
import d from './vi-d.js';   // v1.4 units, marked review: true (needs family check)
import grammar from './vi-grammar.js';

export default {
  code: 'vi',
  name: 'Vietnamese',
  native: 'Tiếng Việt',
  flag: '🇻🇳',
  speechLang: 'vi-VN',
  accent: 'Saigon (Southern) first, with Hanoi (Northern) variants shown',
  levels: ['Beginner', 'Elementary', 'Pre-intermediate', 'Intermediate'],
  sections: ['Foundations', 'Weddings', 'Everyday Life', 'Going Out', 'Family & Culture', 'Deeper Conversations'],
  units: [...a, ...b, ...c, ...d].map(u => ({ ...u, grammar: grammar[u.id] || [] })),
};
