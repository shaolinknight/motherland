// Free audio using the phone's built-in voices (Web Speech API) + mic recording.
import { settings } from './store.js';
import { toast } from './util.js';

let voices = [];
let ready = false;
const synth = window.speechSynthesis;

function loadVoices() {
  if (!synth) return;
  voices = synth.getVoices();
  if (voices.length) ready = true;
}
if (synth) {
  loadVoices();
  synth.addEventListener?.('voiceschanged', loadVoices);
  // iOS sometimes needs a nudge before voices appear.
  setTimeout(loadVoices, 300); setTimeout(loadVoices, 1500);
}

// iOS only allows speech after a user tap; speak a silent utterance on the first one.
if (synth && typeof document !== 'undefined') {
  const unlock = () => { try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); loadVoices(); } catch { /* ignore */ } };
  document.addEventListener('touchend', unlock, { once: true, capture: true });
  document.addEventListener('click', unlock, { once: true, capture: true });
}

export const voicesFor = (lang) => voices.filter(v => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith(lang.slice(0, 2).toLowerCase()));

export function pickVoice(lang) {
  const list = voicesFor(lang);
  const chosen = list.find(v => v.voiceURI === settings().voiceURI);
  return chosen || list.find(v => v.lang.replace('_', '-') === lang) || list[0] || null;
}

// True when audio exercises should be offered.
export function audioAvailable(lang) {
  if (!synth) return false;
  if (settings().forceAudio) return true;
  return voicesFor(lang).length > 0;
}
export const voicesReady = () => ready;

export function speak(text, lang, { rate, onend } = {}) {
  if (!synth) { onend && onend(); return; }
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  const v = pickVoice(lang);
  if (v) u.voice = v;
  u.rate = rate ?? settings().rate ?? 0.85;
  if (onend) { u.onend = onend; u.onerror = onend; }
  synth.speak(u);
}
export const stop = () => synth && synth.cancel();

// Speak from a tapped element and show that it's playing (class "speaking" until it ends), so a tap
// always visibly does something. The first time on an iPhone, say that Silent mode mutes the voice:
// iOS silences speech with the ring switch, and a tap with no sound otherwise looks broken.
export function speakFrom(el, text, lang, opts = {}) {
  el.classList.add('speaking');
  let t = 0;
  const done = () => { clearTimeout(t); el.classList.remove('speaking'); };
  t = setTimeout(done, 6000);   // in case the end event never comes
  speak(text, lang, { ...opts, onend: done });
  silentModeHint();
}
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
function silentModeHint() {
  try {
    if (!isIOS() || localStorage.getItem('motherland.silentHint')) return;
    localStorage.setItem('motherland.silentHint', '1');
  } catch { return; }
  toast('🔈 No sound? Turn off Silent mode. iPhone mutes the voice when it’s on.', 4500);
}

// ── Recording your own voice to compare (no grading, stays on the phone) ──
export const canRecord = () => !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

export async function record(maxMs = 6000) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const type = ['audio/mp4', 'audio/webm', ''].find(t => !t || MediaRecorder.isTypeSupported?.(t));
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const done = new Promise(res => {
    rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); res(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'audio/mp4' }))); };
  });
  rec.start();
  const timer = setTimeout(() => rec.state !== 'inactive' && rec.stop(), maxMs);
  return { stop: () => { clearTimeout(timer); rec.state !== 'inactive' && rec.stop(); }, done };
}
