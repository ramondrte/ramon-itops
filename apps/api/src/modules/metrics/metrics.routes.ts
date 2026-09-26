import type { FastifyInstance } from "fastify";
import type { Database } from "@ramon-itops/database";
import type { Clock } from "../sla/sla.engine.js";
import { overviewMetrics } from "./metrics.repository.js";
export function registerMetrics(
  app: FastifyInstance,
  db: Database,
  clock: Clock,
) {
  app.get<{ Querystring: { period?: "7d" | "30d" | "all" } }>(
    "/metrics/overview",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            period: {
              type: "string",
              enum: ["7d", "30d", "all"],
              default: "30d",
            },
          },
        },
      },
    },
    async (request) =>
      overviewMetrics(db, request.query.period ?? "30d", clock()),
  );
}
