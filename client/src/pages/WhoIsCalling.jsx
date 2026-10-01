import { useState } from 'react';

const ICON = { son: '👨', daughter: '👩', grandson: '👦', granddaughter: '👧', other: '🧑' };

export default function WhoIsCalling({ members, onPick, onCancel }) {
  const [picked, setPicked] = useState(false); // one verification request per tap
  return (
    <main className="screen">
      <button type="button" className="back" onClick={onCancel}>← Back</button>
      <h1>Who is calling?</h1>
      <p className="lead">Tap the person the caller says they are.</p>
      {members.length === 0 && <div className="banner yellow">⚠️ No family paired yet. Do not send money.</div>}
      {members.map((m) => (
        <button key={m.deviceId} className="member-btn" disabled={picked} onClick={() => { setPicked(true); onPick(m); }}>
          <span className="avatar">{ICON[m.relation] || '🧑'}</span>
          <span className="member-text">{m.name}<small>{m.relation}</small></span>
          <span className="chev" aria-hidden="true">›</span>
        </button>
      ))}
    </main>
  );
}
