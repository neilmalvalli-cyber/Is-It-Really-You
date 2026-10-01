// Verification session state machines (transport-agnostic; socket.js wires `send`).
// Security rule 7: single-use, 60 s expiry, strict order request → commit → challenge → response.
// Anything unexpected ends the session as 'failed' → "Could not verify — do not send money yet".
import { createChallenge, verifyProof, deriveWords, createCommitment, createResponse, parsePoint, parseScalar } from './zk.js';

export const SESSION_MS = 60_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DEVICE_ID_RE = /^[a-zA-Z0-9-]{8,64}$/;

// Parent states: requested → challenged → proved(words) → verified | not_them ; or denied | failed
export function createParentSession({ member, parentName, myDeviceId, send, onUpdate, timeoutMs = SESSION_MS }) {
  const sessionId = crypto.randomUUID();
  let state = 'requested';
  let R = null;
  let c = null;
  let words = null;
  let reason = '';

  const update = () => onUpdate({ sessionId, state, words, reason });
  const finish = (next, why = '') => {
    if (isDone()) return;
    state = next;
    reason = why;
    clearTimeout(timer);
    update();
  };
  const isDone = () => ['verified', 'not_them', 'denied', 'failed'].includes(state);
  const timer = setTimeout(() => {
    if (state === 'requested' || state === 'challenged') finish('failed', 'timeout');
  }, timeoutMs);

  send('verify:request', {
    sessionId, fromDeviceId: myDeviceId, toDeviceId: member.deviceId, parentName, expiresAt: Date.now() + timeoutMs,
  });
  update();

  function handle(event, msg) {
    if (!msg || msg.sessionId !== sessionId || isDone()) return; // other/finished sessions are ignored
    if (event === 'verify:deny') return finish('denied');
    if (event === 'verify:error') return finish('failed', msg.reason || 'error');
    if (event === 'verify:commit' && state === 'requested') {
      try { parsePoint(msg.R); } catch { return finish('failed', 'bad commitment'); }
      R = msg.R;
      c = createChallenge(); // fresh c every session
      state = 'challenged';
      send('verify:challenge', { sessionId, toDeviceId: member.deviceId, c });
      return update();
    }
    if (event === 'verify:response' && state === 'challenged') {
      // X comes from the in-person QR scan (member.X), never from the network.
      if (!verifyProof({ X: member.X, R, c, s: msg.s })) return finish('failed', 'invalid proof');
      words = deriveWords({ sessionId, R, c, s: msg.s });
      clearTimeout(timer); // proof done; now the parent compares words
      state = 'proved';
      return update();
    }
    return finish('failed', 'out of order');
  }

  return {
    sessionId,
    handle,
    matches: () => { if (state === 'proved') { state = 'verified'; update(); } },
    mismatch: () => { if (state === 'proved') { state = 'not_them'; update(); } },
    cancel: () => finish('failed', 'cancelled'),
    get state() { return state; },
  };
}

export function isValidRequest(msg, myDeviceId) {
  return !!msg && typeof msg === 'object'
    && UUID_RE.test(msg.sessionId ?? '')
    && DEVICE_ID_RE.test(msg.fromDeviceId ?? '')
    && msg.toDeviceId === myDeviceId
    && typeof msg.parentName === 'string' && msg.parentName.length >= 1 && msg.parentName.length <= 40;
}

// Family states: pending → committed → done(words) ; or denied | failed
// unlock(pin) returns the decrypted 32-byte x (throws on wrong PIN). x and r are wiped after the response.
export function createFamilySession({ request, X, send, onUpdate, unlock, timeoutMs = SESSION_MS }) {
  const { sessionId, fromDeviceId: parentId } = request;
  let state = 'pending';
  let x = null;
  let r = null;
  let R = null;
  let words = null;
  let reason = '';

  const update = () => onUpdate({ sessionId, state, words, reason });
  const wipe = () => { if (x) x.fill(0); x = null; r = null; };
  const isDone = () => ['done', 'denied', 'failed'].includes(state);
  const finish = (next, why = '') => {
    if (isDone()) return;
    wipe();
    state = next;
    reason = why;
    clearTimeout(timer);
    update();
  };
  const timer = setTimeout(() => finish('failed', 'timeout'), timeoutMs);
  update();

  async function approve(pin) {
    if (state !== 'pending') return;
    const secret = await unlock(pin); // throws 'wrong PIN' → caller shows error, state stays pending
    if (state !== 'pending') { secret.fill(0); return; } // timed out while decrypting
    x = secret;
    ({ r, R } = createCommitment()); // fresh r every session, used once
    state = 'committed';
    send('verify:commit', { sessionId, toDeviceId: parentId, R });
    update();
  }

  function deny() {
    if (state !== 'pending' && state !== 'committed') return;
    send('verify:deny', { sessionId, toDeviceId: parentId });
    finish('denied');
  }

  function handle(event, msg) {
    if (!msg || msg.sessionId !== sessionId || isDone()) return;
    if (event === 'verify:request') return; // duplicate of the request that created this session
    if (event === 'verify:error') return finish('failed', msg.reason || 'error');
    if (event === 'verify:challenge' && state === 'committed') {
      let s;
      try {
        parseScalar(msg.c);
        s = createResponse(x, r, msg.c);
      } catch {
        return finish('failed', 'bad challenge');
      } finally {
        wipe(); // x and r are never needed again
      }
      send('verify:response', { sessionId, toDeviceId: parentId, s });
      // Self-check with our own X so we only show words for a proof the parent will accept.
      if (!verifyProof({ X, R, c: msg.c, s })) return finish('failed', 'self-check failed');
      words = deriveWords({ sessionId, R, c: msg.c, s });
      state = 'done';
      clearTimeout(timer);
      return update();
    }
    return finish('failed', 'out of order');
  }

  return { sessionId, approve, deny, handle, cancel: () => finish('failed', 'cancelled'), get state() { return state; } };
}
