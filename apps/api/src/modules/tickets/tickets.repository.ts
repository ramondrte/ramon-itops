import type { Database, PoolClient } from "@ramon-itops/database";
import type { Filters, Ticket, TicketInput } from "./tickets.types.js";
const projection = `SELECT t.*, (CASE t.type WHEN 'incident' THEN 'INC-' ELSE 'REQ-' END) ||
  lpad(t.sequence_number::text, greatest(6, length(t.sequence_number::text)), '0') AS number,
  c.name AS category_name, tech.name AS technician_name
  FROM tickets t JOIN categories c ON c.id=t.category_id LEFT JOIN technicians tech ON tech.id=t.technician_id`;
export class TicketsRepository {
  constructor(public db: Database) {}
  async get(id: string, client?: PoolClient) {
    const sql = `${projection} WHERE t.id=$1`;
    return (
      client
        ? await client.query<Ticket>(sql, [id])
        : await this.db.query<Ticket>(sql, [id])
    ).rows[0];
  }
  async history(id: string, client: PoolClient) {
    return (
      await client.query(
        "SELECT id, action, actor, changes, note, created_at FROM ticket_history WHERE ticket_id=$1 ORDER BY created_at, id",
        [id],
      )
    ).rows;
  }
  async list(filters: Filters) {
    const values: unknown[] = [];
    const conditions: string[] = [];
    for (const key of ["status", "priority", "category_id"] as const) {
      if (filters[key]) {
        values.push(filters[key]);
        conditions.push(`t.${key}=$${values.length}`);
      }
    }
    const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
    const page = filters.page ?? 1,
      pageSize = filters.page_size ?? 20;
    return this.db.transaction(async (client) => {
      await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      const total = Number(
        (await client.query(`SELECT count(*) FROM tickets t${where}`, values))
          .rows[0].count,
      );
      const items = (
        await client.query<Ticket>(
          `${projection}${where} ORDER BY t.created_at DESC, t.id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
          [...values, pageSize, (page - 1) * pageSize],
        )
      ).rows;
      return { items, total, page, page_size: pageSize };
    });
  }
  async insert(input: TicketInput, client: PoolClient) {
    const result = await client.query(
      `INSERT INTO tickets(title, description, type, category_id, priority, requester, technician_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        input.title,
        input.description,
        input.type,
        input.category_id,
        input.priority,
        input.requester,
        input.technician_id ?? null,
      ],
    );
    return (await this.get(result.rows[0].id, client))!;
  }
  async save(ticket: Ticket, client: PoolClient) {
    await client.query(
      `UPDATE tickets SET title=$2, description=$3, category_id=$4, priority=$5,
      status=$6, technician_id=$7, pending_reason=$8, resolution_summary=$9, resolved_at=$10,
      updated_at=clock_timestamp(), version=version+1 WHERE id=$1`,
      [
        ticket.id,
        ticket.title,
        ticket.description,
        ticket.category_id,
        ticket.priority,
        ticket.status,
        ticket.technician_id,
        ticket.pending_reason,
        ticket.resolution_summary,
        ticket.resolved_at,
      ],
    );
    return (await this.get(ticket.id, client))!;
  }
  async record(
    id: string,
    action: string,
    changes: object,
    note: string | null,
    client: PoolClient,
  ) {
    await client.query(
      "INSERT INTO ticket_history(ticket_id, action, changes, note) VALUES ($1,$2,$3,$4)",
      [id, action, JSON.stringify(changes), note],
    );
  }
}
