import { useState } from 'react';
import Countdown from '../components/Countdown.jsx';
import { Steps } from '../components/Brand.jsx';

const FAIL_TEXT = {
  timeout: 'The request expired before it was finished.',
  cancelled: 'The request was closed.',
};

// Family side. The protocol is unchanged: the session stays 'pending' through the ask and PIN steps,
// approve(pin) decrypts x and sends the commitment, the challenge/response runs automatically.
export default function FamilyApprove({ f, onApprove, onDeny, onClose }) {
  const [step, setStep] = useState('ask'); // 'ask' | 'pin' (only while the session is pending)
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function approve(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onApprove(pin);
    } catch (err) {
      setError(err.message === 'wrong PIN' ? 'That PIN is not correct. Please try again.' : 'Something went wrong. Please try again.');
    } finally {
      setPin('');
      setBusy(false);
    }
  }

  if (f.state === 'pending' && step === 'ask') {
    return (
      <main className="screen">
        <button type="button" className="back" onClick={onClose}>← Back</button>
        <span className="eyebrow">Incoming verification</span>
        <h1>📞 {f.parentName} is asking you to verify</h1>
        <p className="lead">They need you to confirm it's really you calling them right now.</p>
        <button className="big" onClick={() => setStep('pin')}>✓ VERIFY — it's me</button>
        <button className="big stop" onClick={onDeny}>✕ THAT'S NOT ME</button>
        <Countdown until={f.expiresAt} />
      </main>
    );
  }

  if (f.state === 'pending') {
    return (
      <form className="screen" onSubmit={approve}>
        <button type="button" className="back" onClick={() => { setPin(''); setError(''); setStep('ask'); }}>← Back</button>
        <h1>Enter your PIN</h1>
        <p className="lead">Enter your 6-digit PIN to verify.</p>
        <input className="pin" type="password" inputMode="numeric" autoComplete="off" maxLength={6} autoFocus aria-label="6-digit PIN"
          value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
        {error && <div className="banner red" role="alert">⛔ {error}</div>}
        <button className="big" disabled={busy || pin.length !== 6}>{busy ? 'Checking PIN…' : 'Continue'}</button>
        <Countdown until={f.expiresAt} />
      </form>
    );
  }

  if (f.state === 'committed') {
    return (
      <main className="screen">
        <h1>Verifying…</h1>
        <p className="lead">Completing secure verification.</p>
        <div className="card">
          <Steps steps={[['done', 'PIN verified'], ['done', 'Creating secure proof'], ['active', 'Sending verification']]} />
        </div>
        <Countdown until={f.expiresAt} />
      </main>
    );
  }

  if (f.state === 'done') {
    return (
      <main className="screen">
        <button type="button" className="back" onClick={onClose}>← Back</button>
        <span className="eyebrow">✓ Verified on your device</span>
        <h1>Your verification words</h1>
        <p className="lead">Tell these two words to {f.parentName}.</p>
        <div className="words">
          <div className="word">{f.words[0]}</div>
          <div className="word">{f.words[1]}</div>
        </div>
        <button className="big secondary" onClick={onClose}>Done</button>
      </main>
    );
  }

  const denied = f.state === 'denied';
  return (
    <main className={`screen result ${denied ? 'red' : 'yellow'}`}>
      <button type="button" className="back" onClick={onClose}>← Back</button>
      <div className="result-badge" aria-hidden="true">{denied ? '✕' : '!'}</div>
      <h1>{denied ? "You said it's not you" : 'Could not verify'}</h1>
      <p className="lead">{denied ? `${f.parentName} has been told: do not pay.` : (FAIL_TEXT[f.reason] || 'Ask them to try again.')}</p>
      <button className="big secondary" onClick={onClose}>Close</button>
    </main>
  );
}
