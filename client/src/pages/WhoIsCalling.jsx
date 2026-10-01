const ICON = { son: '👨', daughter: '👩', grandson: '👦', granddaughter: '👧', other: '🧑' };

export default function WhoIsCalling({ members, onPick, onCancel }) {
  return (
    <main className="screen">
      <h1>📞 Who is calling?</h1>
      <p>Tap the person the caller says they are.</p>
      {members.length === 0 && <div className="banner yellow">⚠️ No family paired yet. Do not send money.</div>}
      {members.map((m) => (
        <button key={m.deviceId} className="big member-btn" onClick={() => onPick(m)}>
          <span className="member-icon">{ICON[m.relation] || '🧑'}</span> {m.name} <span className="small-dark">({m.relation})</span>
        </button>
      ))}
      <button className="big secondary" onClick={onCancel}>Back</button>
    </main>
  );
}
