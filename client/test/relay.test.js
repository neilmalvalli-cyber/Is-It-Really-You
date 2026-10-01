// Integration: real server relay + two socket.io clients running the real session state machines.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as ioc } from 'socket.io-client';
import { createAppServer, isValidMessage } from '../../server/app.js';
import { createParentSession, createFamilySession } from '../src/lib/verifySession.js';
import { generateKeypair, createChallenge } from '../src/lib/zk.js';
import { encryptSecret, decryptSecret } from '../src/lib/secretStore.js';

const EVENTS = ['verify:request', 'verify:commit', 'verify:challenge', 'verify:response', 'verify:deny', 'verify:error'];
let server; let url; const logs = [];

beforeAll(async () => {
  server = createAppServer({ log: (l) => logs.push(l) });
  await new Promise((r) => server.httpServer.listen(0, r));
  url = `http://localhost:${server.httpServer.address().port}`;
});
afterAll(() => { server.io.close(); server.httpServer.close(); });

function client(deviceId, role) {
  return new Promise((resolve) => {
    const s = ioc(url, { transports: ['websocket'], forceNew: true });
    s.on('connect', () => s.emit('register', { deviceId, role }, () => resolve(s)));
  });
}
const until = async (fn, ms = 3000) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timeout'); await new Promise((r) => setTimeout(r, 10)); } };

async function run({ approvePin = '123456', deny = false } = {}) {
  const parentId = crypto.randomUUID(); const familyId = crypto.randomUUID();
  const { x, X } = generateKeypair();
  const blob = await encryptSecret(x, '123456'); x.fill(0);
  const ps = await client(parentId, 'parent'); const fs = await client(familyId, 'family');
  let pState = {}; let fState = {}; let fam;
  fs.on('verify:request', (req) => {
    fam = createFamilySession({ request: req, X, unlock: (pin) => decryptSecret(blob, pin), onUpdate: (u) => { fState = u; }, send: (e, m) => fs.emit(e, m) });
  });
  for (const e of EVENTS) fs.on(e, (m) => fam?.handle(e, m));
  const parent = createParentSession({ member: { deviceId: familyId, X }, parentName: 'Dad', myDeviceId: parentId, onUpdate: (u) => { pState = u; }, send: (e, m) => ps.emit(e, m) });
  for (const e of EVENTS) ps.on(e, (m) => parent.handle(e, m));
  await until(() => fam);
  if (deny) fam.deny(); else await fam.approve(approvePin);
  await until(() => ['proved', 'denied', 'failed'].includes(pState.state));
  ps.close(); fs.close();
  return { pState, fState };
}

describe('relay end-to-end', () => {
  it('valid proof through the server → same words on both devices', async () => {
    const { pState, fState } = await run();
    expect(pState.state).toBe('proved');
    expect(fState.state).toBe('done');
    expect(pState.words).toEqual(fState.words);
    expect(logs.some((l) => l.includes('relay verify:response'))).toBe(true);
  });

  it('deny through the server → denied', async () => {
    const { pState } = await run({ deny: true });
    expect(pState.state).toBe('denied');
  });

  it('family device offline → verify:error → failed', async () => {
    const parentId = crypto.randomUUID();
    const ps = await client(parentId, 'parent');
    let st = {};
    const p = createParentSession({ member: { deviceId: crypto.randomUUID(), X: generateKeypair().X }, parentName: 'Dad', myDeviceId: parentId, onUpdate: (u) => { st = u; }, send: (e, m) => ps.emit(e, m) });
    ps.on('verify:error', (m) => p.handle('verify:error', m));
    await until(() => st.state === 'failed');
    expect(st.reason).toBe('device offline');
    ps.close();
  });

  it('server rejects malformed messages and does not forward them', async () => {
    const a = crypto.randomUUID(); const b = crypto.randomUUID();
    const sa = await client(a, 'parent'); const sb = await client(b, 'family');
    const got = []; const errs = [];
    sb.onAny((e) => got.push(e)); sa.on('verify:error', (m) => errs.push(m));
    const sid = crypto.randomUUID();
    sa.emit('verify:challenge', { sessionId: sid, toDeviceId: b, c: 'nothex' });
    sa.emit('verify:challenge', { sessionId: sid, toDeviceId: b, c: createChallenge(), extra: 1 });
    sa.emit('verify:request', { sessionId: sid, fromDeviceId: crypto.randomUUID(), toDeviceId: b, parentName: 'Dad', expiresAt: 1 }); // spoofed sender
    await until(() => errs.length === 3);
    expect(got).toEqual([]);
    sa.close(); sb.close();
  });

  it('isValidMessage', () => {
    const sid = crypto.randomUUID();
    expect(isValidMessage('verify:deny', { sessionId: sid, toDeviceId: 'abcdefgh' })).toBe(true);
    expect(isValidMessage('verify:deny', { sessionId: sid })).toBe(false);
    expect(isValidMessage('verify:unknown', { sessionId: sid, toDeviceId: 'abcdefgh' })).toBe(false);
    expect(isValidMessage('verify:commit', { sessionId: sid, toDeviceId: 'abcdefgh', R: '04' + 'a'.repeat(64) })).toBe(false);
  });
});
