import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { encodePairing } from '../lib/pairing.js';

export default function FamilyHome({ profile, deviceId, onReset }) {
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
    <main className="screen">
      <h1>🧑 {profile.name}</h1>
      <p>Ready. Requests from your parent will appear here.</p>
      <h2>Pair with your parent's phone</h2>
      <p>Open "Add family member" on the parent phone and scan this code.</p>
      {qr && <img className="qr" src={qr} alt="Pairing QR code" />}
      <details>
        <summary>Can't scan? Use the pairing code</summary>
        <textarea className="code" readOnly value={code} rows={4} onFocus={(e) => e.target.select()} />
        <button type="button" className="big secondary" onClick={copy}>{copied ? '✅ Copied' : 'Copy code'}</button>
      </details>
      <button type="button" className="link" onClick={onReset}>Reset this device</button>
    </main>
  );
}
