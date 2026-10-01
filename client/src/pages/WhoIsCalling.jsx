import { useState } from 'react';
import Icon, { Banner, Avatar } from '../components/Icon.jsx';


export default function WhoIsCalling({ members, onPick, onCancel }) {
  const [picked, setPicked] = useState(false); // one verification request per tap
  return (
    <main className="screen">
      <button type="button" className="back" onClick={onCancel}><Icon name="arrowLeft" /> Back</button>
      <h1>Who is calling?</h1>
      <p className="lead">Tap the person the caller says they are.</p>
      {members.length === 0 && <Banner tone="yellow">No family paired yet. Do not send money.</Banner>}
      {members.map((m) => (
        <button key={m.deviceId} className="member-btn" disabled={picked} onClick={() => { setPicked(true); onPick(m); }}>
          <Avatar name={m.name} />
          <span className="member-text">{m.name}<small>{m.relation}</small></span>
          <Icon name="chevronRight" className="chev" />
        </button>
      ))}
    </main>
  );
}
