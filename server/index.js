import { fileURLToPath } from 'node:url';
import { createAppServer } from './app.js';

try { process.loadEnvFile(fileURLToPath(new URL('.env', import.meta.url))); } catch { /* no .env yet */ }

const PORT = Number(process.env.PORT) || 3000;
const { httpServer } = createAppServer();
httpServer.listen(PORT, () => console.log(`server on http://localhost:${PORT}`));
