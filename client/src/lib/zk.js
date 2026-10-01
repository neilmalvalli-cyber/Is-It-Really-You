// Interactive Schnorr identification on secp256k1 (honest-verifier zero-knowledge).
//   Family (prover) knows x with X = x·G.  Parent (verifier) holds X from the in-person QR scan.
//   1. commit:    r random in [1,n-1], R = r·G         (family → parent)
//   2. challenge: c random in [1,n-1]                  (parent → family)
//   3. response:  s = (r + c·x) mod n                  (family → parent)
//   4. verify:    s·G == R + c·X                       (parent)
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { bytesToHex, hexToBytes, bytesToNumberBE, numberToBytesBE, concatBytes } from '@noble/curves/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { WORDS } from './words.js';

const Point = secp256k1.Point;
const G = Point.BASE;
const n = Point.Fn.ORDER;
const POINT_HEX_RE = /^0[23][0-9a-f]{64}$/; // compressed point, 33 bytes
const SCALAR_HEX_RE = /^[0-9a-f]{64}$/; // 32-byte scalar

const mod = (a) => ((a % n) + n) % n;
const scalarToHex = (k) => bytesToHex(numberToBytesBE(k, 32));

// Fresh uniformly random scalar in [1, n-1] (CSPRNG via crypto.getRandomValues inside noble).
export function randomScalar() {
  return bytesToNumberBE(secp256k1.utils.randomSecretKey());
}

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

// Scalars on the wire: 64 hex chars, value in [1, n-1].
export function parseScalar(hex) {
  if (typeof hex !== 'string' || !SCALAR_HEX_RE.test(hex)) throw new Error('bad scalar encoding');
  const k = BigInt('0x' + hex);
  if (k <= 0n || k >= n) throw new Error('scalar out of range');
  return k;
}

// Step 1 (family). Keep r private and use it for exactly one response.
export function createCommitment() {
  const r = randomScalar();
  return { r, R: G.multiply(r).toHex(true) };
}

// Step 2 (parent).
export function createChallenge() {
  return scalarToHex(randomScalar());
}

// Step 3 (family). x = 32-byte secret, r from createCommitment, c = hex from the parent.
export function createResponse(x, r, cHex) {
  const c = parseScalar(cHex);
  const xk = bytesToNumberBE(x);
  if (xk <= 0n || xk >= n) throw new Error('bad secret');
  if (typeof r !== 'bigint' || r <= 0n || r >= n) throw new Error('bad nonce');
  return scalarToHex(mod(r + c * xk));
}

// Step 4 (parent). Any malformed or invalid input → false (fail safe).
export function verifyProof({ X, R, c, s }) {
  try {
    const Xp = parsePoint(X);
    const Rp = parsePoint(R);
    const ck = parseScalar(c);
    const sk = parseScalar(s);
    return G.multiply(sk).equals(Rp.add(Xp.multiply(ck)));
  } catch {
    return false;
  }
}

// 2-word code, computed on both devices only after a valid proof: SHA-256(sessionId || R || c || s) → 2 bytes.
export function deriveWords({ sessionId, R, c, s }) {
  const h = sha256(concatBytes(new TextEncoder().encode(sessionId), hexToBytes(R), hexToBytes(c), hexToBytes(s)));
  return [WORDS[h[0]], WORDS[h[1]]];
}

export { bytesToHex, hexToBytes };
