import { io } from 'socket.io-client';

let socket;

// One shared socket; re-registers on every (re)connect so the server room survives reconnects.
export function connectSocket({ deviceId, role, onStatus }) {
  if (socket) socket.disconnect();
  socket = io({ transports: ['websocket', 'polling'] });
  socket.on('connect', () => {
    socket.emit('register', { deviceId, role }, (res) => onStatus(res?.ok ? 'connected' : 'rejected'));
  });
  socket.on('disconnect', () => onStatus('offline'));
  socket.on('connect_error', () => onStatus('offline'));
  return socket;
}

export function getSocket() {
  return socket;
}
