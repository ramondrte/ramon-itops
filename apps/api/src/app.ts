import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import {
  DemoService,
  DemoLimitError,
  DEMO_LIMITS,
  clientNetwork,
  type DemoSettings,
} from "./modules/demo/demo.service.js";
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
  protection: { demo?: DemoSettings; trustProxyHops?: number } = {},
) {
  const app = Fastify({
    logger: logger
      ? {
          base: null,
          serializers: {
            req: (req: { method: string }) => ({ method: req.method }),
          },
        }
      : false,
    bodyLimit: 128 * 1024,
    trustProxy: (_address: string, hop: number) =>
      hop < (protection.trustProxyHops ?? 0),
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false } },
  });
  app.register(helmet, {
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
  });
  const demo =
    protection.demo && "query" in database
      ? new DemoService(database, protection.demo, clock)
      : undefined;
  if (protection.demo && !demo)
    throw new Error("Demo exige persistência PostgreSQL");
  if (demo) {
    let readLimiter: ReturnType<typeof app.createRateLimit>;
    app.register(rateLimit, {
      global: false,
      max: DEMO_LIMITS.readsPerMinute,
      timeWindow: 60000,
      keyGenerator: (req) => clientNetwork(req.ip),
      allowList: (req) =>
        req.url.split("?")[0] === "/health" ||
        req.url.split("?")[0] === "/health/ready",
      errorResponseBuilder: () => ({
        error: "demo_rate_limit",
        message: "Muitas solicitações. Aguarde um minuto e tente novamente.",
      }),
    });
    app.addHook("onReady", async () => {
      readLimiter = app.createRateLimit();
      await demo.verifyBinding();
      await demo.cleanupIfDue();
    });
    app.addHook("onRequest", async (request, reply) => {
      const result = await readLimiter(request);
      if (!result.isAllowed && result.isExceeded)
        return reply
          .code(429)
          .header("Retry-After", result.ttlInSeconds)
          .send({
            error: "demo_rate_limit",
            message: "Muitas solicitações. Aguarde e tente novamente.",
          });
    });
    let nextCleanupCheck = 0;
    app.addHook("preParsing", async (request, reply) => {
      if (
        request.method === "OPTIONS" ||
        ["/health", "/health/ready"].includes(request.url.split("?")[0])
      )
        return;
      if (clock().getTime() >= nextCleanupCheck) {
        nextCleanupCheck = clock().getTime() + 900000;
        try {
          const result = await demo.cleanupIfDue();
          if (result.ran)
            request.log.info({ deleted: result.deleted }, "demo_cleanup");
        } catch {
          nextCleanupCheck = 0;
          throw new Error("demo_cleanup_failed");
        }
      }
      if (!["GET", "HEAD"].includes(request.method)) {
        if (
          request.headers.origin &&
          !corsOrigins.includes(request.headers.origin)
        )
          return reply
            .code(403)
            .send({
              error: "origin_not_allowed",
              message: "Origem não autorizada.",
            });
        await demo.consume(
          request.ip,
          request.method === "POST" && request.url.split("?")[0] === "/tickets",
        );
      }
    });
  }
  if (corsOrigins.length)
    app.register(cors, {
      origin: corsOrigins,
      methods: ["GET", "HEAD", "POST", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type"],
      exposedHeaders: ["Location", "Retry-After"],
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
    registerTickets(app, database, clock, demo);
    registerMetrics(app, database, clock);
  }
  app.addHook("onClose", async () => database.close());
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DemoLimitError)
      return reply
        .code(429)
        .header("Retry-After", error.retryAfter)
        .send({ error: error.code, message: error.message });
    const status =
      error && typeof error === "object" && "statusCode" in error
        ? Number(error.statusCode)
        : 0;
    if (status === 429)
      return reply
        .code(429)
        .send({
          error: "demo_rate_limit",
          message: "Muitas solicitações. Aguarde e tente novamente.",
        });
    if (status === 413)
      return reply
        .code(413)
        .send({
          error: "payload_too_large",
          message: "Conteúdo enviado excede o limite permitido.",
        });
    if (status === 415)
      return reply
        .code(415)
        .send({
          error: "unsupported_media_type",
          message: "Envie conteúdo JSON.",
        });
    if (
      status === 400 &&
      !(error && typeof error === "object" && "validation" in error)
    )
      return reply
        .code(400)
        .send({
          error: "invalid_input",
          message: "Confira o conteúdo enviado.",
        });
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
