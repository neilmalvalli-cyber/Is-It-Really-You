import { useState } from 'react';
import { cleanName } from '../lib/pairing.js';
import Icon, { Banner, Avatar } from '../components/Icon.jsx';

export default function ParentSetup({ onDone, onBack }) {
  const [name, setName] = useState('');
  const n = cleanName(name);
  return (
    <form className="screen" onSubmit={(e) => { e.preventDefault(); if (n) onDone(n); }}>
      <button type="button" className="back" onClick={onBack}><Icon name="arrowLeft" /> Back</button>
      <span className="eyebrow">Parent setup</span>
      <h1>Welcome</h1>
      <label>What does your family call you?
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Dad" />
      </label>
      <button className="big" disabled={!n || n.length > 40}>Continue</button>
    </form>
  );
}
