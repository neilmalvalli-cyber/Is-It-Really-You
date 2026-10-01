import { useState } from 'react';
import { cleanName } from '../lib/pairing.js';

export default function ParentSetup({ onDone }) {
  const [name, setName] = useState('');
  const n = cleanName(name);
  return (
    <form className="screen" onSubmit={(e) => { e.preventDefault(); if (n) onDone(n); }}>
      <h1>👴 Welcome</h1>
      <label>What does your family call you?
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Dad" />
      </label>
      <button className="big" disabled={!n || n.length > 40}>Continue</button>
    </form>
  );
}
