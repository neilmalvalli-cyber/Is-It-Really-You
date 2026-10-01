import { useEffect, useRef, useState } from 'react';
import RoleSelect from './pages/RoleSelect.jsx';
import FamilySetup from './pages/FamilySetup.jsx';
import FamilyHome from './pages/FamilyHome.jsx';
import FamilyPair from './pages/FamilyPair.jsx';
import { Header } from './components/Brand.jsx';
import FamilyApprove from './pages/FamilyApprove.jsx';
import ParentSetup from './pages/ParentSetup.jsx';
import ParentHome from './pages/ParentHome.jsx';
import ParentPair from './pages/ParentPair.jsx';
import WhoIsCalling from './pages/WhoIsCalling.jsx';
import VerifyWait from './pages/VerifyWait.jsx';
import CallCheck from './pages/CallCheck.jsx';
import { getDeviceId, getSetting, setSetting, getFamilyMembers, addFamilyMember, removeFamilyMember } from './lib/storage.js';
import { getFamilyPublicKey, clearFamilySecret, unlockFamilySecret } from './lib/secretStore.js';
import { connectSocket, send } from './lib/socket.js';
import { createParentSession, createFamilySession, isValidRequest, SESSION_MS } from './lib/verifySession.js';
import { speak } from './lib/speak.js';
import { Banner } from './components/Icon.jsx';
import Intro from './components/Intro.jsx';


export default function App() {
  const [role, setRole] = useState(() => getSetting('role'));
  const [status, setStatus] = useState('connecting');
  const [loaded, setLoaded] = useState(false);
  const [familyProfile, setFamilyProfile] = useState(null); // { name, relation, X }
  const [parentName, setParentName] = useState(() => getSetting('parentName'));
  const [members, setMembers] = useState([]);
  const [screen, setScreen] = useState('home');
  const [toast, setToast] = useState('');
  const [verify, setVerify] = useState(null); // parent: { member, sessionId, state, words, reason, expiresAt }
  const [famReq, setFamReq] = useState(null); // family: { parentName, sessionId, state, words, reason, expiresAt }
  const sessionRef = useRef(null); // the active parent or family session
  const profileRef = useRef(null);
  const deviceId = getDeviceId();
  profileRef.current = familyProfile;

  // Every verify:* message from the relay goes to the active session; a family device also starts new ones.
  function onMessage(event, msg) {
    if (event === 'verify:request' && role === 'family') {
      if (!profileRef.current || !isValidRequest(msg, deviceId)) return;
      if (sessionRef.current?.sessionId === msg.sessionId) return;
      sessionRef.current?.cancel();
      const expiresAt = Date.now() + SESSION_MS;
      const parent = msg.parentName;
      sessionRef.current = createFamilySession({
        request: msg,
        X: profileRef.current.X,
        send,
        unlock: unlockFamilySecret,
        onUpdate: (u) => setFamReq({ ...u, parentName: parent, expiresAt }),
      });
      speak(`${parent} wants to verify a call.`);
      return;
    }
    sessionRef.current?.handle(event, msg);
  }
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!role) return;
    setStatus('connecting');
    const s = connectSocket({ deviceId, role, onStatus: setStatus, onMessage: (e, m) => onMessageRef.current(e, m) });
    return () => {
      sessionRef.current?.cancel();
      sessionRef.current = null;
      s.disconnect();
    };
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
    setScreen('home');
  }

  function startVerify(member) {
    sessionRef.current?.cancel();
    const expiresAt = Date.now() + SESSION_MS;
    sessionRef.current = createParentSession({
      member,
      parentName,
      myDeviceId: deviceId,
      send,
      onUpdate: (u) => setVerify({ ...u, member, expiresAt }),
    });
    setScreen('verify');
  }

  function endVerify() {
    sessionRef.current?.cancel();
    sessionRef.current = null;
    setVerify(null);
    setScreen('home');
  }

  function closeFamilyRequest() {
    sessionRef.current?.cancel();
    sessionRef.current = null;
    setFamReq(null);
  }

  if (!window.isSecureContext) {
    return (
      <main className="screen">
        <h1>Really You</h1>
        <Banner tone="yellow">Not a secure (HTTPS) page. Microphone and crypto will not work. Open the https:// tunnel link.</Banner>
      </main>
    );
  }

  let page;
  if (!role) page = <RoleSelect onPick={pickRole} />;
  else if (!loaded) page = <main className="screen"><div className="checking"><span className="spinner" /> Loading…</div></main>;
  else if (role === 'family') {
    if (!familyProfile) {
      page = <FamilySetup onBack={() => pickRole(undefined)} onDone={(p) => { setSetting('familyProfile', { name: p.name, relation: p.relation }); setFamilyProfile(p); }} />;
    } else if (famReq) {
      page = (
        <FamilyApprove
          f={famReq}
          onApprove={(pin) => sessionRef.current.approve(pin)}
          onDeny={() => sessionRef.current?.deny()}
          onClose={closeFamilyRequest}
        />
      );
    } else if (screen === 'pair') {
      page = <FamilyPair profile={familyProfile} deviceId={deviceId} onBack={() => setScreen('home')} onReset={resetFamily} />;
    } else {
      page = <FamilyHome profile={familyProfile} onPair={() => setScreen('pair')} onChangeRole={() => pickRole(undefined)} />;
    }
  } else if (!parentName) {
    page = <ParentSetup onBack={() => pickRole(undefined)} onDone={(n) => { setSetting('parentName', n); setParentName(n); }} />;
  } else if (screen === 'pair') {
    page = <ParentPair onPaired={onPaired} onCancel={() => setScreen('home')} />;
  } else if (screen === 'call' || screen === 'demo') {
    page = <CallCheck key={screen} initialMode={screen === 'demo' ? 'pick' : null} onVerify={() => setScreen('who')} onExit={() => setScreen('home')} />;
  } else if (screen === 'who') {
    page = <WhoIsCalling members={members} onPick={startVerify} onCancel={() => setScreen('home')} />;
  } else if (screen === 'verify' && verify) {
    page = (
      <VerifyWait
        member={verify.member}
        v={verify}
        onMatch={() => sessionRef.current?.matches()}
        onMismatch={() => sessionRef.current?.mismatch()}
        onDone={endVerify}
      />
    );
  } else {
    page = (
      <ParentHome
        parentName={parentName}
        members={members}
        onAdd={() => { setToast(''); setScreen('pair'); }}
        onCheckCall={() => { setToast(''); setScreen('call'); }}
        onDemo={() => { setToast(''); setScreen('demo'); }}
        onRemove={async (m) => { setMembers(await removeFamilyMember(m.deviceId)); setToast(`Removed ${m.name}.`); }}
        onChangeRole={() => pickRole(undefined)}
      />
    );
  }

  return (
    <div className={`app-root ${role === 'family' ? 'is-family' : ''}`}>
      <Intro />
      <div className="marble-background" aria-hidden="true" />
      <div className="glass-shell">
        <Header status={status} role={role} />
        {toast && screen === 'home' && role === 'parent' && <div className="toast"><Banner tone="green">{toast}</Banner></div>}
        {page}
      </div>
    </div>
  );
}
