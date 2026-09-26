import cors from "@fastify/cors";
import { systemClock, type Clock } from "./modules/sla/sla.engine.js";
import { registerMetrics } from "./modules/metrics/metrics.routes.js";
import type { Database as TicketDatabase } from "@ramon-itops/database";
import { registerTickets } from "./modules/tickets/tickets.routes.js";
import { TicketError } from "./modules/tickets/tickets.types.js";
import Fastify from "fastify";
export interface Database {
  check(): Promise<void>;
  close(): Promise<void>;
}
export function buildApp(
  database: Database | TicketDatabase,
  logger = true,
  clock: Clock = systemClock,
  corsOrigins: string[] = [],
) {
  const app = Fastify({
    logger,
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false } },
  });
  if (corsOrigins.length)
    app.register(cors, {
      origin: corsOrigins,
      methods: ["GET", "HEAD", "POST", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type"],
      exposedHeaders: ["Location"],
      credentials: false,
    });
  app.get("/health", async () => ({
    service: "ramon-itops-api",
    status: "ok",
  }));
  app.get("/health/ready", async (_request, reply) => {
    try {
      await database.check();
      return {
        service: "ramon-itops-api",
        status: "ready",
        checks: { database: "up" },
      };
    } catch {
      app.log.warn({ dependency: "database" }, "readiness_check_failed");
      return reply.code(503).send({
        service: "ramon-itops-api",
        status: "not_ready",
        checks: { database: "down" },
      });
    }
  });
  if ("query" in database) {
    registerTickets(app, database, clock);
    registerMetrics(app, database, clock);
  }
  app.addHook("onClose", async () => database.close());
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof TicketError)
      return reply
        .code(error.statusCode)
        .send({ error: error.code, message: error.message });
    if (error && typeof error === "object" && "validation" in error)
      return reply.code(400).send({
        error: "invalid_input",
        message: "Confira os campos enviados.",
        details: error.validation,
      });
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    if (["ECONNREFUSED", "57P01", "57P03", "08006"].includes(code))
      return reply.code(503).send({
        error: "database_unavailable",
        message: "Banco indisponível. Tente novamente.",
      });
    request.log.error(
      {
        code:
          error instanceof Error && "code" in error
            ? String(error.code)
            : "UNKNOWN",
      },
      "request_failed",
    );
    return reply.code(500).send({ error: "internal_error" });
  });
  return app;
}
