import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { decodePairing } from '../lib/pairing.js';

// X is trusted only from this in-person scan / paste (security rule 4) — never from the server.
export default function ParentPair({ onPaired, onCancel }) {
  const [error, setError] = useState('');
  const [camError, setCamError] = useState('');
  const [paste, setPaste] = useState('');
  const doneRef = useRef(false);

  function accept(text) {
    if (doneRef.current) return;
    try {
      const member = decodePairing(text);
      doneRef.current = true;
      onPaired(member);
    } catch {
      setError('That is not a valid family code. Try again.');
    }
  }

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader', { verbose: false });
    let running = false;
    scanner
      .start({ facingMode: 'environment' }, { fps: 10, qrbox: 260 }, (text) => accept(text), () => {})
      .then(() => { running = true; })
      .catch(() => setCamError('Camera not available. Use the pairing code below.'));
    return () => {
      if (running) scanner.stop().then(() => scanner.clear()).catch(() => {});
    };
  }, []);

  return (
    <main className="screen">
      <button type="button" className="back" onClick={onCancel}>← Back</button>
      <h1>➕ Add family member</h1>
      <p>Point the camera at the QR code on your family member's screen.</p>
      <div id="qr-reader" className="reader" />
      {camError && <div className="banner yellow">⚠️ {camError}</div>}
      {error && <div className="banner red" role="alert">⛔ {error}</div>}
      <details open={!!camError}>
        <summary>Paste a pairing code instead</summary>
        <textarea className="code" value={paste} onChange={(e) => setPaste(e.target.value)} rows={4} placeholder="IIRY1.…" />
        <button type="button" className="big secondary" onClick={() => accept(paste)} disabled={!paste.trim()}>Pair</button>
      </details>
    </main>
  );
}
