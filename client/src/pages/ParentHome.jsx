import { ShieldMark } from '../components/Brand.jsx';

const ICON = { son: '👨', daughter: '👩', grandson: '👦', granddaughter: '👧', other: '🧑' };

// One main action (UI rule): CHECK THIS CALL. Demo Mode is a clearly secondary presenter action.
export default function ParentHome({ parentName, members, onCheckCall, onDemo, onAdd, onChangeRole }) {
  return (
    <main className="screen">
      <div className="hero">
        <span className="eyebrow">Hello, {parentName}</span>
        <h1><ShieldMark size={34} /> Really You</h1>
        <p className="tagline"><strong>AI warns. Your family verifies.</strong></p>
      </div>
      <p className="lead">Got a call asking for money? Put it on <strong>speaker</strong> and tap:</p>
      <button className="big main-action" onClick={onCheckCall}>🎙 CHECK THIS CALL</button>
      <button className="big ghost" onClick={onDemo}>▶ Demo Mode</button>

      <h2>My family</h2>
      {members.length === 0 && <p className="lead">No family paired yet.</p>}
      <ul className="members">
        {members.map((m) => (
          <li key={m.deviceId} className="member">
            <span className="avatar">{ICON[m.relation] || '🧑'}</span>
            <span className="member-text"><strong>{m.name}</strong><small>{m.relation}</small></span>
          </li>
        ))}
      </ul>
      <button className="big secondary" onClick={onAdd}>➕ Add family member</button>
      <button type="button" className="link" onClick={onChangeRole}>Change role</button>
    </main>
  );
}
