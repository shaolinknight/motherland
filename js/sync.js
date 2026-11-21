// Free sync through your own Google Sheet (Google Apps Script web app).
// The phone always works offline; the Sheet is a backup + a readable log.
import * as S from './store.js';
import { mergeStates } from './merge.js';

let busy = false;

async function call(payload) {
  const { syncUrl, syncKey } = S.settings();
  if (!syncUrl) throw new Error('No sync URL set');
  // text/plain avoids a CORS preflight, which Apps Script can't answer.
  const res = await fetch(syncUrl, {
    method: 'POST', redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ key: syncKey, ...payload }),
  });
  if (!res.ok) throw new Error(`Sheet responded ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Sync failed');
  return data;
}

function snapshot() {
  const st = S.get();
  // Pending sessions & flags travel separately as rows; keep the snapshot lean.
  const { pending, ...rest } = st;
  return { ...rest, settings: { ...st.settings, syncUrl: '', syncKey: '' } };
}

export async function push() {
  const st = S.get();
  const sessions = [...st.pending];
  const flags = st.flags.filter(f => !f.synced);
  const data = await call({ action: 'push', updatedAt: st.updatedAt, deviceId: st.deviceId, state: JSON.stringify(snapshot()), sessions, flags });
  const sent = new Set(sessions.map(x => x.id));
  st.pending = st.pending.filter(x => !sent.has(x.id));
  flags.forEach(f => (f.synced = true));
  return data;
}

export async function pull() {
  return call({ action: 'pull' });
}

// Pull the Sheet's copy, merge it card by card with this phone's (see merge.js), then push the result.
// Safe to call often.
export async function sync({ quiet = true } = {}) {
  const st = S.settings();
  if (!st.syncUrl || busy || !navigator.onLine) return { skipped: true };
  busy = true;
  try {
    const remote = await pull();
    if (remote.state) {
      const local = S.get();
      const merged = mergeStates(local, JSON.parse(remote.state));
      if (JSON.stringify(merged) !== JSON.stringify(local)) {
        S.replace(merged);
        window.dispatchEvent(new Event('motherland:synced'));   // re-draw the screen with the merged progress
      }
    }
    await push();
    S.settings().lastSync = Date.now(); S.settings().syncError = '';
    S.save({ touch: false });
    return { ok: true };
  } catch (e) {
    S.settings().syncError = String(e.message || e);
    S.save({ touch: false });
    if (!quiet) throw e;
    return { ok: false, error: e.message };
  } finally { busy = false; }
}

let timer;
export function syncSoon(ms = 4000) { clearTimeout(timer); timer = setTimeout(() => sync(), ms); }
