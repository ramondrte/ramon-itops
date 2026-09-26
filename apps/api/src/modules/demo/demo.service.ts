import { createHmac } from "node:crypto";
import ipaddr from "ipaddr.js";
import type { Database, PoolClient } from "@ramon-itops/database";
import type { Clock } from "../sla/sla.engine.js";
export interface DemoSettings {
  databaseId: string;
  ipHashSecret: string;
  cleanupEnabled: boolean;
}
export const DEMO_LIMITS = {
  readsPerMinute: 120,
  writesPerMinute: 30,
  createsPerQuarterHour: 5,
  createsPerDay: 20,
  globalWritesPerDay: 600,
  tickets: 200,
};
export const RETENTION_MS = 48 * 60 * 60 * 1000;
export class DemoLimitError extends Error {
  constructor(
    public retryAfter: number,
    public code = "demo_rate_limit",
  ) {
    super(
      "Limite temporário da demonstração atingido. Aguarde e tente novamente.",
    );
  }
}
export function clientNetwork(ip: string) {
  const address = ipaddr.process(ip);
  if (address.kind() === "ipv4") return address.toString();
  // Agrupa IPv6 por /64 para não permitir troca livre do endereço de host.
  return (
    address
      .toByteArray()
      .slice(0, 8)
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("") + "/64"
  );
}
export class DemoService {
  constructor(
    private db: Database,
    readonly settings: DemoSettings,
    private clock: Clock,
  ) {}
  private async binding(client: PoolClient) {
    const row = (
      await client.query(
        "SELECT environment_id FROM demo_environment WHERE singleton=true AND purpose='public-demo' FOR UPDATE",
      )
    ).rows[0];
    if (row?.environment_id !== this.settings.databaseId)
      throw new Error("demo_database_not_bound");
  }
  async verifyBinding() {
    await this.db.transaction((client) => this.binding(client));
  }
  async consume(ip: string, create: boolean) {
    const now = this.clock(),
      ms = now.getTime();
    const hash = createHmac("sha256", this.settings.ipHashSecret)
      .update(clientNetwork(ip))
      .digest("hex");
    const rules: [string, number, number][] = [
      ["global-write", 86400000, DEMO_LIMITS.globalWritesPerDay],
      ["write:" + hash, 60000, DEMO_LIMITS.writesPerMinute],
    ];
    if (create)
      rules.push(
        ["create-quarter:" + hash, 900000, DEMO_LIMITS.createsPerQuarterHour],
        ["create-day:" + hash, 86400000, DEMO_LIMITS.createsPerDay],
      );
    // Uma transação compartilhada entre instâncias. Tentativas inválidas também contam.
    const retry = await this.db.transaction(async (client) => {
      await this.binding(client);
      let retryAfter = 0;
      for (const [key, window, limit] of rules) {
        const start = Math.floor(ms / window) * window,
          end = start + window;
        const row = (
          await client.query(
            `INSERT INTO demo_rate_windows(bucket_key,window_start,expires_at,attempts)
          VALUES ($1,$2,$3,1) ON CONFLICT(bucket_key,window_start) DO UPDATE
          SET attempts=LEAST(demo_rate_windows.attempts+1,$4+1) RETURNING attempts`,
            [key, new Date(start), new Date(end), limit],
          )
        ).rows[0];
        if (row.attempts > limit) {
          retryAfter = Math.max(retryAfter, Math.ceil((end - ms) / 1000));
          if (key === "global-write") break;
        }
      }
      return retryAfter;
    });
    if (retry) throw new DemoLimitError(retry);
  }
  async beforeCreate(client: PoolClient) {
    await this.binding(client);
    const count = Number(
      (await client.query("SELECT count(*) FROM tickets")).rows[0].count,
    );
    if (count >= DEMO_LIMITS.tickets)
      throw new DemoLimitError(900, "demo_capacity_reached");
  }
  async afterCreate(client: PoolClient, id: string) {
    await client.query(
      "INSERT INTO demo_tickets(ticket_id,environment_id) VALUES ($1,$2)",
      [id, this.settings.databaseId],
    );
  }
  async cleanupIfDue() {
    if (!this.settings.cleanupEnabled) return { deleted: 0, ran: false };
    const now = this.clock();
    return this.db.transaction(async (client) => {
      // try-lock evita deadlock com a criação, que serializa a capacidade pela mesma linha.
      const locked = (
        await client.query(
          "SELECT pg_try_advisory_xact_lock(78201903) AS locked",
        )
      ).rows[0].locked;
      if (!locked) return { deleted: 0, ran: false };
      await this.binding(client);
      const state = (
        await client.query(
          "SELECT last_cleanup_at FROM demo_environment WHERE singleton=true",
        )
      ).rows[0];
      if (
        state.last_cleanup_at &&
        now.getTime() - state.last_cleanup_at.getTime() < 900000
      )
        return { deleted: 0, ran: false };
      const ids = (
        await client.query(
          `SELECT t.id FROM tickets t JOIN demo_tickets d ON d.ticket_id=t.id
        WHERE d.environment_id=$1 AND t.created_at<$2 ORDER BY t.id FOR UPDATE OF t SKIP LOCKED`,
          [this.settings.databaseId, new Date(now.getTime() - RETENTION_MS)],
        )
      ).rows.map((row) => row.id);
      if (ids.length) {
        await client.query(
          "DELETE FROM ticket_sla_pauses WHERE cycle_id IN (SELECT id FROM ticket_sla_cycles WHERE ticket_id=ANY($1::uuid[]))",
          [ids],
        );
        await client.query(
          "DELETE FROM ticket_sla_cycles WHERE ticket_id=ANY($1::uuid[])",
          [ids],
        );
        await client.query(
          "DELETE FROM ticket_history WHERE ticket_id=ANY($1::uuid[])",
          [ids],
        );
        await client.query(
          "DELETE FROM demo_tickets WHERE ticket_id=ANY($1::uuid[])",
          [ids],
        );
        await client.query("DELETE FROM tickets WHERE id=ANY($1::uuid[])", [
          ids,
        ]);
      }
      await client.query("DELETE FROM demo_rate_windows WHERE expires_at<=$1", [
        now,
      ]);
      await client.query(
        "UPDATE demo_environment SET last_cleanup_at=$1 WHERE singleton=true",
        [now],
      );
      return { deleted: ids.length, ran: true };
    });
  }
}
