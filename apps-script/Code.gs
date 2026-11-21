/**
 * Motherland — Google Sheet sync (free).
 *
 * SETUP (about 3 minutes, one time):
 * 1. Create a new Google Sheet named "Motherland Progress".
 * 2. Extensions → Apps Script. Delete what's there and paste this whole file.
 * 3. Change SECRET below to any password you like (you'll type it in the app too).
 * 4. Deploy → New deployment → type "Web app".
 *      Execute as: Me      Who has access: Anyone
 *    Click Deploy, approve access, and copy the Web app URL (ends in /exec).
 * 5. In Motherland: Settings → Google Sheet sync → paste the URL and your SECRET → Sync now.
 *
 * Tabs it creates: State (raw backup — don't edit), Sessions (one row per study
 * session), Flags (items you reported as possibly wrong).
 */
const SECRET = 'change-me';
const CHUNK = 45000; // Sheets cells hold ~50k characters

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.key !== SECRET) return out({ ok: false, error: 'Wrong sync password' });
    if (body.action === 'pull') return out(readState());
    if (body.action === 'push') {
      writeState(body.state, body.updatedAt);
      appendSessions(body.sessions || []);
      appendFlags(body.flags || []);
      return out({ ok: true, updatedAt: body.updatedAt });
    }
    return out({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return out({ ok: true, message: 'Motherland sync is running.' }); }

function sheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (headers) { sh.appendRow(headers); sh.setFrozenRows(1); sh.getRange(1, 1, 1, headers.length).setFontWeight('bold'); }
  }
  return sh;
}

function readState() {
  const sh = sheet('State');
  const last = sh.getLastRow();
  if (last < 2) return { ok: true, state: null, updatedAt: 0 };
  const updatedAt = Number(sh.getRange(1, 2).getValue()) || 0;
  const chunks = sh.getRange(2, 1, last - 1, 1).getValues().map(r => r[0]).join('');
  return { ok: true, state: chunks || null, updatedAt };
}

function writeState(state, updatedAt) {
  if (!state) return;
  const sh = sheet('State');
  sh.clear();
  const rows = [['updatedAt', updatedAt]];
  for (let i = 0; i < state.length; i += CHUNK) rows.push([state.slice(i, i + CHUNK), '']);
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
}

function appendSessions(list) {
  if (!list.length) return;
  const sh = sheet('Sessions', ['Date', 'Language', 'Activity', 'Minutes', 'XP', 'Correct', 'Answered', 'Accuracy %', 'ID']);
  const existing = new Set(sh.getLastRow() > 1 ? sh.getRange(2, 9, sh.getLastRow() - 1, 1).getValues().map(r => r[0]) : []);
  const rows = list.filter(s => !existing.has(s.id)).map(s => [
    new Date(s.at), s.lang, s.activity, Math.round((s.ms || 0) / 6000) / 10, s.xp || 0, s.c || 0, s.t || 0,
    s.t ? Math.round((s.c / s.t) * 100) : '', s.id,
  ]);
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function appendFlags(list) {
  if (!list.length) return;
  const sh = sheet('Flags', ['Date', 'Language', 'Item', 'Vietnamese', 'English', 'Your note', 'Fixed?', 'ID']);
  const existing = new Set(sh.getLastRow() > 1 ? sh.getRange(2, 8, sh.getLastRow() - 1, 1).getValues().map(r => r[0]) : []);
  const rows = list.filter(f => !existing.has(f.id)).map(f => [new Date(f.at), f.lang, f.itemId, f.vi, f.en, f.note, '', f.id]);
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
