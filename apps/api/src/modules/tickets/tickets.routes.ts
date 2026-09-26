import type { DemoService } from "../demo/demo.service.js";
import { systemClock, type Clock } from "../sla/sla.engine.js";
import type { FastifyInstance } from "fastify";
import type { Database } from "@ramon-itops/database";
import { TicketsRepository } from "./tickets.repository.js";
import { TicketsService } from "./tickets.service.js";
import {
  createSchema,
  patchSchema,
  idSchema,
  filterSchema,
} from "./tickets.schemas.js";
import type { TicketInput, TicketPatch, Filters } from "./tickets.types.js";
export function registerTickets(
  app: FastifyInstance,
  db: Database,
  clock: Clock = systemClock,
  demo?: DemoService,
) {
  const repository = new TicketsRepository(db, clock);
  const service = new TicketsService(repository, clock, demo);
  app.get(
    "/categories",
    async () =>
      (await db.query("SELECT id, name FROM categories ORDER BY name")).rows,
  );
  app.get(
    "/technicians",
    async () =>
      (
        await db.query(
          "SELECT id, name FROM technicians WHERE active=true ORDER BY name",
        )
      ).rows,
  );
  app.post<{ Body: TicketInput }>(
    "/tickets",
    { schema: { body: createSchema } },
    async (request, reply) => {
      const ticket = await service.create(request.body);
      request.log.info(
        { operation: "ticket_created", ticketId: ticket.id },
        "ticket_changed",
      );
      return reply
        .code(201)
        .header("Location", `/tickets/${ticket.id}`)
        .send(ticket);
    },
  );
  app.get<{ Querystring: Filters }>(
    "/tickets",
    {
      preValidation: async (request) => {
        for (const key of ["page", "page_size"] as const) {
          const value = request.query[key];
          if (value !== undefined && /^\d+$/.test(String(value)))
            request.query[key] = Number(value);
        }
      },
      schema: { querystring: filterSchema },
    },
    async (request) => repository.list(request.query),
  );
  app.get<{ Params: { id: string } }>(
    "/tickets/:id",
    { schema: { params: idSchema } },
    async (request) => service.detail(request.params.id),
  );
  app.patch<{ Params: { id: string }; Body: TicketPatch }>(
    "/tickets/:id",
    { schema: { params: idSchema, body: patchSchema } },
    async (request) => {
      const ticket = await service.update(request.params.id, request.body);
      request.log.info(
        {
          operation: "ticket_updated",
          ticketId: ticket.id,
          version: ticket.version,
        },
        "ticket_changed",
      );
      return ticket;
    },
  );
}
