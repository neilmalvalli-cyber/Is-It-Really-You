import { useEffect, useRef, useState } from 'react';
import { INITIAL_RISK, addVerdict } from '../lib/risk.js';
import { listDemoClips, sendChunk, startDemoClip, startMic } from '../lib/audio.js';
import { speak } from '../lib/speak.js';

const METER = {
  idle: { cls: 'idle', icon: '👂', word: 'Listening…', text: 'First check in about 15 seconds.' },
  green: { cls: 'green', icon: '✅', word: 'No scam signs yet', text: 'Keep listening. Never share OTP or PIN.' },
  yellow: { cls: 'yellow', icon: '⚠️', word: 'Be careful', text: 'Do not send money yet.' },
  red: { cls: 'red', icon: '⛔', word: 'Possible scam', text: 'Do not send money. Verify first.' },
};
const SPOKEN = { yellow: 'Be careful. Do not send money yet.', red: 'This may be a scam. Do not send money. Verify first.' };
const TACTIC_TEXT = {
  urgency: 'Hurry / urgency', secrecy: 'Asks for secrecy', money_request: 'Asks for money', fake_authority: 'Fake police / bank',
  new_number_excuse: 'New number excuse', emotional_pressure: 'Emotional pressure', otp_request: 'Asks for OTP / PIN',
  avoids_questions: 'Avoids questions',
};

export default function CallCheck({ onVerify, onExit }) {
  const [risk, setRisk] = useState(INITIAL_RISK);
  const [mode, setMode] = useState(null); // null | 'mic' | clip filename
  const [clips, setClips] = useState([]);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState('');
  const [popupClosed, setPopupClosed] = useState(false);
  const stopRef = useRef(null);
  const callIdRef = useRef(0);

  useEffect(() => { listDemoClips().then(setClips); return () => stopRef.current?.(); }, []);
  useEffect(() => { if (SPOKEN[risk.level]) speak(SPOKEN[risk.level]); }, [risk.level]);

  function onChunk(blob) {
    const callId = callIdRef.current;
    setPending((p) => p + 1);
    sendChunk(blob).then((verdict) => {
      setPending((p) => p - 1);
      if (callId === callIdRef.current) setRisk((r) => addVerdict(r, verdict));
    });
  }

  async function start(which) {
    stopRef.current?.();
    callIdRef.current += 1;
    setRisk(INITIAL_RISK);
    setPopupClosed(false);
    setError('');
    try {
      stopRef.current = which === 'mic'
        ? await startMic(onChunk)
        : await startDemoClip(`/demo-audio/${encodeURIComponent(which)}`, onChunk, () => setMode((m) => (m === which ? 'ended' : m)));
      setMode(which);
    } catch (err) {
      setMode(null);
      setError(which === 'mic' ? 'Microphone not allowed. Allow it in the browser and try again.' : `Could not play clip (${err.message}).`);
    }
  }

  function stop() {
    stopRef.current?.();
    stopRef.current = null;
    setMode('ended');
  }

  const m = METER[risk.level];
  const latest = risk.reasons.at(-1);
  const tactics = [...new Set(risk.reasons.flatMap((r) => r.tactics))];

  if (!mode) {
    return (
      <main className="screen">
        <h1>📞 Check this call</h1>
        <p>Put the call on <strong>speaker</strong>, then tap the button.</p>
        <button className="big" onClick={() => start('mic')}>🎙️ Start listening</button>
        {error && <div className="banner red" role="alert">⛔ {error}</div>}
        {clips.length > 0 && (
          <section className="demo">
            <h2>Demo mode</h2>
            {clips.map((c) => <button key={c} className="big secondary" onClick={() => start(c)}>▶️ {c.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')}</button>)}
          </section>
        )}
        <button className="big secondary" onClick={onExit}>Back</button>
      </main>
    );
  }

  return (
    <main className="screen">
      <div className={`meter ${m.cls}`} role="status">
        <div className="meter-icon">{m.icon}</div>
        <div className="meter-word">{m.word}</div>
        <p>{m.text}</p>
      </div>
      {latest && <p className="reason">💬 {latest.reason}</p>}
      {latest?.quote && <p className="quote">“{latest.quote}”</p>}
      {tactics.length > 0 && <ul className="tactics">{tactics.map((t) => <li key={t}>{TACTIC_TEXT[t] || t}</li>)}</ul>}
      {pending > 0 && <p className="small">⏳ Checking…</p>}
      {mode === 'ended'
        ? <p className="small">Listening stopped.</p>
        : <button className="big secondary" onClick={stop}>⏹️ Stop listening</button>}
      {risk.level !== 'idle' && risk.level !== 'green' && <button className="big" onClick={() => { stop(); onVerify(); }}>🔐 VERIFY the caller</button>}
      <button className="big secondary" onClick={() => { stop(); onExit(); }}>Back</button>

      {risk.level === 'red' && !popupClosed && (
        <div className="popup" role="alertdialog" aria-label="Possible scam">
          <div className="result-icon">⛔</div>
          <h1>This may be a scam</h1>
          <p className="popup-text">Do not send money.<br />Verify first.</p>
          {latest?.reason && <p>{latest.reason}</p>}
          <button className="big" onClick={() => { stop(); onVerify(); }}>🔐 VERIFY</button>
          <button className="big secondary" onClick={() => setPopupClosed(true)}>Close</button>
        </div>
      )}
    </main>
  );
}
