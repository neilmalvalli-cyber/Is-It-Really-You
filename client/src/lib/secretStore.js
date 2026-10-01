// Family device secret x: stored ONLY as AES-GCM ciphertext under a PBKDF2(PIN) key (security rule 3).
import { get, set, del } from 'idb-keyval';
import { generateKeypair } from './zk.js';

const KEY = 'familySecret';
const ITERATIONS = 310000;
const enc = new TextEncoder();
const toB64 = (u8) => btoa(String.fromCharCode(...u8));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const isValidPin = (pin) => /^\d{6}$/.test(pin);

async function deriveKey(pin, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptSecret(x, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, x));
  return { salt: toB64(salt), iv: toB64(iv), ct: toB64(ct), iterations: ITERATIONS };
}

// Throws on a wrong PIN (AES-GCM authentication fails). Caller must wipe the returned bytes.
export async function decryptSecret(blob, pin) {
  const key = await deriveKey(pin, fromB64(blob.salt));
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(blob.iv) }, key, fromB64(blob.ct)));
  } catch {
    throw new Error('wrong PIN');
  }
}

// One-time setup: make x, encrypt it, wipe the plaintext, keep only ciphertext + public X.
export async function createFamilySecret(pin) {
  if (!isValidPin(pin)) throw new Error('PIN must be 6 digits');
  const { x, X } = generateKeypair();
  try {
    const blob = await encryptSecret(x, pin);
    await set(KEY, { ...blob, X });
    return X;
  } finally {
    x.fill(0);
  }
}

export async function getFamilyPublicKey() {
  return (await get(KEY))?.X;
}

export async function unlockFamilySecret(pin) {
  const blob = await get(KEY);
  if (!blob) throw new Error('no secret on this device');
  return decryptSecret(blob, pin);
}

export const clearFamilySecret = () => del(KEY);
