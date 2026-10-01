// Records audio in standalone 15 s chunks (each chunk is a complete webm/ogg file) and sends them to the
// server for the Gemini scam check. Audio is only held in memory and dropped after upload.
export const CHUNK_MS = 15_000;
// ngrok's free tier can answer API calls with its HTML warning page; this header skips it.
const NGROK_HEADERS = { 'ngrok-skip-browser-warning': '1' };
const MIN_CHUNK_BYTES = 2_000;

function pickMime() {
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg']) {
    if (window.MediaRecorder?.isTypeSupported(m)) return m;
  }
  return '';
}

// Restart the recorder every chunkMs so each blob is independently decodable.
export function recordChunks(stream, onChunk, chunkMs = CHUNK_MS) {
  const mimeType = pickMime();
  let rec = null;
  let timer = null;
  let stopped = false;

  function startOne() {
    const parts = [];
    rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(parts, { type: (rec.mimeType || mimeType || 'audio/webm').split(';')[0] });
      if (blob.size >= MIN_CHUNK_BYTES) onChunk(blob);
      if (!stopped) startOne();
    };
    rec.start();
    timer = setTimeout(() => rec.state !== 'inactive' && rec.stop(), chunkMs);
  }

  startOne();
  return function stop() {
    stopped = true;
    clearTimeout(timer);
    if (rec && rec.state !== 'inactive') rec.stop(); // flushes the last partial chunk
  };
}

export async function sendChunk(blob) {
  try {
    const form = new FormData();
    form.append('audio', blob, blob.type.includes('ogg') ? 'chunk.ogg' : 'chunk.webm');
    const res = await fetch('/api/scam-check', { method: 'POST', body: form, headers: NGROK_HEADERS });
    return await res.json();
  } catch {
    return { risk: 'unknown' };
  }
}

// Live mode: microphone listening to the call on speaker.
export async function startMic(onChunk) {
  if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  let stopRec;
  try {
    stopRec = recordChunks(stream, onChunk);
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop()); // release the mic if the recorder cannot start
    throw err;
  }
  return () => { stopRec(); stream.getTracks().forEach((t) => t.stop()); };
}

// Demo mode: play a pre-recorded clip out loud AND record that same audio (no mic noise from the hall).
export async function startDemoClip(url, onChunk, onEnded) {
  if (!window.MediaRecorder) throw new Error('this browser cannot record audio');
  const audio = new Audio(url);
  audio.crossOrigin = 'anonymous';
  const ctx = new AudioContext();
  const src = ctx.createMediaElementSource(audio);
  const dest = ctx.createMediaStreamDestination();
  src.connect(dest);
  src.connect(ctx.destination); // still audible in the room
  const stopRec = recordChunks(dest.stream, onChunk);
  let done = false;
  const stop = () => {
    if (done) return;
    done = true;
    stopRec();
    audio.pause();
    setTimeout(() => ctx.close(), 200);
  };
  audio.addEventListener('ended', () => { stop(); onEnded?.(); });
  try {
    await ctx.resume();
    await audio.play();
  } catch (err) {
    stop(); // do not leave a recorder or audio context running
    throw err;
  }
  return stop;
}

export async function listDemoClips() {
  try {
    const res = await fetch('/api/demo-clips', { headers: NGROK_HEADERS });
    const list = await res.json();
    return Array.isArray(list) ? list : false;
  } catch {
    return false; // could not load (shown to the user, not hidden)
  }
}
