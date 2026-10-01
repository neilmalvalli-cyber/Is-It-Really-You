# Is It Really You?

Hackathon app: Gemini warns about scam tactics on a call; an interactive Schnorr zero-knowledge proof decides whether the
caller's family device is genuine. See `CLAUDE.md` for the brief. Needs Node 22.12+ (or 20.19+), required by Vite 8.

## Run (on Neil's laptop)

```bash
cd Is-It-Really-You
npm run setup                        # first time only
cp server/.env.example server/.env   # add GEMINI_API_KEY (never commit .env)
npm run dev                          # server :3000 + Vite :5173 (proxies /api and /socket.io)
cloudflared tunnel --url http://localhost:5173   # or: ngrok http 5173
```

Open the printed `https://…` URL on the parent phone and the family laptop.

Demo-day mode (faster, one process): `npm run build && npm start`, then tunnel port **3000** instead.

Tests: `npm test` (zk proof, session state machine, relay integration, PIN encryption, pairing code).

## Demo clips (Gemini scam check, demo mode)

Put pre-recorded clips in `demo-audio/` (`.mp3`, `.m4a`, `.wav`, `.ogg`, `.webm`, `.aac` or `.flac`, ideally 20–40 s). Parent: **CHECK THIS CALL → 🎬 Demo Mode** lists them as
buttons, sorted by file name (tap 🔄 Refresh list after adding files), e.g.
`1-fake-son.mp3`, `2-digital-arrest.mp3`, `3-normal-call.mp3`. The clip plays out loud and the same audio is sent to
Gemini in 15-second chunks. Needs `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) in `server/.env`; without a key every
chunk returns `{"risk":"unknown"}` → yellow "Be careful".
