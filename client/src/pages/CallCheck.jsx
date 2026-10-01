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
  const [mode, setMode] = useState(null); // null | 'pick' (demo clip list) | 'mic' | clip filename | 'ended'
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
        : `Could not play clip (${err.message}).`);
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
        <section className="demo">
          <button className="big secondary" onClick={() => { setError(''); setMode('pick'); }}>🎬 Demo Mode (play a recorded clip)</button>
        </section>
        <button className="big secondary" onClick={onExit}>Back</button>
      </main>
    );
  }

  if (mode === 'pick') {
    return (
      <main className="screen">
        <h1>🎬 Demo Mode</h1>
        <p>Pick a recorded call. It plays out loud and is checked by Gemini instead of the microphone.</p>
        {error && <div className="banner red" role="alert">⛔ {error}</div>}
        {clips === null && <p>⏳ Loading clips…</p>}
        {clips === false && <div className="banner yellow">⚠️ Could not load the clip list from the server.</div>}
        {Array.isArray(clips) && clips.length === 0 && (
          <div className="banner yellow">⚠️ No clips found. Put .mp3, .m4a, .wav, .ogg or .webm files in the <code>demo-audio/</code> folder next to the server, then tap Refresh.</div>
        )}
        {Array.isArray(clips) && clips.map((c) => (
          <button key={c} className="big" onClick={() => start(c)}>▶️ {c.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')}</button>
        ))}
        <button className="big secondary" onClick={loadClips}>🔄 Refresh list</button>
        <button className="big secondary" onClick={() => { setError(''); setMode(null); }}>Back</button>
      </main>
    );
  }

  const clipLabel = (c) => c.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');

  return (
    <main className="screen">
      <p className="small">{running === 'mic' ? '🎙️ Listening to the microphone' : `🎬 Demo clip: ${clipLabel(running)}`}</p>
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
      {risk.level !== 'idle' && risk.level !== 'green' && <button className="big" onClick={verify}>🔐 VERIFY the caller</button>}
      <button className="big secondary" onClick={() => { stop(); callIdRef.current += 1; onExit(); }}>Back</button>

      {risk.level === 'red' && !popupClosed && (
        <div className="popup" role="alertdialog" aria-label="Possible scam">
          <div className="result-icon">⛔</div>
          <h1>This may be a scam</h1>
          <p className="popup-text">Do not send money.<br />Verify first.</p>
          {latest?.reason && <p>{latest.reason}</p>}
          <button className="big" onClick={verify}>🔐 VERIFY</button>
          <button className="big secondary" onClick={() => setPopupClosed(true)}>Close</button>
        </div>
      )}
    </main>
  );
}
