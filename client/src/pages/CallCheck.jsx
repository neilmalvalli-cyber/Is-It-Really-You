import { useEffect, useRef, useState } from 'react';
import { INITIAL_RISK, addVerdict } from '../lib/risk.js';
import { listDemoClips, sendChunk, startDemoClip, startMic } from '../lib/audio.js';
import { speak } from '../lib/speak.js';

// Plain-language risk states. Never shows HTTP codes, model names or JSON to the user.
// Gemini only gives advice here — nothing on this screen can produce "Verified".
function riskView(risk) {
  if (risk.level === 'red') {
    return { cls: 'red', icon: '⚠️', title: 'This may be a scam', lines: ['Do not send money.', 'Verify first.'] };
  }
  if (risk.level === 'yellow') {
    return risk.medium > 0
      ? { cls: 'yellow', icon: '⚠️', title: 'Be careful', lines: ['Some warning signs were heard.', 'Do not send money yet.'] }
      : { cls: 'yellow', icon: '⚠️', title: "We couldn't fully check this call", lines: ['Do not send money yet.', 'You can still verify with your family member.'] };
  }
  if (risk.level === 'green') {
    return { cls: 'green', icon: '✅', title: 'No common scam warning signs detected', lines: ['This does NOT guarantee safety.', 'If unsure, verify with your family member.'] };
  }
  return null;
}
const SPOKEN = {
  red: 'This may be a scam. Do not send money. Verify first.',
  yellow: 'Be careful. Do not send money yet.',
};
const TACTIC_TEXT = {
  urgency: 'Hurry / urgency', secrecy: 'Asks for secrecy', money_request: 'Asks for money', fake_authority: 'Fake police / bank',
  new_number_excuse: 'New number excuse', emotional_pressure: 'Emotional pressure', otp_request: 'Asks for OTP / PIN',
  avoids_questions: 'Avoids questions',
};

export default function CallCheck({ onVerify, onExit, initialMode = null }) {
  const [risk, setRisk] = useState(INITIAL_RISK);
  const [mode, setMode] = useState(initialMode); // null | 'pick' (demo clip list) | 'mic' | clip filename | 'ended'
  const [clips, setClips] = useState(null); // null = loading, [] = none found, false = could not load
  const [pending, setPending] = useState(0);
  const [error, setError] = useState('');
  const [popupClosed, setPopupClosed] = useState(false);
  const stopRef = useRef(null);
  const callIdRef = useRef(0);
  const startingRef = useRef(false);
  const [running, setRunning] = useState(''); // 'mic' or the demo clip file name

  const loadClips = () => { setClips(null); listDemoClips().then(setClips); };
  useEffect(() => {
    loadClips();
    return () => { callIdRef.current += 1; stopRef.current?.(); }; // leaving: drop any last chunk of this call
  }, []);
  useEffect(() => { if (SPOKEN[risk.level]) speak(SPOKEN[risk.level]); }, [risk.level]);

  // Each call gets its own id, fixed when recording starts. A chunk from an older call (e.g. the final chunk
  // flushed when a new demo clip starts) is dropped before upload, so it can never touch the new call's risk.
  function chunkHandler(callId) {
    return (blob) => {
      if (callId !== callIdRef.current) return;
      setPending((p) => p + 1);
      sendChunk(blob).then((verdict) => {
        setPending((p) => p - 1);
        if (callId === callIdRef.current) setRisk((r) => addVerdict(r, verdict));
      });
    };
  }

  async function start(which) {
    if (startingRef.current) return; // ignore double taps while starting
    startingRef.current = true;
    callIdRef.current += 1; // new call: older chunks are now stale
    const callId = callIdRef.current;
    stopRef.current?.();
    stopRef.current = null;
    setRisk(INITIAL_RISK);
    setPending(0);
    setPopupClosed(false);
    setError('');
    try {
      const onChunk = chunkHandler(callId);
      stopRef.current = which === 'mic'
        ? await startMic(onChunk)
        : await startDemoClip(`/demo-audio/${encodeURIComponent(which)}`, onChunk, () => setMode((m) => (m === which ? 'ended' : m)));
      setMode(which);
      setRunning(which);
    } catch (err) {
      setMode(which === 'mic' ? null : 'pick');
      setError(which === 'mic'
        ? (err?.message === 'unsupported' ? 'This browser cannot record audio. Use Chrome.' : 'Microphone not allowed. Allow it in the browser and try again.')
        : 'Could not play this recording. Try another one, or tap Refresh.');
    } finally {
      startingRef.current = false;
    }
  }

  function stop() {
    stopRef.current?.();
    stopRef.current = null;
    setMode('ended');
  }

  function verify() {
    stop();
    callIdRef.current += 1; // the call is over; ignore late chunks
    onVerify();
  }

  const view = riskView(risk);
  const latest = risk.reasons.at(-1);
  const tactics = [...new Set(risk.reasons.flatMap((r) => r.tactics))];
  const clipLabel = (c) => c.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
  const exit = () => { stop(); callIdRef.current += 1; onExit(); };

  if (!mode) {
    return (
      <main className="screen">
        <button type="button" className="back" onClick={onExit}>← Back</button>
        <h1>Check this call</h1>
        <div className="card">
          <p>1. Put the call on <strong>speaker</strong>.</p>
          <p>2. Tap the button. We listen for scam tricks like hurry, secrecy or money requests.</p>
        </div>
        <button className="big main-action" onClick={() => start('mic')}>🎙 Start listening</button>
        {error && <div className="banner red" role="alert">⛔ {error}</div>}
        <button className="big ghost" onClick={() => { setError(''); setMode('pick'); }}>▶ Demo Mode</button>
      </main>
    );
  }

  if (mode === 'pick') {
    return (
      <main className="screen">
        <button type="button" className="back" onClick={() => { setError(''); if (initialMode === 'pick') onExit(); else setMode(null); }}>← Back</button>
        <span className="eyebrow">Demo Mode</span>
        <h1>Play a recorded call</h1>
        <p className="lead">The recording plays out loud and is checked by the same AI scam check as a real call.</p>
        {error && <div className="banner red" role="alert">⛔ {error}</div>}
        {clips === null && <div className="checking"><span className="spinner" /> Loading recordings…</div>}
        {clips === false && <div className="banner yellow">⚠️ Could not load the recordings from the server.</div>}
        {Array.isArray(clips) && clips.length === 0 && (
          <div className="banner yellow">⚠️ No recordings found. Put .mp3, .m4a, .wav, .ogg or .webm files in the <code>demo-audio/</code> folder next to the server, then tap Refresh.</div>
        )}
        {Array.isArray(clips) && clips.map((c) => (
          <button key={c} className="big" onClick={() => start(c)}>▶ {clipLabel(c)}</button>
        ))}
        <button className="big secondary" onClick={loadClips}>🔄 Refresh list</button>
      </main>
    );
  }

  const listeningNow = mode !== 'ended';
  const canVerify = risk.level !== 'idle';

  return (
    <main className="screen">
      <button type="button" className="back" onClick={exit}>← Back</button>
      <span className="source">{running === 'mic' ? '🎙 Microphone' : `▶ Demo: ${clipLabel(running)}`}</span>

      {view ? (
        <section className={`risk ${view.cls}`} role="status">
          <div className="risk-head"><span className="risk-icon" aria-hidden="true">{view.icon}</span><h2>{view.title}</h2></div>
          {view.lines.map((l) => <p key={l}>{view.cls === 'red' ? <strong>{l}</strong> : l}</p>)}
        </section>
      ) : (
        <section className="card listening" role="status">
          <div className={`wave ${listeningNow ? '' : 'paused'}`} aria-hidden="true"><span /><span /><span /><span /><span /></div>
          <h2>{listeningNow ? 'Listening to the call…' : 'Stopped listening'}</h2>
          <p className="lead">Recording a short sample to check for scam tactics.</p>
        </section>
      )}

      {latest && <p className="reason">💬 {latest.reason}</p>}
      {latest?.quote && <p className="quote">“{latest.quote}”</p>}
      {tactics.length > 0 && <ul className="tactics">{tactics.map((t) => <li key={t}>{TACTIC_TEXT[t] || t}</li>)}</ul>}
      {pending > 0 && <div className="checking"><span className="spinner" /> Checking the latest part of the call…</div>}

      {canVerify && (
        <button className={`big ${risk.level === 'green' ? 'secondary' : ''}`} onClick={verify}>
          🔐 {risk.level === 'green' ? 'Verify with my family anyway' : 'VERIFY THIS CALL'}
        </button>
      )}
      {listeningNow
        ? <button className="big secondary" onClick={stop}>⏹ Stop</button>
        : <p className="small">Listening stopped.</p>}
      <button className="big ghost" onClick={exit}>Back to home</button>

      {risk.level === 'red' && !popupClosed && (
        <div className="popup" role="alertdialog" aria-label="This may be a scam">
          <div className="result-badge" style={{ borderColor: 'var(--red)', background: 'var(--red-soft)' }}>⚠️</div>
          <h1>This may be a scam</h1>
          <p className="popup-text">Do not send money.<br />Verify first.</p>
          {latest?.reason && <p className="reason">💬 {latest.reason}</p>}
          <button className="big" onClick={verify}>🔐 VERIFY THIS CALL</button>
          <button className="big ghost" onClick={() => setPopupClosed(true)}>Close</button>
        </div>
      )}
    </main>
  );
}
