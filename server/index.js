// Express + Socket.io relay. The server never decides "verified" and never sees secrets.
import express from 'express';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Server } from 'socket.io';

try { process.loadEnvFile(fileURLToPath(new URL('.env', import.meta.url))); } catch { /* no .env yet */ }

const PORT = Number(process.env.PORT) || 3000;
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { maxHttpBufferSize: 16 * 1024 });

const ID_RE = /^[a-zA-Z0-9-]{8,64}$/;
const ROLES = new Set(['parent', 'family']);

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
    console.log(`connected: ${msg.role} ${msg.deviceId.slice(0, 8)}…`);
    if (typeof ack === 'function') ack({ ok: true });
  });

  socket.on('disconnect', () => {
    if (socket.data.deviceId) console.log(`disconnected: ${socket.data.deviceId.slice(0, 8)}…`);
  });
});

httpServer.listen(PORT, () => console.log(`server on http://localhost:${PORT}`));
