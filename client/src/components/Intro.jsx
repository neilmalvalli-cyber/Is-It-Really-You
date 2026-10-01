import { useEffect, useRef, useState } from 'react';
import './intro.css';

// Logo intro ported from Provenrely (components/landing/intro.tsx): same scenes, timeline and artwork.
// The artwork's baked-in old wordmark sits in its bottom quarter, which the CSS clips off; the wordmark here is live
// text. Plays once per browser session (set in index.html before first paint); ?intro=1 forces a replay.
export const INTRO_SEEN_KEY = 'really-you:intro-seen';
const T_HANDOFF = 3600;
const FADE_MS = 650;
const EXIT_MS = 320;

const NODES = [
  [110, 190], [250, 330], [150, 520], [300, 690], [90, 800], [470, 150], [560, 800],
  [900, 810], [1120, 720], [1330, 800], [1260, 540], [1170, 330], [1330, 170], [980, 140],
];
const PARTICLES = [
  ['v2', -160, 150], ['v3', -90, 640], ['v1', 180, 120], ['v2', 380, 250], ['v3', 640, 90], ['v1', 820, 180],
  ['v2', 1250, 110], ['v3', 1390, 420], ['v1', 1040, 480], ['v2', 1210, 860], ['v3', 760, 860], ['v1', 420, 560],
  ['v2', 60, 420], ['v3', 960, 610], ['v1', 1560, 230], ['v2', 1600, 700],
];
const ATTRACT = [
  [520, 300, 0.4, 170, 82], [900, 280, 0.44, -153, 99], [560, 520, 0.47, 136, -105], [880, 530, 0.42, -136, -113],
  [440, 410, 0.5, 238, -11], [1000, 400, 0.46, -238, -3], [700, 220, 0.52, 17, 150], [740, 600, 0.49, -17, -173],
];
const FLASHES = [
  [150, 520, 0.46], [250, 330, 0.6], [1330, 170, 0.54], [1170, 330, 0.66], [560, 800, 0.52], [980, 140, 0.56], [1260, 540, 0.62], [110, 190, 0.5],
];
const FLOWS = ['M560 800L720 397', 'M980 140L720 397', 'M1260 540L720 397', 'M110 190L720 397'];
const FACETS = ['cUL', 'cUR', 'cML', 'cMR', 'cLL', 'cLR'];
const EDGES = [
  ['M405 302L625 168L625 432L405 548Z', 1.1],
  ['M625 168L857 300L625 432Z', 1.19],
  ['M405 548L577 458L577 655Z', 1.28],
  ['M680 425L852 530L680 626Z', 1.36],
  ['M400 785L625 657L625 912Z', 1.44],
  ['M625 657L852 529L852 785L625 912Z', 1.5],
];
const LETTERS = [...'REALLY YOU'].map((c) => (c === ' ' ? ' ' : c));

export default function Intro() {
  const [mounted, setMounted] = useState(() => document.documentElement.getAttribute('data-intro') === 'playing');
  const overlay = useRef(null);

  useEffect(() => {
    if (!mounted) return undefined;
    const html = document.documentElement;
    const timers = [];
    const fit = () => html.style.setProperty('--ix-s', String(Math.min(window.innerHeight / 900, window.innerWidth / 760, 1.2)));
    fit();
    window.addEventListener('resize', fit);

    let ended = false;
    const finish = (ms) => {
      if (ended) return;
      ended = true;
      timers.forEach(clearTimeout);
      try { sessionStorage.setItem(INTRO_SEEN_KEY, '1'); } catch { /* ignore */ }
      overlay.current?.classList.add('ix-handoff');
      overlay.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, fill: 'forwards', easing: 'ease-out' });
      timers.push(window.setTimeout(() => { html.setAttribute('data-intro', 'done'); setMounted(false); }, ms + 20));
    };

    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      overlay.current?.classList.add('ix-run');
      timers.push(window.setTimeout(() => finish(FADE_MS), T_HANDOFF));
    };
    const art = new Image();
    art.src = '/brand/intro-logo.webp';
    Promise.race([art.decode().catch(() => undefined), new Promise((r) => setTimeout(r, 800))])
      .then(() => { requestAnimationFrame(() => requestAnimationFrame(start)); window.setTimeout(start, 150); });

    const onSkip = () => finish(EXIT_MS);
    const ov = overlay.current;
    ov?.addEventListener('ix-skip', onSkip);
    return () => {
      window.removeEventListener('resize', fit);
      ov?.removeEventListener('ix-skip', onSkip);
      timers.forEach(clearTimeout);
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div ref={overlay} className="ix-overlay">
      <div className="ix-bg ix-solid" aria-hidden="true" />
      <div className="ix-bg ix-bgRad" aria-hidden="true" />
      <div className="ix-bg ix-amb" aria-hidden="true" />

      <div className="ix-box" aria-hidden="true">
        <svg className="ix-net" viewBox="0 0 1440 900">
          <g className="ix-nodes">
            {NODES.map(([x, y]) => (
              <g key={`${x}-${y}`}>
                <circle className="ix-nh" cx={x} cy={y} r="7" />
                <circle className="ix-nd" cx={x} cy={y} r="2" />
              </g>
            ))}
          </g>
        </svg>

        <div className="ix-full ix-ptw">
          {PARTICLES.map(([v, x, y], i) => <div key={i} className={`ix-pt ix-${v}`} style={{ left: x, top: y }} />)}
        </div>

        <svg className="ix-energy" viewBox="0 0 1440 900">
          <path className="ix-eb" pathLength={100} style={{ animationDelay: '.35s' }} d="M-30 520L150 520L250 330L720 397" />
          <path className="ix-ec" pathLength={100} style={{ animationDelay: '.35s' }} d="M-30 520L150 520L250 330L720 397" />
          <path className="ix-eb" pathLength={100} style={{ animationDelay: '.44s' }} d="M1470 170L1330 170L1170 330L720 397" />
          <path className="ix-ec ix-ec2" pathLength={100} style={{ animationDelay: '.44s' }} d="M1470 170L1330 170L1170 330L720 397" />
          <g className="ix-efg">
            {FLOWS.map((d) => (
              <g key={d}>
                <path className="ix-ef" d={d} />
                <path className="ix-ed" pathLength={100} d={d} />
              </g>
            ))}
          </g>
          {FLASHES.map(([x, y, delay]) => (
            <circle key={`${x}-${y}`} className="ix-nf" style={{ animationDelay: `${delay}s` }} cx={x} cy={y} r="3" />
          ))}
        </svg>

        {ATTRACT.map(([x, y, delay, tx, ty], i) => (
          <div key={i} className="ix-at" style={{ left: x, top: y, animationDelay: `${delay}s`, '--tx': `${tx}px`, '--ty': `${ty}px` }} />
        ))}

        <div className="ix-cring ix-cr1" />
        <div className="ix-cring ix-cr2" />
        <div className="ix-core" />
        <div className="ix-lglow" />
        <div className="ix-bloom" />
        <div className="ix-pring" />

        <div className="ix-stage">
          <div className="ix-fhaze" />
          <div className="ix-fline" />
          <div className="ix-fspark" />

          <div className="ix-symw">
            <div className="ix-floaty">
              <div className="ix-lg ix-halo" />
              {FACETS.map((f) => <div key={f} className={`ix-lg ix-pc ix-${f}`} />)}
              <div className="ix-sweep"><div className="ix-band" /></div>
              <svg className="ix-edges" viewBox="0 0 1254 1254">
                <defs>
                  <linearGradient id="ix-egr" gradientUnits="userSpaceOnUse" x1="400" y1="168" x2="860" y2="912">
                    <stop offset="0" stopColor="#4f8dff" />
                    <stop offset="0.5" stopColor="#8466ff" />
                    <stop offset="1" stopColor="#d85cff" />
                  </linearGradient>
                </defs>
                {EDGES.map(([d, delay]) => (
                  <path key={d} className="ix-ee" pathLength={100} style={{ animationDelay: `${delay}s` }} d={d} />
                ))}
              </svg>
            </div>
          </div>

          <div className="ix-wmw">
            <div className="ix-word">
              {LETTERS.map((l, i) => (
                <span key={i} className="ix-lt" style={{ '--dx': `${(i - (LETTERS.length - 1) / 2) * 34}px` }}>{l}</span>
              ))}
            </div>
          </div>

          <div className="ix-st">
            <svg className="ix-ic" width="12" height="12" viewBox="0 0 12 12">
              <path d="M6 1l4.3 2.5v5L6 11 1.7 8.5v-5z" />
              <path d="M4 6.1l1.4 1.4L8.2 4.7" />
            </svg>
            <span>IDENTITY PROTECTED</span>
          </div>
        </div>
      </div>

      <div className="ix-bg ix-vig" aria-hidden="true" />

      <button type="button" className="ix-skip" onClick={() => overlay.current?.dispatchEvent(new Event('ix-skip'))}>
        SKIP INTRO
      </button>
    </div>
  );
}
