# Demo clips

Put the pre-recorded demo clips here (any of .mp3 / .m4a / .wav / .ogg / .webm / .aac / .flac, ideally 20–40 s).
They appear as **Demo Mode** buttons in file-name order. Use these names:

| File | Button label | Known result (used only if Gemini is unavailable or takes > 22 s) |
|---|---|---|
| `1-fake-son-asks-for-money.mp3` | 1 fake son asks for money | High |
| `2-fake-police-digital-arrest.mp3` | 2 fake police digital arrest | High |
| `3-safe-call-from-family.mp3` | 3 safe call from family | Low |

Gemini is always tried first and its answer is used whenever it arrives in time. The known result is a presentation
fallback for these bundled recordings only (`client/src/lib/demoFallback.js`); it never applies to the live microphone.
