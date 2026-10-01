// DEMO MODE ONLY — presentation resilience for the bundled prerecorded demo clips.
// Gemini is always tried first. Only when it returns { risk: 'unknown' } (429/503/timeout/bad output) for a
// recognised bundled demo clip do we show that clip's known, fixed result. These are NOT Gemini results and are
// labelled as such. Live microphone input never reaches this code (CallCheck only calls it for demo clips).
const FIXTURES = [
  {
    match: /arrest|police|cbi/i,
    verdict: { risk: 'high', tactics: ['fake_authority', 'urgency', 'secrecy', 'money_request', 'emotional_pressure'] },
  },
  {
    match: /\bson\b|grandson|fake[-_ ]?(son|family)/i,
    verdict: { risk: 'high', tactics: ['urgency', 'secrecy', 'money_request', 'new_number_excuse', 'emotional_pressure'] },
  },
  {
    match: /safe|normal/i,
    verdict: { risk: 'low', tactics: [] },
  },
];

// Kept in code/console only (not shown on screen — the presenter explains the fallback verbally).
const NOTE = 'Demo recording: the AI check was unavailable, so the known result for this bundled recording is used.';

/** Fixed verdict for a bundled demo clip file name, or null if the clip is not a known fixture. */
export function demoFixtureFor(clipName) {
  if (typeof clipName !== 'string') return null;
  const name = clipName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
  const f = FIXTURES.find((x) => x.match.test(name));
  // Empty reason: the screen shows only the risk state, no AI-style explanation or tactic chips for a fixture.
  return f ? { ...f.verdict, reason: '', evidenceQuote: '', source: 'demo-fixture', note: NOTE } : null;
}

/** Keep Gemini's verdict unless it failed (risk 'unknown') AND this is a known bundled demo clip. */
export function withDemoFallback(verdict, clipName) {
  if (verdict?.risk !== 'unknown') return verdict;
  const fixture = demoFixtureFor(clipName);
  if (!fixture) return verdict;
  console.info(`Demo Mode: AI check unavailable; showing bundled fixture result for "${clipName}" (not a Gemini result).`);
  return fixture;
}

export const DEMO_DEADLINE_MS = 22_000;

/**
 * Demo Mode only: wait for Gemini's verdict, but if it has not answered within `ms` (it may still be retrying a
 * 429/503) and this is a known bundled demo clip, settle on the clip's labelled fixture instead. A later Gemini
 * answer for the same chunk is ignored so the chunk is counted once. Unknown clips just keep waiting for Gemini.
 */
export function demoVerdict(geminiPromise, clipName, ms = DEMO_DEADLINE_MS) {
  const fixture = demoFixtureFor(clipName);
  if (!fixture) return geminiPromise;
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.info(`Demo Mode: no AI answer within ${ms / 1000}s; showing bundled fixture result for "${clipName}" (not a Gemini result).`);
      resolve(fixture);
    }, ms);
    geminiPromise.then((v) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(withDemoFallback(v, clipName));
    });
  });
}
