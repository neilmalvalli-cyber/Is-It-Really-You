import { useEffect } from 'react';
import Countdown from '../components/Countdown.jsx';
import { speak } from '../lib/speak.js';

// Parent side of a verification. "Verified" requires BOTH a valid ZK proof (state 'proved', set only by
// verifySession after s·G == R + c·X) AND the parent tapping MATCHES. Nothing else can produce it.
const SPOKEN = {
  proved: 'Ask the caller to read the two words on their screen.',
  verified: 'It is really them.',
  not_them: 'This is not them. Do not pay.',
  denied: 'This is not them. Do not pay.',
  failed: 'Could not verify. Do not send money yet.',
};

export default function VerifyWait({ member, v, onMatch, onMismatch, onDone }) {
  useEffect(() => {
    // Never speak the words themselves — the call is on speaker and the caller would hear them.
    if (SPOKEN[v.state]) speak(SPOKEN[v.state]);
  }, [v.state]);

  if (v.state === 'requested' || v.state === 'challenged') {
    return (
      <main className="screen">
        <h1>⏳ Checking {member.name}'s phone…</h1>
        <p>{v.state === 'requested'
          ? `Asking ${member.name}'s device. ${member.name} must open the app and enter their PIN.`
          : '🔐 Checking the secret proof…'}</p>
        <Countdown until={v.expiresAt} />
        <div className="banner yellow">⚠️ Do not send money while we check.</div>
      </main>
    );
  }

  if (v.state === 'proved') {
    return (
      <main className="screen">
        <h1>🔐 Secret proof OK</h1>
        <p>Ask the caller: <strong>"Read me the two words on your screen."</strong></p>
        <div className="words" aria-label="code words">{v.words[0]}<br />{v.words[1]}</div>
        <p>Do they say exactly these two words?</p>
        <button className="big go" onClick={onMatch}>✅ MATCHES</button>
        <button className="big stop" onClick={onMismatch}>❌ DOESN'T MATCH</button>
      </main>
    );
  }

  const result = {
    verified: { cls: 'green', icon: '✅', title: `It's really ${member.name}`, text: 'The secret proof and the words both match.' },
    not_them: { cls: 'red', icon: '⛔', title: `NOT ${member.name} — do not pay`, text: 'Hang up. Call your family on a number you know.' },
    denied: { cls: 'red', icon: '⛔', title: `NOT ${member.name} — do not pay`, text: `${member.name} says they are not calling you. Hang up.` },
    failed: { cls: 'yellow', icon: '⚠️', title: 'Could not verify — do not send money yet', text: 'We could not check this caller. Wait and talk to your family first.' },
  }[v.state] ?? { cls: 'yellow', icon: '⚠️', title: 'Could not verify — do not send money yet', text: '' };

  return (
    <main className={`screen result ${result.cls}`}>
      <div className="result-icon">{result.icon}</div>
      <h1>{result.title}</h1>
      <p>{result.text}</p>
      <button className="big secondary" onClick={onDone}>Done</button>
    </main>
  );
}
