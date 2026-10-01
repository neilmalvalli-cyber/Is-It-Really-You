import Icon from './Icon.jsx';
// Brand mark ported from Provenrely (public/brand/mark-160-solid.webp, 113x160 artwork, no text inside it).
// The wordmark is plain text, as in Provenrely's Logo.tsx, so it reads "REALLY YOU" here.
export function LogoMark({ size = 32 }) {
  return (
    <img className="logo-mark" src="/brand/mark-160-solid.webp" width={Math.round(size * 113 / 160)} height={size}
      alt="" aria-hidden="true" draggable={false} decoding="async" />
  );
}
export const ShieldMark = LogoMark; // older name used by the pages

export function Wordmark() {
  return <span className="wordmark">Really You</span>;
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
      <div className="brand" aria-label="Really You"><LogoMark size={30} /><Wordmark /></div>
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
          <span className="step-mark" aria-hidden="true">{state === 'done' ? <Icon name="check" /> : null}</span>
          <span>{label}</span>
          <span className="sr-only">{state === 'done' ? ' (done)' : state === 'active' ? ' (in progress)' : ' (waiting)'}</span>
        </li>
      ))}
    </ol>
  );
}
