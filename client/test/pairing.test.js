import { describe, it, expect } from 'vitest';
import { encodePairing, decodePairing } from '../src/lib/pairing.js';
import { generateKeypair } from '../src/lib/zk.js';

const member = () => ({ deviceId: crypto.randomUUID(), name: '  Ravi  Kumar ', relation: 'son', X: generateKeypair().X });

describe('pairing code', () => {
  it('round-trips and normalises the name', () => {
    const m = member();
    const out = decodePairing(encodePairing(m));
    expect(out).toEqual({ ...m, name: 'Ravi Kumar' });
  });

  it('handles non-ASCII names', () => {
    const m = { ...member(), name: 'ರವಿ' };
    expect(decodePairing(encodePairing(m)).name).toBe('ರವಿ');
  });

  it('contains no extra fields', () => {
    const code = encodePairing({ ...member(), secret: 'leak' });
    expect(Object.keys(decodePairing(code)).sort()).toEqual(['X', 'deviceId', 'name', 'relation']);
  });

  it('rejects garbage, bad relation and bad public key', () => {
    expect(() => decodePairing('hello')).toThrow();
    expect(() => decodePairing('IIRY1.@@@')).toThrow();
    expect(() => encodePairing({ ...member(), relation: 'boss' })).toThrow();
    const bad = 'IIRY1.' + btoa(JSON.stringify({ ...member(), name: 'Ravi', X: '02' + '00'.repeat(32) }));
    expect(() => decodePairing(bad)).toThrow('bad public key');
  });
});
