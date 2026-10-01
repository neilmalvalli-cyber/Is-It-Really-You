import { ShieldMark } from '../components/Brand.jsx';
import Icon, { Banner, Avatar } from '../components/Icon.jsx';

// Family dashboard. Pairing (QR) lives on its own screen with a normal Back button.
export default function FamilyHome({ profile, onPair, onChangeRole }) {
  return (
    <main className="screen wide">
      <button type="button" className="back" onClick={onChangeRole}><Icon name="arrowLeft" /> Change role</button>
      <div className="family-grid">
        <div className="hero">
          <span className="eyebrow">Family member · {profile.relation}</span>
          <h1>Really You</h1>
          <p className="tagline"><strong>Help your family stay safe from scam calls.</strong></p>
          <p className="lead">Hi {profile.name}. Keep this page open. When your parent asks to verify a call, it appears here
            and you confirm with your PIN.</p>
        </div>
        <div className="card">
          <span className="status-line ok"><span className="dot" />Ready for verification requests</span>
          <h2>Your device is protected</h2>
          <p className="lead">Your secret key stays on this device, locked with your PIN. It is never sent anywhere.</p>
          <button className="big" onClick={onPair}><Icon name="smartphone" /> Pair with a parent's phone</button>
        </div>
      </div>
    </main>
  );
}
