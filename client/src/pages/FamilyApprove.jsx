import { useState } from 'react';
import Countdown from '../components/Countdown.jsx';

export default function FamilyApprove({ f, onApprove, onDeny, onClose }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function approve(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onApprove(pin);
    } catch (err) {
      setError(err.message === 'wrong PIN' ? 'Wrong PIN. Try again.' : `Error: ${err.message}`);
    } finally {
      setPin('');
      setBusy(false);
    }
  }

  if (f.state === 'pending') {
    return (
      <form className="screen" onSubmit={approve}>
        <h1>📞 {f.parentName} wants to verify a call</h1>
        <p><strong>Is it you calling {f.parentName} right now?</strong></p>
        <label>Enter your PIN to prove it
          <input type="password" inputMode="numeric" autoComplete="off" maxLength={6} autoFocus
            value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
        </label>
        {error && <div className="banner red" role="alert">⛔ {error}</div>}
        <button className="big go" disabled={busy || pin.length !== 6}>{busy ? '⏳ Unlocking…' : "✅ Yes, it's me"}</button>
        <button type="button" className="big stop" onClick={onDeny}>❌ That's not me</button>
        <Countdown until={f.expiresAt} />
      </form>
    );
  }

  if (f.state === 'committed') {
    return <main className="screen"><h1>🔐 Proving it's you…</h1><Countdown until={f.expiresAt} /></main>;
  }

  if (f.state === 'done') {
    return (
      <main className="screen">
        <h1>🗣️ Read these words to {f.parentName}</h1>
        <div className="words">{f.words[0]}<br />{f.words[1]}</div>
        <button className="big secondary" onClick={onClose}>Done</button>
      </main>
    );
  }

  const msg = f.state === 'denied'
    ? { cls: 'red', text: `⛔ You said it's not you. ${f.parentName} has been told: do not pay.` }
    : { cls: 'yellow', text: `⚠️ Could not verify (${f.reason || 'error'}).` };
  return (
    <main className="screen">
      <div className={`banner ${msg.cls}`}>{msg.text}</div>
      <button className="big secondary" onClick={onClose}>Back</button>
    </main>
  );
}
