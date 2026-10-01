import { describe, it, expect } from 'vitest';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { generateKeypair, parsePoint, isValidPoint, bytesToHex } from '../src/lib/zk.js';

describe('zk keypair + point validation', () => {
  it('X = x·G and is a valid compressed point', () => {
    const { x, X } = generateKeypair();
    expect(x).toHaveLength(32);
    expect(X).toMatch(/^0[23][0-9a-f]{64}$/);
    expect(bytesToHex(secp256k1.getPublicKey(x, true))).toBe(X);
    expect(isValidPoint(X)).toBe(true);
  });

  it('fresh x every time', () => {
    expect(bytesToHex(generateKeypair().x)).not.toBe(bytesToHex(generateKeypair().x));
  });

  it('rejects off-curve, identity, wrong length and non-hex', () => {
    expect(isValidPoint('02' + '00'.repeat(32))).toBe(false); // x=0 is not on secp256k1
    expect(isValidPoint('00')).toBe(false); // identity encoding
    expect(isValidPoint('02abcd')).toBe(false);
    expect(isValidPoint('zz' + '11'.repeat(32))).toBe(false);
    expect(isValidPoint(undefined)).toBe(false);
    expect(() => parsePoint('04' + '11'.repeat(64))).toThrow(); // uncompressed not accepted
  });
});

import {
  createCommitment, createChallenge, createResponse, verifyProof, deriveWords, parseScalar, randomScalar,
} from '../src/lib/zk.js';
import { WORDS } from '../src/lib/words.js';

const n = secp256k1.Point.Fn.ORDER;
const G = secp256k1.Point.BASE;
const hex32 = (k) => k.toString(16).padStart(64, '0');

function honestRun() {
  const { x, X } = generateKeypair();
  const { r, R } = createCommitment();
  const c = createChallenge();
  const s = createResponse(x, r, c);
  return { x, X, r, R, c, s };
}

describe('Schnorr proof', () => {
  it('honest proof verifies (100 runs)', () => {
    for (let i = 0; i < 100; i++) {
      const { X, R, c, s } = honestRun();
      expect(verifyProof({ X, R, c, s })).toBe(true);
    }
  });

  it('s = r + c·x mod n exactly', () => {
    const { x, r, c, s } = honestRun();
    const xk = BigInt('0x' + bytesToHex(x));
    expect(BigInt('0x' + s)).toBe((r + BigInt('0x' + c) * xk) % n);
  });

  it('rejects tampered s, c, R and wrong X', () => {
    const { X, R, c, s } = honestRun();
    const bump = (h) => hex32((BigInt('0x' + h) + 1n) % n);
    expect(verifyProof({ X, R, c, s: bump(s) })).toBe(false);
    expect(verifyProof({ X, R, c: bump(c), s })).toBe(false);
    expect(verifyProof({ X, R: generateKeypair().X, c, s })).toBe(false);
    expect(verifyProof({ X: generateKeypair().X, R, c, s })).toBe(false);
  });

  it('a prover without x (random s) fails', () => {
    const { X } = generateKeypair();
    const { R } = createCommitment();
    for (let i = 0; i < 20; i++) {
      expect(verifyProof({ X, R, c: createChallenge(), s: hex32(randomScalar()) })).toBe(false);
    }
  });

  it('replaying an old transcript against a new challenge fails', () => {
    const old = honestRun();
    const c2 = createChallenge();
    expect(c2).not.toBe(old.c);
    expect(verifyProof({ X: old.X, R: old.R, c: c2, s: old.s })).toBe(false);
  });

  it('rejects malformed / out-of-range / identity inputs without throwing', () => {
    const { X, R, c, s } = honestRun();
    const bad = [
      { X, R, c, s: '00'.repeat(32) },
      { X, R, c, s: hex32(n) },
      { X, R, c: 'ff'.repeat(32), s },
      { X, R, c: c.toUpperCase(), s },
      { X, R, c: c.slice(2), s },
      { X, R: '00', c, s },
      { X, R: '02' + '00'.repeat(32), c, s },
      { X: G.toHex(false), R, c, s },
      { X, R, c: 123, s },
      {},
    ];
    for (const b of bad) expect(verifyProof(b)).toBe(false);
  });

  it('cannot forge with R = s·G − c·X unless it commits before seeing c (interactive order matters)', () => {
    // A cheater who knows c in advance can always make a passing transcript — this is why
    // the parent sends a FRESH c only AFTER receiving R.
    const { X } = generateKeypair();
    const c = createChallenge();
    const s = hex32(randomScalar());
    const Rforged = G.multiply(BigInt('0x' + s)).subtract(secp256k1.Point.fromHex(X).multiply(BigInt('0x' + c))).toHex(true);
    expect(verifyProof({ X, R: Rforged, c, s })).toBe(true);
    expect(verifyProof({ X, R: Rforged, c: createChallenge(), s })).toBe(false);
  });

  it('fresh r and c every time (no reuse over 1000 draws)', () => {
    const rs = new Set(); const cs = new Set();
    for (let i = 0; i < 1000; i++) { rs.add(createCommitment().R); cs.add(createChallenge()); }
    expect(rs.size).toBe(1000);
    expect(cs.size).toBe(1000);
  });

  it('reusing r leaks x — the reason rule 5 exists', () => {
    const { x } = generateKeypair();
    const { r } = createCommitment();
    const c1 = createChallenge(); const c2 = createChallenge();
    const s1 = BigInt('0x' + createResponse(x, r, c1));
    const s2 = BigInt('0x' + createResponse(x, r, c2));
    const inv = (a) => { let [t, nt, rr, nr] = [0n, 1n, n, ((a % n) + n) % n]; while (nr) { const q = rr / nr; [t, nt] = [nt, t - q * nt]; [rr, nr] = [nr, rr - q * nr]; } return ((t % n) + n) % n; };
    const recovered = (((s1 - s2) % n + n) % n) * inv(BigInt('0x' + c1) - BigInt('0x' + c2)) % n;
    expect(recovered).toBe(BigInt('0x' + bytesToHex(x)));
  });

  it('parseScalar range checks', () => {
    expect(() => parseScalar('00'.repeat(32))).toThrow();
    expect(() => parseScalar(hex32(n))).toThrow();
    expect(parseScalar(hex32(n - 1n))).toBe(n - 1n);
  });
});

describe('2-word code', () => {
  it('word list: 256 unique lowercase words', () => {
    expect(WORDS).toHaveLength(256);
    expect(new Set(WORDS).size).toBe(256);
    for (const w of WORDS) expect(w).toMatch(/^[a-z]+$/);
  });

  it('same transcript → same words on both sides; any change → (almost always) different', () => {
    const { R, c, s } = honestRun();
    const sessionId = crypto.randomUUID();
    const a = deriveWords({ sessionId, R, c, s });
    const b = deriveWords({ sessionId, R, c, s });
    expect(a).toEqual(b);
    expect(a).toHaveLength(2);
    for (const w of a) expect(WORDS).toContain(w);
    let different = 0;
    for (let i = 0; i < 20; i++) {
      if (deriveWords({ sessionId: crypto.randomUUID(), R, c, s }).join() !== a.join()) different++;
    }
    expect(different).toBeGreaterThanOrEqual(19);
  });
});
