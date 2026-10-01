// "Really You" brand mark: a shield with a check (inline SVG, no image dependency).
export function ShieldMark({ size = 28 }) {
  return (
    <svg className="shield-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="ry-shield" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5aa9ff" />
          <stop offset="1" stopColor="#8b6cff" />
        </linearGradient>
      </defs>
      <path d="M16 2.5 4.5 7v8.2c0 7.1 4.8 12.6 11.5 14.3 6.7-1.7 11.5-7.2 11.5-14.3V7L16 2.5Z"
        fill="rgba(90,169,255,0.14)" stroke="url(#ry-shield)" strokeWidth="2" strokeLinejoin="round" />
      <path d="m10.5 16.2 3.8 3.8 7.4-7.6" fill="none" stroke="#e8f1ff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const STATUS = {
  connecting: { cls: 'wait', text: 'Connecting…' },
  connected: { cls: 'ok', text: 'Connected' },
  reconnecting: { cls: 'wait', text: 'Reconnecting…' },
  offline: { cls: 'bad', text: 'Connection lost' },
  rejected: { cls: 'bad', text: 'Connection refused' },
};

// Compact app header with brand + connection pill. Never shows socket or device ids.
export function Header({ status, role }) {
  const s = STATUS[status] || STATUS.connecting;
  return (
    <header className={`app-header ${role === 'family' ? 'wide' : ''}`}>
      <div className="brand"><ShieldMark /> <span>Really You</span></div>
      {role && (
        <span className={`conn ${s.cls}`} role="status">
          <span className="dot" aria-hidden="true" />{s.text}
        </span>
      )}
    </header>
  );
}

// Simple step list used for waiting / progress screens.
export function Steps({ steps }) {
  return (
    <ol className="steps">
      {steps.map(([state, label]) => (
        <li key={label} className={`step ${state}`}>
          <span className="step-mark" aria-hidden="true">{state === 'done' ? '✓' : state === 'active' ? '' : '○'}</span>
          <span>{label}</span>
          <span className="sr-only">{state === 'done' ? ' (done)' : state === 'active' ? ' (in progress)' : ' (waiting)'}</span>
        </li>
      ))}
    </ol>
  );
}
