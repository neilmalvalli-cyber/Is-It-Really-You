// Gemini retry/backoff on transient errors (503/429/5xx/timeout/network). No real network or key.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { ApiError } from '../../server/node_modules/@google/genai/dist/node/index.mjs';
import { generateWithRetry, isRetryable, RETRY_DELAYS_MS } from '../../server/gemini.js';
import { createAppServer } from '../../server/app.js';

const apiErr = (status) => new ApiError({ message: `got status: ${status}. {"error":{"code":${status}}}`, status });
const OK = { text: JSON.stringify({ risk: 'high', claimsToBeFamily: true, claimedRelation: 'son', tactics: ['urgency'], reason: 'Asks for money fast.', evidenceQuote: 'send money now', language: 'en' }) };

// gen that fails with the given errors in order, then succeeds
function scripted(errors) {
  const calls = [];
  const gen = async (req) => { calls.push(req); const e = errors[calls.length - 1]; if (e) throw e; return OK; };
  return { gen, calls };
}

describe('generateWithRetry', () => {
  let warn;
  beforeAll(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterAll(() => warn.mockRestore());

  it('backoff schedule is 1s, 2s, 4s, 8s (max 4 retries)', () => {
    expect(RETRY_DELAYS_MS).toEqual([1000, 2000, 4000, 8000]);
  });

  it('retry-success: 503, 503, then OK → returns result after 2 retries with 1s, 2s backoff', async () => {
    const sleeps = []; const { gen, calls } = scripted([apiErr(503), apiErr(503)]);
    const res = await generateWithRetry(gen, { a: 1 }, { sleep: async (ms) => sleeps.push(ms) });
    expect(res).toBe(OK);
    expect(calls).toHaveLength(3);
    expect(sleeps).toEqual([1000, 2000]);
    expect(calls.every((c) => c.a === 1)).toBe(true); // same request every attempt
  });

  it('retry-exhaustion: always 503 → 1 try + 4 retries (1s,2s,4s,8s), then throws', async () => {
    const sleeps = []; const { gen, calls } = scripted(Array(10).fill(apiErr(503)));
    await expect(generateWithRetry(gen, {}, { sleep: async (ms) => sleeps.push(ms) })).rejects.toMatchObject({ status: 503 });
    expect(calls).toHaveLength(5);
    expect(sleeps).toEqual([1000, 2000, 4000, 8000]);
  });

  it('really waits between attempts (fake timers)', async () => {
    vi.useFakeTimers();
    try {
      const { gen, calls } = scripted([apiErr(503)]);
      const p = generateWithRetry(gen, {});
      await vi.advanceTimersByTimeAsync(999);
      expect(calls).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(2);
      expect(calls).toHaveLength(2);
      await expect(p).resolves.toBe(OK);
    } finally { vi.useRealTimers(); }
  });

  it.each([429, 500, 502, 504])('retries HTTP %i', async (status) => {
    const { gen, calls } = scripted([apiErr(status)]);
    await expect(generateWithRetry(gen, {}, { sleep: async () => {} })).resolves.toBe(OK);
    expect(calls).toHaveLength(2);
  });

  it.each([400, 401, 403, 404])('does NOT retry HTTP %i', async (status) => {
    const sleeps = []; const { gen, calls } = scripted([apiErr(status)]);
    await expect(generateWithRetry(gen, {}, { sleep: async (ms) => sleeps.push(ms) })).rejects.toMatchObject({ status });
    expect(calls).toHaveLength(1);
    expect(sleeps).toEqual([]);
  });

  it('retries a timed-out attempt', async () => {
    let n = 0;
    const gen = () => (++n === 1 ? new Promise(() => {}) : Promise.resolve(OK)); // first attempt hangs
    await expect(generateWithRetry(gen, {}, { timeoutMs: 20, sleep: async () => {} })).resolves.toBe(OK);
    expect(n).toBe(2);
  });

  it('retries network errors (fetch failed / ECONNRESET)', async () => {
    const netErr = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } });
    const { gen, calls } = scripted([netErr]);
    await expect(generateWithRetry(gen, {}, { sleep: async () => {} })).resolves.toBe(OK);
    expect(calls).toHaveLength(2);
  });

  it('isRetryable table', () => {
    expect(isRetryable(apiErr(503))).toBe(true);
    expect(isRetryable(apiErr(501))).toBe(false);
    expect(isRetryable(new Error('GEMINI_API_KEY not set'))).toBe(false);
    expect(isRetryable(new SyntaxError('bad json'))).toBe(false);
  });
});

describe('/api/scam-check with retries', () => {
  let server; let url; let script; const logs = [];
  beforeAll(async () => {
    process.env.GEMINI_API_KEY = 'RETRY-SECRET-KEY-456';
    server = createAppServer({
      log: (l) => logs.push(l),
      generate: async (req) => script(req),
      retry: { sleep: async () => {} }, // no real waiting in tests
    });
    await new Promise((r) => server.httpServer.listen(0, r));
    url = `http://localhost:${server.httpServer.address().port}`;
  });
  afterAll(() => { server.io.close(); server.httpServer.close(); delete process.env.GEMINI_API_KEY; });

  const post = async () => {
    const form = new FormData();
    form.append('audio', new Blob([new Uint8Array(4000).fill(9)], { type: 'audio/webm' }), 'chunk.webm');
    return (await fetch(`${url}/api/scam-check`, { method: 'POST', body: form })).json();
  };

  it('retry-success: two 503s then a real verdict reaches the client', async () => {
    const seen = [];
    script = async (req) => {
      seen.push(req.contents[0].parts[0].inlineData.data);
      if (seen.length <= 2) throw apiErr(503);
      return OK;
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await post()).risk).toBe('high');
    expect(seen).toHaveLength(3);
    expect(new Set(seen).size).toBe(1); // same in-memory audio each attempt
    expect(warn.mock.calls.flat().join(' ')).toContain('retry 2/4');
    warn.mockRestore();
  });

  it('retry-exhaustion: 503 every time → fail-safe {"risk":"unknown"}, key never logged', async () => {
    let n = 0;
    script = async () => { n++; throw new ApiError({ message: 'UNAVAILABLE high demand key=RETRY-SECRET-KEY-456', status: 503 }); };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await post()).toEqual({ risk: 'unknown' });
    expect(n).toBe(5);
    const printed = [...warn.mock.calls, ...err.mock.calls].flat().join(' ') + logs.join(' ');
    expect(printed).not.toContain('RETRY-SECRET-KEY-456');
    expect(printed).toContain('scam-check failed');
    warn.mockRestore(); err.mockRestore();
  });

  it('403 (bad key) is not retried → unknown immediately', async () => {
    let n = 0;
    script = async () => { n++; throw apiErr(403); };
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await post()).toEqual({ risk: 'unknown' });
    expect(n).toBe(1);
    err.mockRestore();
  });
});

import { checkAudio, shouldUseFallback } from '../../server/gemini.js';

describe('optional GEMINI_FALLBACK_MODEL', () => {
  const noWait = { sleep: async () => {} };
  let warn; let err;
  beforeAll(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); err = vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterAll(() => { warn.mockRestore(); err.mockRestore(); delete process.env.GEMINI_FALLBACK_MODEL; delete process.env.GEMINI_MODEL; });

  const run = async (primaryError, { fallback = 'fallback-model', fallbackOk = true } = {}) => {
    process.env.GEMINI_MODEL = 'primary-model';
    if (fallback) process.env.GEMINI_FALLBACK_MODEL = fallback; else delete process.env.GEMINI_FALLBACK_MODEL;
    const models = [];
    const generate = async (req) => {
      models.push(req.model);
      if (req.model === 'primary-model') throw primaryError;
      if (!fallbackOk) throw apiErr(503);
      return OK;
    };
    const verdict = await checkAudio(Buffer.from('audio-bytes'), 'audio/webm', { generate, retry: noWait });
    return { verdict, models };
  };

  it('primary 503 exhausted → fallback model succeeds with a real verdict', async () => {
    const { verdict, models } = await run(apiErr(503));
    expect(verdict.risk).toBe('high');
    expect(models).toEqual([...Array(5).fill('primary-model'), 'fallback-model']);
  });

  it('primary 404 (model not found) → fallback used', async () => {
    const { verdict, models } = await run(apiErr(404));
    expect(verdict.risk).toBe('high');
    expect(models).toEqual(['primary-model', 'fallback-model']);
  });

  it.each([400, 401, 403])('primary %i → NO fallback, fail-safe unknown', async (status) => {
    const { verdict, models } = await run(apiErr(status));
    expect(verdict).toEqual({ risk: 'unknown' });
    expect(models).toEqual(['primary-model']);
  });

  it('no fallback configured → primary retries only, then unknown', async () => {
    const { verdict, models } = await run(apiErr(503), { fallback: '' });
    expect(verdict).toEqual({ risk: 'unknown' });
    expect(models).toHaveLength(5);
  });

  it('both models exhausted → unknown (fail-safe kept)', async () => {
    const { verdict, models } = await run(apiErr(503), { fallbackOk: false });
    expect(verdict).toEqual({ risk: 'unknown' });
    expect(models).toHaveLength(10);
  });

  it('shouldUseFallback', () => {
    expect(shouldUseFallback(apiErr(503))).toBe(true);
    expect(shouldUseFallback(apiErr(404))).toBe(true);
    expect(shouldUseFallback(apiErr(403))).toBe(false);
    expect(shouldUseFallback(new Error('GEMINI_API_KEY not set'))).toBe(false);
  });
});
