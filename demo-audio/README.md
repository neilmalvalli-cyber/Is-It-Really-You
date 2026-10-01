# Demo clips (not committed — put your recordings here)

Use exactly these names (any of .mp3 / .m4a / .wav / .ogg / .webm / .aac / .flac). They appear as Demo Mode buttons in
this order, and Demo Mode recognises them for its offline fallback:

| File | Button label | If Gemini is unavailable (429/503/timeout) |
|---|---|---|
| `1-fake-son-asks-for-money.mp3` | 1 fake son asks for money | HIGH (bundled demo fixture) |
| `2-fake-police-digital-arrest.mp3` | 2 fake police digital arrest | HIGH (bundled demo fixture) |
| `3-safe-call-from-family.mp3` | 3 safe call from family | LOW (bundled demo fixture) |

Gemini is always tried first; its answer is used whenever it gives one. The fallback is only used in Demo Mode, is
labelled on screen as "Demo recording: the AI check is unavailable…", and never applies to the live microphone.
