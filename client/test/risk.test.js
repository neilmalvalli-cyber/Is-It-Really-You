import { describe, it, expect } from 'vitest';
import { INITIAL_RISK, addVerdict } from '../src/lib/risk.js';

const run = (...risks) => risks.reduce((s, r) => addVerdict(s, { risk: r, reason: 'r', tactics: [] }), INITIAL_RISK);

describe('risk meter', () => {
  it('low → green', () => expect(run('low').level).toBe('green'));
  it('one medium → yellow', () => expect(run('low', 'medium').level).toBe('yellow'));
  it('two medium → red', () => expect(run('medium', 'low', 'medium').level).toBe('red'));
  it('any high → red', () => expect(run('low', 'high').level).toBe('red'));
  it('unknown (Gemini failed) → yellow "Be careful"', () => expect(run('unknown').level).toBe('yellow'));
  it('never goes down', () => {
    expect(run('high', 'low', 'low').level).toBe('red');
    expect(run('medium', 'low', 'low').level).toBe('yellow');
    expect(run('unknown', 'low').level).toBe('yellow');
  });
  it('garbage verdict counts as unknown', () => {
    expect(addVerdict(INITIAL_RISK, null).level).toBe('yellow');
    expect(addVerdict(INITIAL_RISK, { risk: 'verified' }).level).toBe('yellow');
  });
  it('keeps reasons for display', () => {
    const s = addVerdict(INITIAL_RISK, { risk: 'high', reason: 'Asks for money', evidenceQuote: 'send money', tactics: ['money_request'] });
    expect(s.reasons[0]).toEqual({ risk: 'high', reason: 'Asks for money', quote: 'send money', tactics: ['money_request'] });
  });
});
