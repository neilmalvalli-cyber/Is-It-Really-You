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

Tests: `npm test` (zk, PIN encryption, pairing code).
