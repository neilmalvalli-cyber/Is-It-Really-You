import { useState } from 'react';
import Icon, { Avatar } from '../components/Icon.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

// One main action (UI rule): CHECK THIS CALL. Demo Mode is a clearly secondary presenter action.
export default function ParentHome({ parentName, members, onCheckCall, onDemo, onAdd, onRemove, onChangeRole }) {
  const [removing, setRemoving] = useState(null); // member awaiting confirmation

  return (
    <main className="screen">
      <div className="hero">
        <span className="eyebrow">Hello, {parentName}</span>
        <h1>Really You</h1>
        <p className="tagline">AI warns. Your family verifies.</p>
      </div>
      <p className="lead">Got a call asking for money? Put it on <strong>speaker</strong> and tap:</p>
      <button className="big main-action" onClick={onCheckCall}><Icon name="mic" /> Check this call</button>
      <button className="big ghost" onClick={onDemo}><Icon name="play" /> Demo Mode</button>

      <div className="section-head">
        <h2>My family</h2>
        <span className="small">{members.length} paired</span>
      </div>
      {members.length === 0 && <p className="lead">No family paired yet.</p>}
      <ul className="members">
        {members.map((m) => (
          <li key={m.deviceId} className="member">
            <Avatar name={m.name} />
            <span className="member-text"><strong>{m.name}</strong><small>{m.relation}</small></span>
            <button type="button" className="icon-btn danger" aria-label={`Remove ${m.name}`} title={`Remove ${m.name}`} onClick={() => setRemoving(m)}>
              <Icon name="trash" />
            </button>
          </li>
        ))}
      </ul>
      <button className="big secondary" onClick={onAdd}><Icon name="plus" /> Add family member</button>
      <button type="button" className="link" onClick={onChangeRole}>Change role</button>

      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.name}?`}
          confirmLabel="Remove"
          onCancel={() => setRemoving(null)}
          onConfirm={() => { const m = removing; setRemoving(null); onRemove(m); }}
        >
          {removing.name} will no longer be able to verify calls on this phone. You can pair again later by scanning their QR code.
        </ConfirmDialog>
      )}
    </main>
  );
}
