import Fastify from 'fastify';
export interface Database { check(): Promise<void>; close(): Promise<void> }
export function buildApp(database: Database, logger = true) {
  const app = Fastify({ logger });
  app.get('/health', async () => ({ service: 'ramon-itops-api', status: 'ok' }));
  app.get('/health/ready', async (_request, reply) => {
    try {
      await database.check();
      return { service: 'ramon-itops-api', status: 'ready', checks: { database: 'up' } };
    } catch {
      app.log.warn({ dependency: 'database' }, 'readiness_check_failed');
      return reply.code(503).send({ service: 'ramon-itops-api', status: 'not_ready', checks: { database: 'down' } });
    }
  });
  app.addHook('onClose', async () => database.close());
  app.setErrorHandler((error, request, reply) => {
    request.log.error({ code: error instanceof Error && 'code' in error ? String(error.code) : 'UNKNOWN' }, 'request_failed');
    return reply.code(500).send({ error: 'internal_error' });
  });
  return app;
}
