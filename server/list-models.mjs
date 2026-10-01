// Lists the Gemini models THIS API key can call with generateContent, so GEMINI_MODEL /
// GEMINI_FALLBACK_MODEL are never guessed. Prints model names only (never the key).
// Usage: npm --prefix server run models
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

try { process.loadEnvFile(fileURLToPath(new URL('.env', import.meta.url))); } catch { /* no .env */ }
if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is not set in server/.env');
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const names = [];
try {
  const pager = await ai.models.list({ config: { pageSize: 100 } });
  for await (const m of pager) {
    if (m.supportedActions?.includes('generateContent')) names.push(m.name.replace(/^models\//, ''));
  }
} catch (err) {
  console.error('Could not list models:', String(err?.message || err).split(process.env.GEMINI_API_KEY).join('***').slice(0, 200));
  process.exit(1);
}
console.log('Models available to this key with generateContent:');
for (const n of names.sort()) console.log(`  ${n}`);
console.log(`\nCurrent GEMINI_MODEL=${process.env.GEMINI_MODEL || '(unset → gemini-2.5-flash)'}`
  + `  GEMINI_FALLBACK_MODEL=${process.env.GEMINI_FALLBACK_MODEL || '(unset)'}`);
console.log('Pick a "flash" model (they accept audio). Avoid -tts, -live, -image, embedding and -lite-preview models unless you have tested them with audio.');
