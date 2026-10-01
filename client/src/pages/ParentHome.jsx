const ICON = { son: '👨', daughter: '👩', grandson: '👦', granddaughter: '👧', other: '🧑' };

export default function ParentHome({ parentName, members, onAdd, onChangeRole }) {
  return (
    <main className="screen">
      <h1>👴 Hello, {parentName}</h1>
      <h2>My family</h2>
      {members.length === 0 && <p>No family paired yet.</p>}
      <ul className="members">
        {members.map((m) => (
          <li key={m.deviceId} className="member">
            <span className="member-icon">{ICON[m.relation] || '🧑'}</span>
            <span><strong>{m.name}</strong><br /><span className="small">{m.relation}</span></span>
          </li>
        ))}
      </ul>
      <button className="big" onClick={onAdd}>➕ Add family member</button>
      <button type="button" className="link" onClick={onChangeRole}>Change role</button>
    </main>
  );
}
