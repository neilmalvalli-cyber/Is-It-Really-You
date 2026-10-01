import { ShieldMark } from '../components/Brand.jsx';

// Family dashboard. Pairing (QR) lives on its own screen with a normal Back button.
export default function FamilyHome({ profile, onPair }) {
  return (
    <main className="screen wide">
      <div className="family-grid">
        <div className="hero">
          <span className="eyebrow">Family member · {profile.relation}</span>
          <h1><ShieldMark size={40} /> Really You</h1>
          <p className="tagline"><strong>Help your family stay safe from scam calls.</strong></p>
          <p className="lead">Hi {profile.name}. Keep this page open. When your parent asks to verify a call, it appears here
            and you confirm with your PIN.</p>
        </div>
        <div className="card">
          <h2>✅ Ready for verification requests</h2>
          <p className="lead">Your secret key stays on this device, locked with your PIN. It is never sent anywhere.</p>
          <button className="big" onClick={onPair}>📱 Pair with a parent's phone</button>
        </div>
      </div>
    </main>
  );
}
