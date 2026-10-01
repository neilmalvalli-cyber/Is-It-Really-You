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
    expect(v.reason).toMatch(/AI check is unavailable/);
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
