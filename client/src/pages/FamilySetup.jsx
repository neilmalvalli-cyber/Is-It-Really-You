import { useState } from 'react';
import { RELATIONS, cleanName } from '../lib/pairing.js';
import { createFamilySecret, isValidPin } from '../lib/secretStore.js';
import Icon, { Banner, Avatar } from '../components/Icon.jsx';

export default function FamilySetup({ onDone, onBack }) {
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('son');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const n = cleanName(name);
    if (!n || n.length > 40) return setError('Enter your name (max 40 letters).');
    if (!isValidPin(pin)) return setError('PIN must be exactly 6 digits.');
    if (pin !== pin2) return setError('The two PINs do not match.');
    setBusy(true);
    setError('');
    try {
      const X = await createFamilySecret(pin);
      setPin('');
      setPin2('');
      onDone({ name: n, relation, X });
    } catch (err) {
      setError(`Could not create the key: ${err.message}`);
      setBusy(false);
    }
  }

  const pinProps = { className: 'pin', type: 'password', inputMode: 'numeric', autoComplete: 'off', maxLength: 6, pattern: '\\d{6}' };

  return (
    <form className="screen" onSubmit={submit}>
      <button type="button" className="back" onClick={onBack}><Icon name="arrowLeft" /> Back</button>
      <span className="eyebrow">Family member setup</span>
      <h1>Create your secure key</h1>
      <label>Your name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Ravi" />
      </label>
      <label>You are their…
        <select value={relation} onChange={(e) => setRelation(e.target.value)}>
          {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <label>Choose a 6-digit PIN
        <input {...pinProps} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
      </label>
      <label>Type the PIN again
        <input {...pinProps} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} />
      </label>
      {error && <Banner tone="red" alert>{error}</Banner>}
      <button className="big" disabled={busy}>{busy ? 'Creating secure key…' : 'Create my key'}</button>
      <p className="small">Your secret key is created on this device, locked with your PIN, and never leaves it.</p>
    </form>
  );
}
