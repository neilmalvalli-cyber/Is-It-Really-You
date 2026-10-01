import { ShieldMark } from '../components/Brand.jsx';
import Icon, { Banner, Avatar } from '../components/Icon.jsx';

export default function RoleSelect({ onPick }) {
  return (
    <main className="screen">
      <div className="hero">
        <ShieldMark size={64} />
        <h1>Really You</h1>
        <p className="tagline"><strong>AI warns. Your family verifies.</strong><br />Protection from scam calls that pretend to be family.</p>
      </div>
      <p className="lead">Who uses this device?</p>
      <button className="big choice" onClick={() => onPick('parent')}>
        <span className="ico"><Icon name="phone" /></span><span>I am the Parent<small>This phone checks suspicious calls</small></span>
      </button>
      <button className="big secondary choice" onClick={() => onPick('family')}>
        <span className="ico"><Icon name="users" /></span><span>I am a Family Member<small>Prove it's really you when asked</small></span>
      </button>
    </main>
  );
}
