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
