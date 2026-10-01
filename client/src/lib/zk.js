// Schnorr ZK math on secp256k1. M1: key generation + point validation. M2 adds commit/challenge/response/verify.
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { bytesToHex, hexToBytes } from '@noble/curves/utils.js';

const Point = secp256k1.Point;
const POINT_HEX_RE = /^0[23][0-9a-f]{64}$/; // compressed point, 33 bytes

// Fresh secret x in [1, n-1] and public X = x·G (compressed hex). Caller must wipe x after use.
export function generateKeypair() {
  const x = secp256k1.utils.randomSecretKey();
  const X = bytesToHex(secp256k1.getPublicKey(x, true));
  return { x, X };
}

// Security rule 6: every received point must be on the curve and not the identity.
export function parsePoint(hex) {
  if (typeof hex !== 'string' || !POINT_HEX_RE.test(hex)) throw new Error('bad point encoding');
  const p = Point.fromHex(hex); // throws if not on curve
  p.assertValidity();
  if (p.is0()) throw new Error('identity point');
  return p;
}

export function isValidPoint(hex) {
  try { parsePoint(hex); return true; } catch { return false; }
}

export { bytesToHex, hexToBytes };
