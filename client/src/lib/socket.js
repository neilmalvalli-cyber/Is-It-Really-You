import { io } from 'socket.io-client';

let socket;

export const VERIFY_EVENTS = ['verify:request', 'verify:commit', 'verify:challenge', 'verify:response', 'verify:deny', 'verify:error'];

// One shared socket; re-registers on every (re)connect so the server room survives reconnects.
// onMessage(event, payload) receives every verify:* event.
export function connectSocket({ deviceId, role, onStatus, onMessage }) {
  if (socket) socket.disconnect();
  socket = io({
    transports: ['websocket', 'polling'],
    tryAllTransports: true, // fall back to long-polling if a proxy blocks websockets
    extraHeaders: { 'ngrok-skip-browser-warning': '1' }, // polling requests through ngrok's free tier
  });
  socket.on('connect', () => {
    socket.emit('register', { deviceId, role }, (res) => onStatus(res?.ok ? 'connected' : 'rejected'));
  });
  socket.on('disconnect', () => onStatus('reconnecting'));
  socket.on('connect_error', () => onStatus('offline'));
  socket.io.on('reconnect_attempt', () => onStatus('reconnecting'));
  for (const e of VERIFY_EVENTS) socket.on(e, (msg) => onMessage?.(e, msg));
  return socket;
}

export function send(event, msg) {
  socket?.emit(event, msg);
}
