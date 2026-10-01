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

const NOTE = 'Demo recording: the AI check is unavailable right now, so the known result for this recording is shown.';

/** Fixed verdict for a bundled demo clip file name, or null if the clip is not a known fixture. */
export function demoFixtureFor(clipName) {
  if (typeof clipName !== 'string') return null;
  const name = clipName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
  const f = FIXTURES.find((x) => x.match.test(name));
  return f ? { ...f.verdict, reason: NOTE, evidenceQuote: '', source: 'demo-fixture' } : null;
}

/** Keep Gemini's verdict unless it failed (risk 'unknown') AND this is a known bundled demo clip. */
export function withDemoFallback(verdict, clipName) {
  if (verdict?.risk !== 'unknown') return verdict;
  const fixture = demoFixtureFor(clipName);
  if (!fixture) return verdict;
  console.info(`Demo Mode: AI check unavailable; showing bundled fixture result for "${clipName}" (not a Gemini result).`);
  return fixture;
}
