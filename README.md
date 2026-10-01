# Really You

**AI warns. A zero-knowledge proof decides.**
Protection for elderly people against scam calls where someone pretends to be a family member, often with an
AI-cloned voice.

> Hackathon project "Is It Really You?" (Hackdays MLH × ACM, track: *Trust in a Synthetic World*).

## The problem

Scammers clone a family member's voice from a few seconds of audio and call an elderly parent: *"Dad, I'm in trouble,
send ₹50,000 right now, don't tell anyone."* Caller ID can be spoofed and, after a SIM swap, even calling back reaches
the scammer. Under panic, older people cannot verify fast enough.

## How it works

1. **Parent's phone** — the call goes on speaker and the parent taps **Check this call**.
2. **Gemini listens for scam tactics** (urgency, secrecy, money requests, fake police / "digital arrest", OTP requests…)
   in 15-second chunks. If the call looks like a scam, a full-screen warning appears and is spoken aloud.
3. The parent taps **Verify this call** and picks who the caller claims to be (e.g. *Ravi, son*).
4. **Family member's device** gets the request and they enter their PIN — or tap **That's not me**.
5. A **zero-knowledge proof** runs between the two devices. Only if it is valid do **both screens show the same two
   words** (e.g. *MANGO · RIVER*). The real family member reads them out on the call; the parent taps **Match** or
   **Doesn't match**. A scammer does not have the family device, so they cannot know the words.

We detect scam *tactics* in what is said — we do not claim to detect cloned voices. Gemini can only warn; it can never
mark a caller as verified.

## How it uses Gemini

- `POST /api/scam-check` (`server/gemini.js`) sends each audio chunk to Gemini with a system prompt and a strict JSON
  schema: `risk`, `claimsToBeFamily`, `claimedRelation`, `tactics`, `reason`, `evidenceQuote`, `language`.
- The audio is treated as **untrusted data** (spoken "ignore your rules" is itself a scam signal); output is validated
  field by field and anything malformed becomes `unknown` (yellow "be careful").
- The risk level only ever goes up during a call: any `high` or two `medium` → red warning.
- Resilience: retries with backoff on 429/503/timeouts and an optional fallback model (`GEMINI_FALLBACK_MODEL`).

## How it uses zero-knowledge proofs

Interactive **Schnorr identification** on secp256k1 (`client/src/lib/zk.js`, `@noble/curves`):

| Step | Who | |
|---|---|---|
| Commit | Family device | fresh random `r`, sends `R = r·G` |
| Challenge | Parent phone | fresh random `c` |
| Response | Family device | `s = r + c·x mod n` (secret `x` never leaves the device) |
| Verify | Parent phone | accepts only if `s·G = R + c·X` |

`X` (the public key) reaches the parent only through an **in-person QR scan** when pairing. The two words are
`SHA-256(sessionId ‖ R ‖ c ‖ s)` mapped onto a list of 256 simple words (`client/src/lib/words.js`), shown only after
a valid proof. Sessions are single-use, expire after 60 s and must follow request → commit → challenge → response
(`client/src/lib/verifySession.js`).

## Security

- The family secret `x` is stored only encrypted (AES-GCM, key from PBKDF2 of a 6-digit PIN) in IndexedDB and is
  wiped from memory after each proof.
- The server is a **relay only**: it never sees `x`, `r` or the PIN and never decides "verified".
- Every received curve point is validated; malformed, replayed or out-of-order messages fail safe.
- The Gemini API key lives only in `server/.env` (never in the client, logs or git); audio is processed in memory
  and never stored.
- When anything is uncertain the app says **"Could not verify — do not send money yet"**.

## Run it

Requires **Node 22.12+** (or 20.19+) and a Gemini API key.

```bash
git clone https://github.com/neilmalvalli-cyber/Is-It-Really-You.git
cd Is-It-Really-You
npm run setup                          # installs root, server and client dependencies
cp server/.env.example server/.env     # then set GEMINI_API_KEY (and optionally GEMINI_MODEL)
npm run build && npm start             # one process on http://localhost:3000
```

Microphone, camera and Web Crypto need HTTPS, so for two devices expose it with a tunnel and open the same URL on both:
`ngrok http 3000` (or `cloudflared tunnel --url http://localhost:3000`). For a single machine, two browser windows on
`http://localhost:3000` also work.

- **Development:** `npm run dev` (server :3000 + Vite :5173 with proxy).
- **Tests:** `npm test` — 109 tests: ZK proof, verification session state machine, socket relay integration,
  PIN encryption, pairing codes, Gemini endpoint validation and retries, risk meter, demo fallback.
- **Available models for your key:** `npm --prefix server run models`.

### Try it

1. Open the app on two devices. Choose **I am a Family Member** on one: enter a name and a 6-digit PIN, then
   **Pair with a parent's phone** to show a QR code.
2. Choose **I am the Parent** on the other: **Add family member** → scan the QR (or paste the pairing code).
3. Parent: **Check this call** (live microphone) or **Demo Mode** (pre-recorded clips) → **Verify this call** →
   pick the family member → the family device enters the PIN → compare the two words.

## Demo Mode

Demo Mode plays pre-recorded clips from `demo-audio/` instead of the microphone, for a reliable demo in a noisy hall.
The audio goes through the same Gemini endpoint as a live call.

For the three bundled demo recordings only (named as in `demo-audio/README.md`), Demo Mode has a **presentation
fallback**: Gemini is always tried first, but if it is unavailable (e.g. 429 quota, 503) or has not answered within
22 seconds, the app shows that recording's known result (fake son → high, fake police → high, safe call → low) with a
fixed description of the recording. This is implemented in `client/src/lib/demoFallback.js` and never applies to the
live microphone, which always uses Gemini and shows "We couldn't fully check this call" if it is unavailable.

## Tech stack

React + Vite (mobile-first web app) · Node.js + Express + Socket.IO (relay) · Google Gemini (`@google/genai`) ·
`@noble/curves` + Web Crypto · IndexedDB (`idb-keyval`) · `qrcode` / `html5-qrcode` · Web Speech API.

```
client/       React app (pages/, lib/zk.js, lib/verifySession.js, lib/secretStore.js, lib/pairing.js, …)
server/       app.js (Express + Socket.IO relay), gemini.js (scam check), index.js
demo-audio/   pre-recorded demo clips
```

## Limitations / roadmap

No wrong-PIN lockout or rate limiting yet; one device per family member; the live microphone needs the call on
speaker (phones do not let apps read call audio); voice-clone detection is deliberately out of scope.
