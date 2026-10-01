import { useEffect, useState } from 'react';
import RoleSelect from './pages/RoleSelect.jsx';
import FamilySetup from './pages/FamilySetup.jsx';
import FamilyHome from './pages/FamilyHome.jsx';
import ParentSetup from './pages/ParentSetup.jsx';
import ParentHome from './pages/ParentHome.jsx';
import ParentPair from './pages/ParentPair.jsx';
import { getDeviceId, getSetting, setSetting, getFamilyMembers, addFamilyMember } from './lib/storage.js';
import { getFamilyPublicKey, clearFamilySecret } from './lib/secretStore.js';
import { connectSocket } from './lib/socket.js';
import { speak } from './lib/speak.js';

const STATUS_TEXT = {
  connecting: '⏳ Connecting…',
  connected: '✅ Connected',
  offline: '⚠️ Offline',
  rejected: '⚠️ Server rejected device',
};

export default function App() {
  const [role, setRole] = useState(() => getSetting('role'));
  const [status, setStatus] = useState('connecting');
  const [loaded, setLoaded] = useState(false);
  const [familyProfile, setFamilyProfile] = useState(null); // { name, relation, X }
  const [parentName, setParentName] = useState(() => getSetting('parentName'));
  const [members, setMembers] = useState([]);
  const [screen, setScreen] = useState('home');
  const [toast, setToast] = useState('');
  const deviceId = getDeviceId();

  useEffect(() => {
    if (!role) return;
    setStatus('connecting');
    const s = connectSocket({ deviceId, role, onStatus: setStatus });
    return () => s.disconnect();
  }, [role, deviceId]);

  useEffect(() => {
    (async () => {
      const X = await getFamilyPublicKey();
      const p = getSetting('familyProfile');
      setFamilyProfile(X && p ? { ...p, X } : null);
      setMembers(await getFamilyMembers());
      setLoaded(true);
    })();
  }, []);

  function pickRole(r) {
    setSetting('role', r);
    setRole(r);
    setScreen('home');
  }

  async function onPaired(member) {
    setMembers(await addFamilyMember(member));
    setScreen('home');
    const msg = `Paired with ${member.name}, your ${member.relation}.`;
    setToast(msg);
    speak(msg);
  }

  async function resetFamily() {
    if (!confirm('Delete this device\'s key? Your parent will need to pair again.')) return;
    await clearFamilySecret();
    setSetting('familyProfile', undefined);
    setFamilyProfile(null);
  }

  if (!window.isSecureContext) {
    return (
      <main className="screen">
        <div className="banner yellow">⚠️ Not a secure (HTTPS) page. Microphone and crypto will not work. Open the https:// tunnel link.</div>
      </main>
    );
  }

  let page;
  if (!role) page = <RoleSelect onPick={pickRole} />;
  else if (!loaded) page = <main className="screen"><p>⏳ Loading…</p></main>;
  else if (role === 'family') {
    page = familyProfile
      ? <FamilyHome profile={familyProfile} deviceId={deviceId} onReset={resetFamily} />
      : <FamilySetup onDone={(p) => { setSetting('familyProfile', { name: p.name, relation: p.relation }); setFamilyProfile(p); }} />;
  } else if (!parentName) {
    page = <ParentSetup onDone={(n) => { setSetting('parentName', n); setParentName(n); }} />;
  } else if (screen === 'pair') {
    page = <ParentPair onPaired={onPaired} onCancel={() => setScreen('home')} />;
  } else {
    page = (
      <ParentHome
        parentName={parentName}
        members={members}
        onAdd={() => { setToast(''); setScreen('pair'); }}
        onChangeRole={() => pickRole(undefined)}
      />
    );
  }

  return (
    <>
      {role && <div className={`status ${status}`}>{STATUS_TEXT[status]}</div>}
      {toast && screen === 'home' && role === 'parent' && <div className="banner green toast">✅ {toast}</div>}
      {page}
    </>
  );
}
