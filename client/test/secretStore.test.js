import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret, isValidPin } from '../src/lib/secretStore.js';

describe('PIN-encrypted secret', () => {
  const x = crypto.getRandomValues(new Uint8Array(32));

  it('round-trips with the right PIN and the ciphertext is not x', async () => {
    const blob = await encryptSecret(x, '123456');
    expect(blob.ct).not.toContain(btoa(String.fromCharCode(...x)));
    expect(await decryptSecret(blob, '123456')).toEqual(x);
  });

  it('wrong PIN fails', async () => {
    const blob = await encryptSecret(x, '123456');
    await expect(decryptSecret(blob, '654321')).rejects.toThrow('wrong PIN');
  });

  it('fresh salt and iv each time', async () => {
    const a = await encryptSecret(x, '123456');
    const b = await encryptSecret(x, '123456');
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
  });

  it('PIN must be exactly 6 digits', () => {
    expect(isValidPin('123456')).toBe(true);
    for (const p of ['12345', '1234567', '12a456', '', undefined]) expect(isValidPin(p)).toBe(false);
  });
});
