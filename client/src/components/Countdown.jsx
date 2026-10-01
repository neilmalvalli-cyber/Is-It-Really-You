import { useEffect, useState } from 'react';

export default function Countdown({ until }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  return <p className="small">⏱️ {Math.max(0, Math.ceil((until - now) / 1000))} seconds left</p>;
}
