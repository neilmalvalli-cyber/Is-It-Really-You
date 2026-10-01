import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { encodePairing } from '../lib/pairing.js';

// Shows the PUBLIC pairing code (deviceId, name, relation, X). Back never touches the key;
// Reset is a separate, clearly destructive action at the bottom.
export default function FamilyPair({ profile, deviceId, onBack, onReset }) {
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const code = encodePairing({ deviceId, name: profile.name, relation: profile.relation, X: profile.X });

  useEffect(() => {
    QRCode.toDataURL(code, { errorCorrectionLevel: 'M', margin: 2, width: 360 }).then(setQr);
  }, [code]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="screen wide">
      <button type="button" className="back" onClick={onBack}>← Back</button>
      <span className="eyebrow">Really You</span>
      <h1>Pair this device</h1>
      <div className="card pair-grid">
        {qr && <div className="qr-wrap"><img className="qr" src={qr} alt="Pairing QR code" /></div>}
        <div className="steps-text">
          <ol className="lead">
            <li>On the parent's phone, open <strong>Add family member</strong>.</li>
            <li>Point the camera at this QR code.</li>
            <li>The phone will show <strong>{profile.name}</strong> under "My family".</li>
          </ol>
          <details>
            <summary>Can't scan? Use the pairing code</summary>
            <textarea className="code" readOnly value={code} rows={4} onFocus={(e) => e.target.select()} />
            <button type="button" className="big secondary" onClick={copy}>{copied ? '✅ Copied' : 'Copy code'}</button>
          </details>
        </div>
      </div>
      <button type="button" className="big secondary" onClick={onBack}>Done</button>

      <section className="danger-zone" aria-label="Advanced">
        <p>Advanced: deletes this device's secret key. Your parent will have to pair again.</p>
        <button type="button" className="danger-link" onClick={onReset}>Reset device…</button>
      </section>
    </main>
  );
}
