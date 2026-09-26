import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { createDatabase } from "@ramon-itops/database";
import { migrate } from "../../../packages/database/src/migrations.js";
import { buildApp } from "../src/app.js";
import { TicketsRepository } from "../src/modules/tickets/tickets.repository.js";
import { TicketsService } from "../src/modules/tickets/tickets.service.js";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error(
    "TEST_DATABASE_URL deve apontar para um banco dedicado com sufixo _test.",
  );
test("Service Desk com PostgreSQL real", async (t) => {
  const admin = createDatabase(url);
  const schema = `test_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  const connection = new URL(url);
  connection.searchParams.set("options", `-csearch_path=${schema}`);
  const db = createDatabase(connection.toString());
  const app = buildApp(db, false);
  try {
    await t.test("migrations concorrentes, repetíveis e checksum", async () => {
      await Promise.all([
        migrate(connection.toString()),
        migrate(connection.toString()),
      ]);
      assert.equal((await migrate(connection.toString(), true)).length, 7);
      assert.equal(
        (await db.query("SELECT count(*) FROM categories")).rows[0].count,
        "7",
      );
      const dir = await mkdtemp(join(tmpdir(), "itops-migrations-"));
      try {
        for (const name of await readdir(new URL('../../../packages/database/migrations/', import.meta.url))) {
          const sql = await readFile(
            new URL(
              `../../../packages/database/migrations/${name}`,
              import.meta.url,
            ),
            "utf8",
          );
          await writeFile(
            join(dir, name),
            sql + (name.startsWith("001") ? "\n-- altered" : ""),
          );
        }
        await assert.rejects(
          migrate(connection.toString(), false, pathToFileURL(dir + "/")),
          /alterada/,
        );
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
    const categories = (await app.inject("/categories")).json();
    const technician = (
      await db.query(
        "INSERT INTO technicians(name) VALUES ('Técnico fictício de teste') RETURNING id",
      )
    ).rows[0].id;
    const input = {
      title: "Falha de rede no laboratório",
      description: "Equipamento de demonstração não acessa a rede.",
      type: "incident" as const,
      priority: "high" as const,
      requester: "Solicitante fictício",
      category_id: categories[0].id,
    };
    const created = await app.inject({
      method: "POST",
      url: "/tickets",
      payload: input,
    });
    assert.equal(created.statusCode, 201, created.body);
    let current = created.json();
    const id = current.id;
    const patch = (values: object) =>
      app.inject({
        method: "PATCH",
        url: `/tickets/${id}`,
        payload: { version: current.version, ...values },
      });
    await t.test(
      "criação persistida, numeração e histórico inicial",
      async () => {
        assert.match(current.number, /^INC-\d{6,}$/);
        assert.equal(current.status, "open");
        assert.equal(current.history.length, 1);
        const request = await app.inject({
          method: "POST",
          url: "/tickets",
          payload: { ...input, type: "request" },
        });
        assert.match(request.json().number, /^REQ-\d{6,}$/);
        const parallel = await Promise.all(
          Array.from({ length: 4 }, () =>
            app.inject({ method: "POST", url: "/tickets", payload: input }),
          ),
        );
        assert.equal(new Set(parallel.map((r) => r.json().number)).size, 4);
        const secondConnection = createDatabase(connection.toString());
        try {
          assert.equal(
            (
              await secondConnection.query(
                "SELECT title FROM tickets WHERE id=$1",
                [id],
              )
            ).rows[0].title,
            input.title,
          );
        } finally {
          await secondConnection.close();
        }
      },
    );
    await t.test("validação, referências e filtros paginados", async () => {
      for (const payload of [
        { ...input, unknown: true },
        { ...input, title: "   " },
        { ...input, priority: "urgent" },
        { ...input, technician_id: 4 },
      ])
        assert.equal(
          (await app.inject({ method: "POST", url: "/tickets", payload }))
            .statusCode,
          400,
        );
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/tickets",
            payload: { ...input, category_id: randomUUID() },
          })
        ).statusCode,
        422,
      );
      assert.equal((await app.inject("/tickets/not-a-uuid")).statusCode, 400);
      assert.equal(
        (await app.inject(`/tickets/${randomUUID()}`)).statusCode,
        404,
      );
      assert.equal((await app.inject("/tickets?status=wrong")).statusCode, 400);
      const list = await app.inject(
        `/tickets?status=open&priority=high&category_id=${input.category_id}&page=1&page_size=2`,
      );
      assert.equal(list.statusCode, 200, list.body);
      assert.equal(list.json().items.length, 2);
      assert.equal(list.json().total, 6);
      assert.equal((await app.inject("/tickets?priority=low")).json().total, 0);
    });
    await t.test(
      "responsável, pendência e atualizações sem efeito",
      async () => {
        assert.equal((await patch({ status: "in_progress" })).statusCode, 422);
        let response = await patch({
          status: "in_progress",
          technician_id: technician,
        });
        assert.equal(response.statusCode, 200, response.body);
        current = response.json();
        assert.equal((await patch({ status: "pending" })).statusCode, 422);
        response = await patch({
          status: "pending",
          pending_reason: "Aguardando retorno do fornecedor fictício",
        });
        assert.equal(response.statusCode, 200);
        current = response.json();
        const unchanged = await patch({ priority: current.priority });
        assert.equal(unchanged.json().version, current.version);
        assert.equal(unchanged.json().history.length, current.history.length);
        response = await patch({
          category_id: categories[1].id,
          priority: "critical",
        });
        assert.equal(response.statusCode, 200);
        current = response.json();
        assert.ok(current.history.at(-1).changes.category_name);
      assert.ok(current.history.at(-1).changes.priority);
      },
    );
    await t.test(
      "resolução e reabertura preservam rastreabilidade",
      async () => {
        assert.equal((await patch({ status: "resolved" })).statusCode, 422);
        let response = await patch({
          status: "resolved",
          resolution_summary: "Conectividade restaurada após ajuste fictício",
        });
        assert.equal(response.statusCode, 200, response.body);
        current = response.json();
        assert.ok(current.resolved_at);
        assert.equal(current.pending_reason, null);
        assert.equal((await patch({ priority: "low" })).statusCode, 422);
        assert.equal((await patch({ status: "in_progress" })).statusCode, 422);
        response = await patch({
          status: "in_progress",
          reopen_reason: "Falha voltou a ocorrer no cenário fictício",
        });
        assert.equal(response.statusCode, 200);
        current = response.json();
        assert.equal(current.resolved_at, null);
        assert.equal(current.resolution_summary, null);
        assert.equal(current.history.at(-1).action, "reopened");
        assert.ok(
          current.history.some(
            (e: { action: string }) => e.action === "resolved",
          ),
        );
        assert.equal((await patch({ status: "open" })).statusCode, 422);
      },
    );
    await t.test(
      "edição concorrente retorna conflito e não perde histórico",
      async () => {
        const replies = await Promise.all([
          patch({ priority: "medium" }),
          patch({ priority: "low" }),
        ]);
        assert.deepEqual(replies.map((r) => r.statusCode).sort(), [200, 409]);
        current = (await app.inject(`/tickets/${id}`)).json();
      },
    );
    await t.test(
      "falha no histórico reverte atualização e criação",
      async () => {
        const repository = new TicketsRepository(db);
        repository.record = async () => {
          throw new Error("history_write_failed");
        };
        const service = new TicketsService(repository);
        await assert.rejects(
          service.update(id, {
            version: current.version,
            title: "Não deve persistir este título",
          }),
          /history_write_failed/,
        );
        const after = (await app.inject(`/tickets/${id}`)).json();
        assert.equal(after.title, current.title);
        assert.equal(after.version, current.version);
        const before = (await db.query("SELECT count(*) FROM tickets")).rows[0]
          .count;
        await assert.rejects(service.create(input), /history_write_failed/);
        assert.equal(
          (await db.query("SELECT count(*) FROM tickets")).rows[0].count,
          before,
        );
      },
    );
    await t.test("health checks preservados", async () => {
      assert.equal((await app.inject("/health")).statusCode, 200);
      assert.equal((await app.inject("/health/ready")).statusCode, 200);
    });
  } finally {
    await app.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.close();
  }
});
