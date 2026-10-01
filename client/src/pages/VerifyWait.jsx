import { useEffect, useState } from 'react';
import Countdown from '../components/Countdown.jsx';
import { Steps } from '../components/Brand.jsx';
import { speak } from '../lib/speak.js';

// Parent side of a verification. "Verified" requires BOTH a valid ZK proof (state 'proved', set only by
// verifySession after s·G == R + c·X) AND the parent tapping MATCH. Nothing else can produce it.
const SPOKEN = {
  proved: 'Ask the caller to tell you the two words on their screen.',
  verified: 'It is really them.',
  not_them: 'This is not them. Do not pay.',
  denied: 'This is not them. Do not pay.',
  failed: 'Could not verify. Do not send money yet.',
};

export default function VerifyWait({ member, v, onMatch, onMismatch, onDone }) {
  const [answered, setAnswered] = useState(false); // MATCH / DOESN'T MATCH can only be tapped once

  useEffect(() => {
    // Never speak the words themselves — the call is on speaker and the caller would hear them.
    if (SPOKEN[v.state]) speak(SPOKEN[v.state]);
  }, [v.state]);

  if (v.state === 'requested' || v.state === 'challenged') {
    return (
      <main className="screen">
        <button type="button" className="back" onClick={onDone}>← Cancel</button>
        <span className="eyebrow">Verification</span>
        <h1>Request sent to {member.name}</h1>
        <p className="lead">Waiting for them to verify on their device…</p>
        <div className="card">
          <Steps steps={[
            ['done', 'Request sent'],
            [v.state === 'requested' ? 'active' : 'done', `${member.name} enters their PIN`],
            [v.state === 'challenged' ? 'active' : 'todo', "You'll both see the same two words"],
          ]} />
          <Countdown until={v.expiresAt} />
        </div>
        <div className="banner yellow">⚠️ Do not send money while we check.</div>
        <button className="big ghost" onClick={onDone}>Cancel</button>
      </main>
    );
  }

  if (v.state === 'proved') {
    const pick = (fn) => { if (answered) return; setAnswered(true); fn(); };
    return (
      <main className="screen">
        <button type="button" className="back" disabled={answered} onClick={onDone}>← Cancel</button>
        <span className="eyebrow">🔐 {member.name}'s device passed the secure check</span>
        <h1>Ask them to tell you these two words</h1>
        <div className="words" aria-label="verification words">
          <div className="word">{v.words[0]}</div>
          <div className="word">{v.words[1]}</div>
        </div>
        <p className="lead">Do they say exactly these two words?</p>
        <button className="big go" disabled={answered} onClick={() => pick(onMatch)}>✓ MATCH</button>
        <button className="big stop" disabled={answered} onClick={() => pick(onMismatch)}>✕ DOESN'T MATCH</button>
      </main>
    );
  }

  const result = {
    verified: { cls: 'green', icon: '✓', title: `It's really ${member.name}`, text: 'The secure check passed and the two words match.' },
    not_them: { cls: 'red', icon: '✕', title: `NOT ${member.name} — do not pay`, text: 'Hang up. Call your family on a number you know.' },
    denied: { cls: 'red', icon: '✕', title: `NOT ${member.name} — do not pay`, text: `${member.name} says they are not calling you. Hang up.` },
    failed: { cls: 'yellow', icon: '!', title: 'Could not verify — do not send money yet', text: 'We could not check this caller. Wait and talk to your family first.' },
  }[v.state] ?? { cls: 'yellow', icon: '!', title: 'Could not verify — do not send money yet', text: '' };

  return (
    <main className={`screen result ${result.cls}`}>
      <button type="button" className="back" onClick={onDone}>← Back to home</button>
      <div className="result-badge" aria-hidden="true">{result.icon}</div>
      <h1>{result.title}</h1>
      <p className="lead">{result.text}</p>
      <button className="big secondary" onClick={onDone}>Done</button>
    </main>
  );
}
