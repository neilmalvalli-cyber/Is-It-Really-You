import { useEffect, useState } from 'react';
import RoleSelect from './pages/RoleSelect.jsx';
import { getDeviceId, getSetting, setSetting } from './lib/storage.js';
import { connectSocket } from './lib/socket.js';

const STATUS_TEXT = {
  connecting: '⏳ Connecting…',
  connected: '✅ Connected',
  offline: '⚠️ Offline',
  rejected: '⚠️ Server rejected device',
};

export default function App() {
  const [role, setRole] = useState(() => getSetting('role'));
  const [status, setStatus] = useState('connecting');
  const deviceId = getDeviceId();

  useEffect(() => {
    if (!role) return;
    setStatus('connecting');
    const s = connectSocket({ deviceId, role, onStatus: setStatus });
    return () => s.disconnect();
  }, [role, deviceId]);

  function pick(r) {
    setSetting('role', r);
    setRole(r);
  }

  if (!window.isSecureContext) {
    return (
      <main className="screen">
        <div className="banner yellow">⚠️ Not a secure (HTTPS) page. Microphone and crypto will not work. Open the https:// tunnel link.</div>
      </main>
    );
  }

  if (!role) return <RoleSelect onPick={pick} />;

  return (
    <main className="screen">
      <div className={`status ${status}`}>{STATUS_TEXT[status]}</div>
      <h1>{role === 'parent' ? '👴 Parent' : '👩 Family'}</h1>
      <p className="small">Device {deviceId.slice(0, 8)}</p>
      <button className="big secondary" onClick={() => pick(undefined)}>Change role</button>
    </main>
  );
}
