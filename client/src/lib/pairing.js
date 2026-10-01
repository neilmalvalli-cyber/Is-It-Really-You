// Pairing code = what the family QR contains: { deviceId, name, relation, X }. Public data only, no secrets.
import { isValidPoint } from './zk.js';

const PREFIX = 'IIRY1.';
export const RELATIONS = ['son', 'daughter', 'grandson', 'granddaughter', 'other'];
const DEVICE_ID_RE = /^[a-zA-Z0-9-]{8,64}$/;

const b64url = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

export function cleanName(name) {
  return typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
}

export function validateMember(m) {
  if (!m || typeof m !== 'object') throw new Error('not a pairing code');
  const name = cleanName(m.name);
  if (!DEVICE_ID_RE.test(m.deviceId ?? '')) throw new Error('bad device id');
  if (name.length < 1 || name.length > 40) throw new Error('bad name');
  if (!RELATIONS.includes(m.relation)) throw new Error('bad relation');
  if (!isValidPoint(m.X)) throw new Error('bad public key');
  return { deviceId: m.deviceId, name, relation: m.relation, X: m.X };
}

export function encodePairing(member) {
  return PREFIX + b64url(JSON.stringify(validateMember(member)));
}

export function decodePairing(code) {
  const s = typeof code === 'string' ? code.trim() : '';
  if (!s.startsWith(PREFIX) || s.length > 1000) throw new Error('not a pairing code');
  let obj;
  try { obj = JSON.parse(unb64url(s.slice(PREFIX.length))); } catch { throw new Error('not a pairing code'); }
  return validateMember(obj);
}
