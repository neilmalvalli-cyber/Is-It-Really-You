export default function RoleSelect({ onPick }) {
  return (
    <main className="screen">
      <h1>Is It Really You?</h1>
      <p>Who uses this device?</p>
      <button className="big" onClick={() => onPick('parent')}>👴 I am the Parent</button>
      <button className="big secondary" onClick={() => onPick('family')}>🧑 I am Family</button>
    </main>
  );
}
