import { config } from 'dotenv';
import { createDatabase } from '@ramon-itops/database';
import { buildApp } from './app.js';
config({ path: new URL('../../../.env', import.meta.url), quiet: true });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL obrigatória. Copie .env.example para .env na raiz.');
const port = Number(process.env.API_PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('API_PORT inválida');
const app = buildApp(createDatabase(connectionString));
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void app.close().catch(() => { process.exitCode = 1; }); });
}
try { await app.listen({ port, host: process.env.API_HOST ?? '127.0.0.1' }); }
catch { app.log.error('api_start_failed'); await app.close(); process.exitCode = 1; }
