import { getSetting, setSetting } from './storage.js';

// Every warning/result is also spoken (UI rule), unless this device has turned spoken warnings off.
export function isVoiceOn() {
  return getSetting('voice') !== false; // on by default
}

export function setVoiceOn(on) {
  setSetting('voice', on);
  if (!on && 'speechSynthesis' in window) window.speechSynthesis.cancel(); // stop anything mid-sentence
}

export function speak(text) {
  if (!isVoiceOn() || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-IN';
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}
