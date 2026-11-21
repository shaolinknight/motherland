// One light haptic tick for correct answers and game matches.
//
// iPhone Safari ignores navigator.vibrate. Since iOS 17.4, though, toggling an
// <input type="checkbox" switch> plays the system's light "switch" haptic, and that works from script
// as long as it happens during a tap. So we keep one hidden switch and click its label.
// Other devices fall back to navigator.vibrate (Android) or do nothing.
import { settings } from './store.js';

const hasSwitch = typeof HTMLInputElement !== 'undefined' && 'switch' in HTMLInputElement.prototype;
let label;

function hiddenSwitch() {
  if (label) return label;
  label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.display = 'none';
  const input = document.createElement('input');
  input.type = 'checkbox'; input.setAttribute('switch', ''); input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  return label;
}

export const hapticsSupported = () => hasSwitch || 'vibrate' in navigator;

export function tick() {
  if (settings().haptics === false) return;
  try {
    if (hasSwitch) hiddenSwitch().click();
    else navigator.vibrate?.(12);
  } catch { /* never let feedback break an answer */ }
}
