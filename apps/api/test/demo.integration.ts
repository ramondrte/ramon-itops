import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDatabase, type Database } from "@ramon-itops/database";
import { migrate } from "../../../packages/database/src/migrations.js";
import { buildApp } from "../src/app.js";
import {
  DemoService,
  DemoLimitError,
  RETENTION_MS,
  type DemoSettings,
} from "../src/modules/demo/demo.service.js";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Use banco _test");
async function isolated(
  run: (
    db: Database,
    settings: DemoSettings,
    connection: string,
  ) => Promise<void>,
) {
  const admin = createDatabase(url!);
  const schema = "demo_" + randomUUID().replaceAll("-", "");
  await admin.query(`CREATE SCHEMA ${schema}`);
  const target = new URL(url!);
  target.searchParams.set("options", `-csearch_path=${schema}`);
  const db = createDatabase(target.toString());
  const settings = {
    databaseId: randomUUID(),
    ipHashSecret: "segredo-ficticio-exclusivo-de-testes-123",
    cleanupEnabled: false,
  };
  try {
    await migrate(target.toString());
    await db.query(
      "INSERT INTO demo_environment(environment_id,purpose) VALUES ($1,'public-demo')",
      [settings.databaseId],
    );
    await run(db, settings, target.toString());
  } finally {
    await db.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.close();
  }
}
async function input(db: Database) {
  return {
    title: "Incidente fictício da demo",
    description: "Dados fictícios para teste isolado da demo.",
    requester: "Solicitante fictício",
    type: "incident",
    priority: "high",
    category_id: (await db.query("SELECT id FROM categories LIMIT 1")).rows[0]
      .id,
    technician_id: (
      await db.query(
        "INSERT INTO technicians(name) VALUES ('Técnico fictício') RETURNING id",
      )
    ).rows[0].id,
  };
}
test("quotas duráveis por IP: criação, escrita, janelas e limite compartilhado", async () =>
  isolated(async (db, settings, connection) => {
    let at = new Date("2026-09-01T00:00:00Z");
    let service = new DemoService(db, settings, () => at);
    for (let i = 0; i < 5; i++) await service.consume("192.0.2.1", true);
    await assert.rejects(
      service.consume("192.0.2.1", true),
      (e) => e instanceof DemoLimitError && e.retryAfter === 900,
    );
    await service.consume("192.0.2.2", true);
    const second = createDatabase(connection);
    service = new DemoService(second, settings, () => at);
    try {
      await assert.rejects(service.consume("192.0.2.1", true), DemoLimitError);
    } finally {
      await second.close();
    }
    service = new DemoService(db, settings, () => at);
    for (let quarter = 1; quarter <= 3; quarter++) {
      at = new Date(at.getTime() + 900000);
      for (let i = 0; i < 5; i++) {
        try {
          await service.consume("192.0.2.1", true);
        } catch (e) {
          assert.ok(e instanceof DemoLimitError);
        }
      }
    }
    at = new Date(at.getTime() + 900000);
    await assert.rejects(service.consume("192.0.2.1", true), DemoLimitError);
    for (let i = 0; i < 30; i++) await service.consume("192.0.2.3", false);
    await assert.rejects(service.consume("192.0.2.3", false), DemoLimitError);
    await db.query(
      "UPDATE demo_rate_windows SET attempts=600 WHERE bucket_key='global-write'",
    );
    await assert.rejects(service.consume("192.0.2.4", false), DemoLimitError);
    at = new Date("2026-09-02T00:00:00Z");
    await service.consume("192.0.2.1", true);
    const raw = (
      await db.query("SELECT bucket_key FROM demo_rate_windows")
    ).rows
      .map((row) => row.bucket_key)
      .join(" ");
    assert.ok(!raw.includes("192.0.2."));
  }));
test("HTTP demo: 429, Retry-After, spoofing de proxy, CORS, leitura e health", async () =>
  isolated(async (db, settings) => {
    const app = buildApp(
      { ...db, close: async () => {} },
      false,
      () => new Date("2026-09-03T00:00:00Z"),
      ["https://web.example"],
      { demo: settings },
    );
    const payload = await input(db);
    try {
      for (let i = 0; i < 5; i++)
        assert.equal(
          (
            await app.inject({
              method: "POST",
              url: "/tickets",
              payload,
              remoteAddress: "192.0.2.10",
              headers: { "x-forwarded-for": `198.51.100.${i}` },
            })
          ).statusCode,
          201,
        );
      const blocked = await app.inject({
        method: "POST",
        url: "/tickets",
        payload,
        remoteAddress: "192.0.2.10",
        headers: { "x-forwarded-for": "198.51.100.99" },
      });
      assert.equal(blocked.statusCode, 429);
      assert.equal(blocked.headers["retry-after"], "900");
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/tickets",
            payload,
            remoteAddress: "192.0.2.11",
          })
        ).statusCode,
        201,
      );
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/tickets",
            payload,
            headers: { origin: "https://evil.example" },
          })
        ).statusCode,
        403,
      );
      for (let i = 0; i < 120; i++)
        assert.equal(
          (
            await app.inject({
              url: "/categories",
              remoteAddress: "192.0.2.12",
            })
          ).statusCode,
          200,
        );
      const rate = await app.inject({
        url: "/categories",
        remoteAddress: "192.0.2.12",
      });
      assert.equal(rate.statusCode, 429);
      assert.ok(rate.headers["retry-after"]);
      assert.equal(
        (await app.inject({ url: "/health", remoteAddress: "192.0.2.12" }))
          .statusCode,
        200,
      );
      assert.equal((await app.inject("/health/ready")).statusCode, 200);
      assert.equal(
        (await db.query("SELECT count(*)::int AS count FROM demo_tickets"))
          .rows[0].count,
        6,
      );
    } finally {
      await app.close();
    }
  }));
test("confiança limitada ao último proxy não usa prefixo XFF arbitrário", async () =>
  isolated(async (db, settings) => {
    const app = buildApp(
      { ...db, close: async () => {} },
      false,
      () => new Date("2026-09-03T00:00:00Z"),
      [],
      { demo: settings, trustProxyHops: 1 },
    );
    const payload = await input(db);
    try {
      for (let i = 0; i < 6; i++) {
        const response = await app.inject({
          method: "POST",
          url: "/tickets",
          payload,
          remoteAddress: "127.0.0.1",
          headers: { "x-forwarded-for": `198.51.100.${i}, 192.0.2.30` },
        });
        assert.equal(response.statusCode, i < 5 ? 201 : 429);
      }
    } finally {
      await app.close();
    }
  }));
test("capacidade serializada: criações concorrentes não ultrapassam 200", async () =>
  isolated(async (db, settings) => {
    const app = buildApp(
      { ...db, close: async () => {} },
      false,
      () => new Date("2026-09-04T00:00:00Z"),
      [],
      { demo: settings },
    );
    const payload = await input(db);
    await db.query(
      `INSERT INTO tickets(title,description,type,category_id,priority,requester) SELECT $1,$2,$3,$4,$5,$6 FROM generate_series(1,199)`,
      [
        payload.title,
        payload.description,
        payload.type,
        payload.category_id,
        payload.priority,
        payload.requester,
      ],
    );
    try {
      const results = await Promise.all(
        [1, 2].map((n) =>
          app.inject({
            method: "POST",
            url: "/tickets",
            payload,
            remoteAddress: `192.0.2.${n}`,
          }),
        ),
      );
      assert.deepEqual(results.map((r) => r.statusCode).sort(), [201, 429]);
      assert.equal(
        (await db.query("SELECT count(*)::int AS count FROM tickets")).rows[0]
          .count,
        200,
      );
    } finally {
      await app.close();
    }
  }));
test("limpeza seletiva, limites temporais, rollback e ambiente incorreto", async () =>
  isolated(async (db, settings) => {
    let at = new Date("2026-09-05T00:00:00Z");
    const clock = () => at;
    const app = buildApp({ ...db, close: async () => {} }, false, clock, [], {
      demo: settings,
    });
    const payload = await input(db);
    try {
      const old = (
        await app.inject({ method: "POST", url: "/tickets", payload })
      ).json();
      await app.inject({
        method: "PATCH",
        url: `/tickets/${old.id}`,
        payload: {
          version: old.version,
          status: "pending",
          pending_reason: "Pausa fictícia para teste",
        },
      });
      at = new Date(at.getTime() + RETENTION_MS);
      const boundary = (
        await app.inject({ method: "POST", url: "/tickets", payload })
      ).json();
      const unmarked = (
        await db.query(
          `INSERT INTO tickets(title,description,type,category_id,priority,requester,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [
            payload.title,
            payload.description,
            payload.type,
            payload.category_id,
            payload.priority,
            payload.requester,
            new Date("2026-01-01"),
          ],
        )
      ).rows[0].id;
      assert.equal(
        (await new DemoService(db, settings, clock).cleanupIfDue()).ran,
        false,
      );
      const cleanup = new DemoService(
        db,
        { ...settings, cleanupEnabled: true },
        clock,
      );
      assert.equal((await cleanup.cleanupIfDue()).deleted, 0); // exatamente 48h ainda permanece
      at = new Date(at.getTime() + 900001);
      const broken: Database = {
        ...db,
        transaction: (fn) =>
          db.transaction(async (client) => {
            await fn(client);
            throw new Error("simulated_cleanup_failure");
          }),
      };
      await assert.rejects(
        new DemoService(
          broken,
          { ...settings, cleanupEnabled: true },
          clock,
        ).cleanupIfDue(),
        /simulated_cleanup_failure/,
      );
      assert.equal(
        (await db.query("SELECT count(*)::int AS count FROM ticket_sla_pauses"))
          .rows[0].count,
        1,
      );
      await assert.rejects(
        new DemoService(
          db,
          { ...settings, databaseId: randomUUID(), cleanupEnabled: true },
          clock,
        ).cleanupIfDue(),
        /demo_database_not_bound/,
      );
      assert.equal((await cleanup.cleanupIfDue()).deleted, 1);
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS count FROM tickets WHERE id=ANY($1::uuid[])",
            [[boundary.id, unmarked]],
          )
        ).rows[0].count,
        2,
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS count FROM ticket_history WHERE ticket_id=$1",
            [old.id],
          )
        ).rows[0].count,
        0,
      );
      assert.equal(
        (await db.query("SELECT count(*)::int AS count FROM categories"))
          .rows[0].count,
        7,
      );
      assert.equal(
        (await db.query("SELECT count(*)::int AS count FROM technicians"))
          .rows[0].count,
        1,
      );
      assert.equal((await cleanup.cleanupIfDue()).ran, false);
    } finally {
      await app.close();
    }
  }));
test("fluxo completo em demo preserva SLA, histórico, filtros e indicadores", async () =>
  isolated(async (db, settings) => {
    let at = new Date("2026-09-08T00:00:00Z");
    const app = buildApp(
      { ...db, close: async () => {} },
      false,
      () => at,
      [],
      { demo: settings },
    );
    const payload = await input(db);
    try {
      let ticket = (
        await app.inject({ method: "POST", url: "/tickets", payload })
      ).json();
      const update = async (fields: object) => {
        const response = await app.inject({
          method: "PATCH",
          url: `/tickets/${ticket.id}`,
          payload: { version: ticket.version, ...fields },
        });
        assert.equal(response.statusCode, 200, response.body);
        ticket = response.json();
      };
      await update({ status: "in_progress", priority: "critical" });
      at = new Date(at.getTime() + 10 * 60000);
      await update({
        status: "pending",
        pending_reason: "Aguardando retorno fictício",
      });
      const balance = ticket.sla.remaining_ms;
      at = new Date(at.getTime() + 60 * 60000);
      assert.equal(
        (await app.inject(`/tickets/${ticket.id}`)).json().sla.remaining_ms,
        balance,
      );
      await update({ status: "in_progress" });
      await update({
        status: "resolved",
        resolution_summary: "Resolvido para teste fictício",
      });
      assert.equal(ticket.sla.result, "met");
      await update({
        status: "in_progress",
        reopen_reason: "Reincidência fictícia",
      });
      assert.equal(ticket.sla_cycles.length, 2);
      await update({
        status: "resolved",
        resolution_summary: "Nova resolução fictícia",
      });
      assert.equal(ticket.sla.state, "met_after_reopen");
      assert.ok(ticket.history.length >= 7);
      assert.equal(
        (await app.inject("/tickets?status=resolved&priority=critical")).json()
          .total,
        1,
      );
      assert.equal(
        (await app.inject("/metrics/overview?period=all")).json().sla.met,
        1,
      );
    } finally {
      await app.close();
    }
  }));
