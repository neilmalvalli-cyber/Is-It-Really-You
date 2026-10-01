import { describe, it, expect, vi } from 'vitest';
import { demoFixtureFor, withDemoFallback } from '../src/lib/demoFallback.js';
import { INITIAL_RISK, addVerdict } from '../src/lib/risk.js';

const UNKNOWN = { risk: 'unknown' };
const GEMINI_LOW = { risk: 'low', claimsToBeFamily: true, claimedRelation: 'son', tactics: [], reason: 'Friendly call.', evidenceQuote: '', language: 'en' };

describe('Demo Mode fallback (bundled demo clips only)', () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});

  it('recognises the canonical names in demo-audio/README.md', () => {
    expect(demoFixtureFor('1-fake-son-asks-for-money.mp3').risk).toBe('high');
    expect(demoFixtureFor('2-fake-police-digital-arrest.m4a').risk).toBe('high');
    expect(demoFixtureFor('2-fake-police-digital-arrest.m4a').tactics).toContain('fake_authority');
    expect(demoFixtureFor('3-safe-call-from-family.wav').risk).toBe('low');
  });

  it('a safe clip whose name also contains "son" is LOW (safe wins), fake son stays HIGH', () => {
    for (const n of ['safe-son.mp3', 'safe son.m4a', '3-safe-son-call.wav', 'normal-son.mp3']) expect(demoFixtureFor(n).risk).toBe('low');
    for (const n of ['fake-son.mp3', '1-fake-son-asks-for-money.mp3']) expect(demoFixtureFor(n).risk).toBe('high');
    expect(demoFixtureFor('2-fake-police-digital-arrest.mp3').risk).toBe('high');
  });

  it('maps the three bundled clips by name', () => {
    for (const n of ['1-fake-son.mp3', 'Fake son needs money urgently.mp3', 'fake_son.wav']) expect(demoFixtureFor(n).risk).toBe('high');
    for (const n of ['2-digital-arrest.mp3', 'Fake police digital arrest.m4a']) expect(demoFixtureFor(n).risk).toBe('high');
    for (const n of ['3-safe-call.mp3', 'Normal call from family.mp3']) expect(demoFixtureFor(n).risk).toBe('low');
    expect(demoFixtureFor('2-digital-arrest.mp3').tactics).toContain('fake_authority');
  });

  it('Gemini is used whenever it answers — fixture is ignored', () => {
    expect(withDemoFallback(GEMINI_LOW, '1-fake-son.mp3')).toBe(GEMINI_LOW);
    const high = { ...GEMINI_LOW, risk: 'high' };
    expect(withDemoFallback(high, '3-safe-call.mp3')).toBe(high);
  });

  it('only on Gemini failure (unknown) does a bundled clip get its fixed result, labelled as not from Gemini', () => {
    const v = withDemoFallback(UNKNOWN, '1-fake-son.mp3');
    expect(v.risk).toBe('high');
    expect(v.source).toBe('demo-fixture');
    expect(v.note).toMatch(/AI check was unavailable/); // labelled in code
    expect(v.reason).toMatch(/son/); // fixed description of the bundled recording
    expect(addVerdict(INITIAL_RISK, v).reasons[0].tactics).toContain('money_request'); // shown with its tactics
    expect(addVerdict(INITIAL_RISK, v).level).toBe('red');
    expect(addVerdict(INITIAL_RISK, withDemoFallback(UNKNOWN, '3-safe-call.mp3')).level).toBe('green');
  });

  it('live microphone / unknown recordings keep the fail-safe unknown (yellow)', () => {
    expect(withDemoFallback(UNKNOWN, null)).toBe(UNKNOWN);
    expect(withDemoFallback(UNKNOWN, 'mic')).toBe(UNKNOWN);
    expect(withDemoFallback(UNKNOWN, 'my-own-recording.mp3')).toBe(UNKNOWN);
    expect(addVerdict(INITIAL_RISK, withDemoFallback(UNKNOWN, null)).level).toBe('yellow');
  });

  it('a fixture can never say "verified"', () => {
    for (const n of ['1-fake-son.mp3', '2-digital-arrest.mp3', '3-safe-call.mp3']) {
      expect(JSON.stringify(demoFixtureFor(n))).not.toMatch(/verified/i);
    }
  });
});

import { demoVerdict, DEMO_DEADLINE_MS } from '../src/lib/demoFallback.js';

describe('Demo Mode 22-second deadline', () => {
  const never = () => new Promise(() => {});
  it('deadline is 22 s', () => expect(DEMO_DEADLINE_MS).toBe(22_000));

  it('Gemini still slow after 22 s → bundled clip gets its labelled fixture', async () => {
    vi.useFakeTimers();
    try {
      let out;
      demoVerdict(never(), '1-fake-son-asks-for-money.mp3').then((v) => { out = v; });
      await vi.advanceTimersByTimeAsync(21_999);
      expect(out).toBeUndefined();
      await vi.advanceTimersByTimeAsync(2);
      expect(out).toMatchObject({ risk: 'high', source: 'demo-fixture' });
    } finally { vi.useRealTimers(); }
  });

  it('Gemini answers in time → Gemini result wins; late fixture never fires', async () => {
    vi.useFakeTimers();
    try {
      let out;
      demoVerdict(Promise.resolve(GEMINI_LOW), '1-fake-son-asks-for-money.mp3').then((v) => { out = v; });
      await vi.advanceTimersByTimeAsync(30_000);
      expect(out).toBe(GEMINI_LOW);
    } finally { vi.useRealTimers(); }
  });

  it('Gemini fails fast (unknown) → fixture right away', async () => {
    const v = await demoVerdict(Promise.resolve(UNKNOWN), '3-safe-call-from-family.mp3');
    expect(v).toMatchObject({ risk: 'low', source: 'demo-fixture' });
  });

  it('unrecognised recordings get no deadline: they wait for Gemini', async () => {
    const p = Promise.resolve(UNKNOWN);
    expect(demoVerdict(p, 'my-own-recording.mp3')).toBe(p);
  });
});
