import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createParentSession, createFamilySession, isValidRequest } from '../src/lib/verifySession.js';
import { generateKeypair, createCommitment, createChallenge, bytesToHex } from '../src/lib/zk.js';
import { encryptSecret, decryptSecret } from '../src/lib/secretStore.js';

const PARENT = 'parent-device-0001';
const FAMILY = 'family-device-0001';
const flush = () => new Promise((r) => setTimeout(r, 0));

// Wires a parent and a family session through an in-memory "relay" that forwards unmodified.
async function setup({ tamper } = {}) {
  const { x, X } = generateKeypair();
  const blob = await encryptSecret(x, '123456');
  const xCopy = new Uint8Array(x);
  x.fill(0);
  const member = { deviceId: FAMILY, name: 'Ravi', relation: 'son', X };
  const log = [];
  const parentUpdates = [];
  const familyUpdates = [];
  let family = null;
  const unlocks = [];
  const unlock = async (pin) => { const k = await decryptSecret(blob, pin); unlocks.push(k); return k; };

  const toFamily = (event, msg) => {
    log.push([event, msg]);
    if (event === 'verify:request') {
      family = createFamilySession({
        request: msg, X, unlock, onUpdate: (u) => familyUpdates.push(u),
        send: (e, m) => toParent(e, tamper?.(e, m) ?? m),
      });
    } else family?.handle(event, msg);
  };
  const toParent = (event, msg) => { log.push([event, msg]); parent.handle(event, msg); };
  const parent = createParentSession({
    member, parentName: 'Dad', myDeviceId: PARENT, onUpdate: (u) => parentUpdates.push(u),
    send: (e, m) => toFamily(e, tamper?.(e, m) ?? m),
  });
  return { parent, get family() { return family; }, log, parentUpdates, familyUpdates, unlocks, xCopy, X, member };
}

describe('verification session', () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => vi.useRealTimers());

  it('valid proof → both sides derive the SAME 2 words → MATCHES → verified', async () => {
    const t = await setup();
    await t.family.approve('123456');
    expect(t.parent.state).toBe('proved');
    expect(t.family.state).toBe('done');
    const pw = t.parentUpdates.at(-1).words;
    const fw = t.familyUpdates.at(-1).words;
    expect(pw).toHaveLength(2);
    expect(pw).toEqual(fw);
    expect(t.log.map(([e]) => e)).toEqual(['verify:request', 'verify:commit', 'verify:challenge', 'verify:response']);
    t.parent.matches();
    expect(t.parent.state).toBe('verified');
  });

  it('messages on the wire never contain x, r or the PIN', async () => {
    const t = await setup();
    await t.family.approve('123456');
    const wire = JSON.stringify(t.log);
    expect(wire).not.toContain(bytesToHex(t.xCopy));
    expect(wire).not.toContain('123456');
    for (const [, m] of t.log) expect(Object.keys(m)).not.toEqual(expect.arrayContaining(['x', 'r', 'pin']));
  });

  it('x is wiped from memory after the response', async () => {
    const t = await setup();
    await t.family.approve('123456');
    expect(t.unlocks).toHaveLength(1);
    expect(t.unlocks[0].every((b) => b === 0)).toBe(true);
  });

  it('DOESN\'T MATCH → not_them; words only exist after proof', async () => {
    const t = await setup();
    expect(t.parentUpdates.every((u) => u.words === null)).toBe(true);
    await t.family.approve('123456');
    t.parent.mismatch();
    expect(t.parent.state).toBe('not_them');
    t.parent.matches(); // cannot flip afterwards
    expect(t.parent.state).toBe('not_them');
  });

  it('family taps "That\'s not me" → parent denied (red)', async () => {
    const t = await setup();
    t.family.deny();
    expect(t.parent.state).toBe('denied');
    expect(t.family.state).toBe('denied');
  });

  it('deny after commit also works and wipes x', async () => {
    const t = await setup({ tamper: (e, m) => (e === 'verify:challenge' ? { ...m, sessionId: crypto.randomUUID() } : m) });
    await t.family.approve('123456'); // challenge goes to a different session id → family ignores it
    expect(t.family.state).toBe('committed');
    t.family.deny();
    expect(t.parent.state).toBe('denied');
    expect(t.unlocks[0].every((b) => b === 0)).toBe(true);
  });

  it('wrong PIN → error, session stays pending, then right PIN works', async () => {
    const t = await setup();
    await expect(t.family.approve('000000')).rejects.toThrow('wrong PIN');
    expect(t.family.state).toBe('pending');
    expect(t.parent.state).toBe('requested');
    await t.family.approve('123456');
    expect(t.parent.state).toBe('proved');
  });

  it('tampered s → failed (yellow), no words', async () => {
    const t = await setup({ tamper: (e, m) => (e === 'verify:response' ? { ...m, s: m.s.slice(0, -1) + (m.s.endsWith('0') ? '1' : '0') } : m) });
    await t.family.approve('123456');
    expect(t.parent.state).toBe('failed');
    expect(t.parentUpdates.at(-1)).toMatchObject({ reason: 'invalid proof', words: null });
  });

  it('tampered R (valid point, wrong one) → failed', async () => {
    const t = await setup({ tamper: (e, m) => (e === 'verify:commit' ? { ...m, R: createCommitment().R } : m) });
    await t.family.approve('123456');
    expect(t.parent.state).toBe('failed');
  });

  it('invalid R point (off curve) → failed', async () => {
    const t = await setup({ tamper: (e, m) => (e === 'verify:commit' ? { ...m, R: '02' + '00'.repeat(32) } : m) });
    await t.family.approve('123456');
    expect(t.parent.state).toBe('failed');
    expect(t.parentUpdates.at(-1).reason).toBe('bad commitment');
  });

  it('tampered c (changed in transit) → parent rejects the proof', async () => {
    const t = await setup({ tamper: (e, m) => (e === 'verify:challenge' ? { ...m, c: createChallenge() } : m) });
    await t.family.approve('123456');
    expect(t.parent.state).toBe('failed');
  });

  it('impostor device with a different key → failed', async () => {
    const t = await setup();
    t.member.X = generateKeypair().X; // parent paired with someone else's X
    await t.family.approve('123456');
    expect(t.parent.state).toBe('failed');
  });

  it('out-of-order: response before commit → failed', async () => {
    const t = await setup();
    t.parent.handle('verify:response', { sessionId: t.parent.sessionId, toDeviceId: PARENT, s: 'ab'.repeat(32) });
    expect(t.parent.state).toBe('failed');
    expect(t.parentUpdates.at(-1).reason).toBe('out of order');
  });

  it('out-of-order: second commit → failed', async () => {
    const t = await setup({ tamper: (e, m) => (e === 'verify:challenge' ? null : m) });
    await t.family.approve('123456').catch(() => {});
    t.parent.handle('verify:commit', { sessionId: t.parent.sessionId, toDeviceId: PARENT, R: createCommitment().R });
    expect(t.parent.state).toBe('failed');
  });

  it('duplicate verify:request for the same session is ignored by the family', async () => {
    const t = await setup();
    t.family.handle('verify:request', { sessionId: t.family.sessionId });
    expect(t.family.state).toBe('pending');
    t.parent.cancel(); t.family.cancel();
  });

  it('out-of-order: challenge before family approved → family fails', async () => {
    const t = await setup();
    t.family.handle('verify:challenge', { sessionId: t.family.sessionId, toDeviceId: FAMILY, c: createChallenge() });
    expect(t.family.state).toBe('failed');
  });

  it('single-use: messages after completion are ignored, replaying a finished transcript does nothing', async () => {
    const t = await setup();
    await t.family.approve('123456');
    t.parent.matches();
    const [, commit] = t.log.find(([e]) => e === 'verify:commit');
    const [, resp] = t.log.find(([e]) => e === 'verify:response');
    t.parent.handle('verify:commit', commit);
    t.parent.handle('verify:response', resp);
    t.parent.handle('verify:deny', { sessionId: t.parent.sessionId });
    expect(t.parent.state).toBe('verified');
  });

  it('old transcript replayed into a NEW session fails (fresh sessionId + c)', async () => {
    const t1 = await setup();
    await t1.family.approve('123456');
    const [, oldCommit] = t1.log.find(([e]) => e === 'verify:commit');
    const [, oldResp] = t1.log.find(([e]) => e === 'verify:response');
    const updates = [];
    const sent = [];
    const p2 = createParentSession({ member: t1.member, parentName: 'Dad', myDeviceId: PARENT, onUpdate: (u) => updates.push(u), send: (e, m) => sent.push([e, m]) });
    p2.handle('verify:commit', { ...oldCommit, sessionId: p2.sessionId });
    p2.handle('verify:response', { ...oldResp, sessionId: p2.sessionId });
    expect(p2.state).toBe('failed');
    expect(sent[1][1].c).not.toBe(t1.log.find(([e]) => e === 'verify:challenge')[1].c);
    p2.cancel();
  });

  it('messages for another session id are ignored', async () => {
    const t = await setup();
    t.parent.handle('verify:deny', { sessionId: crypto.randomUUID() });
    expect(t.parent.state).toBe('requested');
    t.parent.cancel();
  });

  it('timeout after 60 s with no answer → failed (both sides), x wiped', async () => {
    vi.useFakeTimers();
    const t = await setup();
    vi.advanceTimersByTime(59_000);
    expect(t.parent.state).toBe('requested');
    vi.advanceTimersByTime(1_001);
    expect(t.parent.state).toBe('failed');
    expect(t.parentUpdates.at(-1).reason).toBe('timeout');
    expect(t.family.state).toBe('failed');
  });

  it('timeout while waiting for the response → failed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const t = await setup({ tamper: (e, m) => (e === 'verify:response' ? { ...m, sessionId: crypto.randomUUID() } : m) });
    await t.family.approve('123456');
    expect(t.parent.state).toBe('challenged');
    vi.advanceTimersByTime(60_001);
    expect(t.parent.state).toBe('failed');
  });

  it('verify:error from the server (e.g. family offline) → failed', async () => {
    const t = await setup();
    t.parent.handle('verify:error', { sessionId: t.parent.sessionId, reason: 'device offline' });
    expect(t.parent.state).toBe('failed');
  });

  it('isValidRequest checks shape and recipient', () => {
    const ok = { sessionId: crypto.randomUUID(), fromDeviceId: PARENT, toDeviceId: FAMILY, parentName: 'Dad', expiresAt: Date.now() };
    expect(isValidRequest(ok, FAMILY)).toBe(true);
    expect(isValidRequest(ok, 'someone-else-01')).toBe(false);
    expect(isValidRequest({ ...ok, sessionId: 'x' }, FAMILY)).toBe(false);
    expect(isValidRequest({ ...ok, parentName: '' }, FAMILY)).toBe(false);
    expect(isValidRequest(null, FAMILY)).toBe(false);
  });
});
