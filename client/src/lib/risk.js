// Call risk meter (brief §6 client logic). Risk never goes down during a call.
// red = any "high" or two "medium"; yellow = one "medium" or an "unknown" (Gemini failed → "Be careful");
// green = only "low" so far. Gemini's verdict is advice only — it never leads to "Verified" (rule 8).
export const INITIAL_RISK = { level: 'idle', high: 0, medium: 0, low: 0, unknown: 0, last: null, reasons: [] };
const RANK = { idle: 0, green: 1, yellow: 2, red: 3 };

export function addVerdict(state, verdict) {
  const v = verdict && typeof verdict === 'object' ? verdict : { risk: 'unknown' };
  const risk = ['low', 'medium', 'high'].includes(v.risk) ? v.risk : 'unknown';
  const next = { ...state, [risk]: state[risk] + 1, last: v };
  if (risk !== 'unknown' && v.reason) next.reasons = [...state.reasons, { risk, reason: v.reason, quote: v.evidenceQuote || '', tactics: v.tactics || [] }];
  let level = 'green';
  if (next.high >= 1 || next.medium >= 2) level = 'red';
  else if (next.medium === 1 || next.unknown >= 1) level = 'yellow';
  next.level = RANK[level] >= RANK[state.level] ? level : state.level; // never goes down
  return next;
}
