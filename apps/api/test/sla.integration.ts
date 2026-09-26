import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createDatabase, type Database } from "@ramon-itops/database";
import { migrate } from "../../../packages/database/src/migrations.js";
import { buildApp } from "../src/app.js";
import { TicketsRepository } from "../src/modules/tickets/tickets.repository.js";
import { TicketsService } from "../src/modules/tickets/tickets.service.js";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("TEST_DATABASE_URL deve usar banco dedicado _test");
async function isolated(
  run: (db: Database, connection: string) => Promise<void>,
  initialize = true,
) {
  const admin = createDatabase(url!);
  const schema = `sla_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  const target = new URL(url!);
  target.searchParams.set("options", `-csearch_path=${schema}`);
  const db = createDatabase(target.toString());
  const close = db.close.bind(db);
  let closed = false;
  db.close = async () => {
    if (!closed) {
      closed = true;
      await close();
    }
  };
  try {
    if (initialize) await migrate(target.toString());
    await run(db, target.toString());
  } finally {
    await db.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.close();
  }
}
async function setup(db: Database) {
  const category = (await db.query("SELECT id FROM categories LIMIT 1")).rows[0]
    .id;
  const technician = (
    await db.query(
      "INSERT INTO technicians(name) VALUES ('Técnico fictício SLA') RETURNING id",
    )
  ).rows[0].id;
  return {
    title: "Chamado fictício de SLA",
    description: "Cenário controlado para teste de prazo.",
    type: "incident",
    priority: "high",
    requester: "Solicitante fictício",
    category_id: category,
    technician_id: technician,
  };
}
test("SLA integrado: pausa, retomada, resolução no limite, reabertura e nova conexão", async () =>
  isolated(async (db, connection) => {
    let at = new Date("2026-09-01T00:00:00Z");
    const clock = () => new Date(at);
    const app = buildApp(db, false, clock);
    const input = await setup(db);
    let current = (
      await app.inject({ method: "POST", url: "/tickets", payload: input })
    ).json();
    const id = current.id;
    const update = async (fields: object) => {
      const response = await app.inject({
        method: "PATCH",
        url: `/tickets/${id}`,
        payload: { version: current.version, ...fields },
      });
      assert.equal(response.statusCode, 200, response.body);
      current = response.json();
    };
    const advance = (minutes: number) => {
      at = new Date(at.getTime() + minutes * 60000);
    };
    try {
      assert.equal(current.sla.coverage, "full");
      assert.equal(current.sla.budget_ms, 14400000);
      advance(90);
      await update({
        status: "pending",
        pending_reason: "Aguardando retorno fictício",
      });
      advance(180);
      const otherDb = createDatabase(connection);
      const restarted = buildApp(otherDb, false, clock);
      try {
        const persisted = (await restarted.inject(`/tickets/${id}`)).json();
        assert.equal(persisted.sla.remaining_ms, 150 * 60000);
        assert.equal(persisted.sla.paused, true);
        assert.equal(persisted.sla.sla_due_at, null);
      } finally {
        await restarted.close();
      }
      await update({ status: "in_progress" });
      assert.equal(current.sla.remaining_ms, 150 * 60000);
      advance(150);
      await update({
        status: "resolved",
        resolution_summary: "Solução fictícia no limite exato",
      });
      assert.equal(current.sla.result, "met");
      assert.equal(current.sla.consumed_ms, 240 * 60000);
      const frozen = JSON.stringify(current.sla_cycles[0]);
      advance(60);
      await update({
        status: "in_progress",
        reopen_reason: "Reincidência fictícia",
        priority: "critical",
      });
      assert.equal(current.sla.cycle_number, 2);
      assert.equal(current.sla.remaining_ms, 3600000);
      const original = current.sla_cycles[0];
      assert.equal(original.result, "met");
      assert.equal(original.consumed_ms, 240 * 60000);
      assert.ok(frozen.includes(original.ended_at));
      advance(30);
      await update({
        status: "resolved",
        resolution_summary: "Segunda solução fictícia",
      });
      assert.equal(current.sla.state, "met_after_reopen");
      assert.equal(current.sla_cycles.length, 2);
      const metrics = (await app.inject("/metrics/overview?period=all")).json();
      assert.equal(metrics.sla.met, 1);
      assert.equal(metrics.sla.compliance_rate, 100);
      assert.equal(metrics.operations.average_total_resolution_minutes, 510);
      assert.equal(
        metrics.operations.average_effective_resolution_minutes,
        270,
      );
    } finally {
      await app.close();
    }
  }));
test("prioridade usa consumo acumulado e pausa preserva violação anterior", async () =>
  isolated(async (db) => {
    let at = new Date("2026-09-02T00:00:00Z");
    const app = buildApp(db, false, () => new Date(at));
    const input = await setup(db);
    let current = (
      await app.inject({ method: "POST", url: "/tickets", payload: input })
    ).json();
    const update = async (fields: object) => {
      const response = await app.inject({
        method: "PATCH",
        url: `/tickets/${current.id}`,
        payload: { version: current.version, ...fields },
      });
      assert.equal(response.statusCode, 200, response.body);
      current = response.json();
    };
    try {
      at = new Date(at.getTime() + 90 * 60000);
      await update({ priority: "critical" });
      assert.equal(current.sla.exceeded_ms, 30 * 60000);
      await update({
        status: "pending",
        pending_reason: "Pausa após violação",
      });
      at = new Date(at.getTime() + 180 * 60000);
      await update({ priority: "high" });
      assert.equal(current.sla.remaining_ms, 150 * 60000);
      assert.equal(current.sla.breached_before_pause, true);
      assert.equal(current.sla.paused, true);
      assert.equal(current.sla_cycles[0].pauses.length, 1);
      await update({
        priority: "critical",
        status: "resolved",
        resolution_summary: "Resolvido durante a pendência",
      });
      assert.equal(current.sla.result, "breached");
      assert.equal(current.sla.consumed_ms, 90 * 60000);
      assert.equal(current.sla_cycles[0].pauses[0].ended_at, at.toISOString());
      const old = current.sla_cycles[0];
      await update({
        status: "in_progress",
        reopen_reason: "Nova tentativa fictícia",
      });
      at = new Date(at.getTime() + 30 * 60000);
      await update({
        status: "resolved",
        resolution_summary: "Resolvido no segundo ciclo",
      });
      assert.equal(current.sla.state, "met_after_reopen");
      assert.equal(current.sla.previous_breached_cycles, 1);
      assert.equal(current.sla_cycles[0].result, old.result);
    } finally {
      await app.close();
    }
  }));
test("indicadores SQL: população, janelas, médias, limites e sem amostra", async () =>
  isolated(async (db) => {
    let at = new Date("2026-08-01T00:00:00Z");
    const app = buildApp(db, false, () => new Date(at));
    const input = await setup(db);
    const create = async (priority: string) => {
      const response = await app.inject({
        method: "POST",
        url: "/tickets",
        payload: { ...input, priority },
      });
      assert.equal(response.statusCode, 201, response.body);
      return response.json();
    };
    const resolve = async (
      ticket: { id: string; version: number },
      minutes: number,
    ) => {
      at = new Date(at.getTime() + minutes * 60000);
      const response = await app.inject({
        method: "PATCH",
        url: `/tickets/${ticket.id}`,
        payload: {
          version: ticket.version,
          status: "resolved",
          resolution_summary: "Solução fictícia controlada",
        },
      });
      assert.equal(response.statusCode, 200, response.body);
    };
    try {
      const empty = (await app.inject("/metrics/overview?period=all")).json();
      assert.equal(empty.sla.compliance_rate, null);
      assert.equal(empty.operations.average_total_resolution_minutes, null);
      await create("critical"); // backlog antigo, fora do filtro, ainda precisa aparecer no backlog
      at = new Date("2026-09-24T00:00:00Z");
      await resolve(await create("high"), 60);
      await resolve(await create("critical"), 90);
      await create("low");
      at = new Date("2026-09-25T00:00:00Z");
      const metrics = (await app.inject("/metrics/overview?period=7d")).json();
      assert.equal(metrics.tickets.created_in_period, 3);
      assert.equal(metrics.operations.backlog, 2);
      assert.equal(metrics.operations.critical_open, 1);
      assert.equal(metrics.sla.met, 1);
      assert.equal(metrics.sla.breached, 1);
      assert.equal(metrics.sla.compliance_rate, 50);
      assert.equal(metrics.operations.average_total_resolution_minutes, 75);
      assert.equal(metrics.operations.average_effective_resolution_minutes, 75);
      assert.equal(
        metrics.distributions.priority.reduce(
          (n: number, p: { count: number }) => n + p.count,
          0,
        ),
        3,
      );
      assert.equal(
        (await app.inject("/metrics/overview?period=all")).json().tickets
          .created_in_period,
        4,
      );
      assert.equal(
        (await app.inject("/metrics/overview?period=wrong")).statusCode,
        400,
      );
      assert.equal(
        (await app.inject("/metrics/overview?period=all&at=2026-01-01"))
          .statusCode,
        400,
      );
      // Criado exatamente no início da janela deve entrar; um milissegundo antes não.
      at = new Date("2026-09-18T00:00:00Z");
      await create("medium");
      at = new Date("2026-09-17T23:59:59.999Z");
      await create("medium");
      at = new Date("2026-09-25T00:00:00Z");
      assert.equal(
        (await app.inject("/metrics/overview?period=7d")).json().tickets
          .created_in_period,
        4,
      );
      assert.equal(
        (await app.inject("/metrics/overview?period=30d")).json().tickets
          .created_in_period,
        5,
      );
    } finally {
      await app.close();
    }
  }));
test("migração de legados não inventa cobertura e exclui parciais dos KPIs", async () =>
  isolated(async (db, connection) => {
    const directory = await mkdtemp(join(tmpdir(), "sla-legacy-"));
    const files = await readdir(
      new URL("../../../packages/database/migrations/", import.meta.url),
    );
    try {
      for (const name of files.filter((f) => f < "004"))
        await copyFile(
          new URL(
            `../../../packages/database/migrations/${name}`,
            import.meta.url,
          ),
          join(directory, name),
        );
      await migrate(connection, false, pathToFileURL(directory + "/"));
      const input = await setup(db);
      const prior = new Date("2026-01-01T00:00:00Z");
      const insert = async (status: string) =>
        (
          await db.query(
            `INSERT INTO tickets(title,description,type,category_id,priority,requester,technician_id,status,created_at,updated_at,resolved_at,resolution_summary,pending_reason)
 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,CASE WHEN $8='resolved' THEN $9::timestamptz END,CASE WHEN $8='resolved' THEN 'Solução anterior à implantação' END,CASE WHEN $8='pending' THEN 'Pendência anterior à implantação' END) RETURNING id`,
            [
              input.title,
              input.description,
              input.type,
              input.category_id,
              input.priority,
              input.requester,
              input.technician_id,
              status,
              prior,
            ],
          )
        ).rows[0].id;
      const pending = await insert("pending"),
        resolved = await insert("resolved");
      await migrate(connection);
      let at = new Date(Date.now() + 60000);
      const app = buildApp(db, false, () => new Date(at));
      try {
        let legacy = (await app.inject(`/tickets/${pending}`)).json();
        assert.equal(legacy.sla.coverage, "partial");
        assert.equal(legacy.sla.consumed_ms, 0);
        assert.equal(legacy.sla.remaining_ms, 14400000);
        assert.ok(new Date(legacy.sla.tracking_started_at) > prior);
        assert.match(legacy.sla.coverage_label, /SLA acompanhado desde/);
        assert.equal(
          (await app.inject(`/tickets/${resolved}`)).json().sla.coverage,
          "none",
        );
        const response = await app.inject({
          method: "PATCH",
          url: `/tickets/${pending}`,
          payload: {
            version: legacy.version,
            status: "resolved",
            resolution_summary: "Solução após ativação",
          },
        });
        assert.equal(response.statusCode, 200, response.body);
        legacy = response.json();
        const metrics = (
          await app.inject("/metrics/overview?period=all")
        ).json();
        assert.equal(metrics.sla.eligible, 0);
        assert.equal(metrics.sla.compliance_rate, null);
        assert.equal(metrics.sla.excluded_partial, 1);
        assert.equal(metrics.sla.excluded_untracked, 1);
        assert.equal(metrics.sla.partial_results.met, 1);
        assert.equal(metrics.operations.effective_resolution_sample, 0);
        at = new Date(at.getTime() + 60000);
        const reopen = await app.inject({
          method: "PATCH",
          url: `/tickets/${resolved}`,
          payload: {
            version: 1,
            status: "in_progress",
            reopen_reason: "Reabertura de legado resolvido",
          },
        });
        assert.equal(reopen.statusCode, 200, reopen.body);
        assert.equal(reopen.json().sla.coverage, "partial");
      } finally {
        await app.close();
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, false));
test("concorrência e falha de histórico revertem SLA junto com o chamado", async () =>
  isolated(async (db) => {
    const at = new Date("2026-09-10T00:00:00Z"),
      clock = () => at;
    const app = buildApp(db, false, clock);
    const input = await setup(db);
    const created = (
      await app.inject({ method: "POST", url: "/tickets", payload: input })
    ).json();
    try {
      const repository = new TicketsRepository(db, clock);
      repository.record = async () => {
        throw new Error("simulated_history_failure");
      };
      const service = new TicketsService(repository, clock);
      await assert.rejects(
        service.update(created.id, {
          version: 1,
          status: "pending",
          pending_reason: "Pausa deve reverter",
        }),
        /simulated_history_failure/,
      );
      let detail = (await app.inject(`/tickets/${created.id}`)).json();
      assert.equal(detail.status, "open");
      assert.equal(detail.sla.paused, false);
      assert.equal(detail.sla_cycles[0].pauses.length, 0);
      assert.equal(detail.history.length, 1);
      const responses = await Promise.all(
        ["medium", "critical"].map((priority) =>
          app.inject({
            method: "PATCH",
            url: `/tickets/${created.id}`,
            payload: { version: 1, priority },
          }),
        ),
      );
      assert.deepEqual(responses.map((r) => r.statusCode).sort(), [200, 409]);
      detail = (await app.inject(`/tickets/${created.id}`)).json();
      assert.equal(detail.version, 2);
      assert.equal(detail.sla.priority, detail.priority);
      assert.equal(detail.sla_cycles.length, 1);
      const count = (await db.query("SELECT count(*) FROM ticket_sla_cycles"))
        .rows[0].count;
      await assert.rejects(
        service.create(input as Parameters<typeof service.create>[0]),
        /simulated_history_failure/,
      );
      assert.equal(
        (await db.query("SELECT count(*) FROM ticket_sla_cycles")).rows[0]
          .count,
        count,
      );
    } finally {
      await app.close();
    }
  }));
