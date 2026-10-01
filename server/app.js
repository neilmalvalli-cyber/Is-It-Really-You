// Express + Socket.io relay. The server never decides "verified" and never sees x, r or the PIN (rule 2).
import express from 'express';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Server } from 'socket.io';

const ID_RE = /^[a-zA-Z0-9-]{8,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const POINT_RE = /^0[23][0-9a-f]{64}$/;
const SCALAR_RE = /^[0-9a-f]{64}$/;
const ROLES = new Set(['parent', 'family']);

// Rule 11: every relayed message must have exactly these fields with these shapes.
const SCHEMAS = {
  'verify:request': {
    sessionId: (v) => UUID_RE.test(v), fromDeviceId: (v) => ID_RE.test(v), toDeviceId: (v) => ID_RE.test(v),
    parentName: (v) => typeof v === 'string' && v.length >= 1 && v.length <= 40,
    expiresAt: (v) => Number.isSafeInteger(v),
  },
  'verify:commit': { sessionId: (v) => UUID_RE.test(v), toDeviceId: (v) => ID_RE.test(v), R: (v) => POINT_RE.test(v) },
  'verify:challenge': { sessionId: (v) => UUID_RE.test(v), toDeviceId: (v) => ID_RE.test(v), c: (v) => SCALAR_RE.test(v) },
  'verify:response': { sessionId: (v) => UUID_RE.test(v), toDeviceId: (v) => ID_RE.test(v), s: (v) => SCALAR_RE.test(v) },
  'verify:deny': { sessionId: (v) => UUID_RE.test(v), toDeviceId: (v) => ID_RE.test(v) },
};

export function isValidMessage(event, msg) {
  const schema = SCHEMAS[event];
  if (!schema || !msg || typeof msg !== 'object' || Array.isArray(msg)) return false;
  const keys = Object.keys(msg);
  return keys.length === Object.keys(schema).length && keys.every((k) => schema[k] && schema[k](msg[k]));
}

export function createAppServer({ log = console.log } = {}) {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, { maxHttpBufferSize: 16 * 1024 });

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // Production: serve the built client so one port (and one tunnel) serves everything.
  const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../client/dist');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  io.on('connection', (socket) => {
    socket.on('register', (msg, ack) => {
      if (!msg || typeof msg !== 'object' || !ID_RE.test(msg.deviceId) || !ROLES.has(msg.role)) {
        if (typeof ack === 'function') ack({ ok: false });
        return;
      }
      if (socket.data.deviceId) socket.leave(socket.data.deviceId);
      socket.data.deviceId = msg.deviceId;
      socket.join(msg.deviceId);
      log(`connected: ${msg.role} ${msg.deviceId.slice(0, 8)}…`);
      if (typeof ack === 'function') ack({ ok: true });
    });

    for (const event of Object.keys(SCHEMAS)) {
      socket.on(event, (msg) => {
        if (!socket.data.deviceId) return; // must register first
        if (!isValidMessage(event, msg)) {
          const sessionId = msg && typeof msg.sessionId === 'string' && UUID_RE.test(msg.sessionId) ? msg.sessionId : null;
          socket.emit('verify:error', { sessionId, reason: 'invalid message' });
          return;
        }
        if (event === 'verify:request' && msg.fromDeviceId !== socket.data.deviceId) {
          socket.emit('verify:error', { sessionId: msg.sessionId, reason: 'invalid message' });
          return;
        }
        if (!io.sockets.adapter.rooms.get(msg.toDeviceId)?.size) {
          socket.emit('verify:error', { sessionId: msg.sessionId, reason: 'device offline' });
          return;
        }
        io.to(msg.toDeviceId).emit(event, msg); // forwarded unmodified
        log(`relay ${event} ${msg.sessionId.slice(0, 8)}… → ${msg.toDeviceId.slice(0, 8)}…`);
      });
    }

    socket.on('disconnect', () => {
      if (socket.data.deviceId) log(`disconnected: ${socket.data.deviceId.slice(0, 8)}…`);
    });
  });

  return { app, httpServer, io };
}
