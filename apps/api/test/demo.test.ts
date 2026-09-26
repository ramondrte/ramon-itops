import { test } from "node:test";
import assert from "node:assert/strict";
import { readConfig } from "../src/config.js";
import { buildApp } from "../src/app.js";
import { clientNetwork } from "../src/modules/demo/demo.service.js";
import { requestApi, ApiError } from "../../web/src/services/http.js";
test("limpeza bloqueada fora da demo de produção; identificação obrigatória", () => {
  const base = { DATABASE_URL: "postgresql://demo:demo@localhost/demo" };
  assert.equal(readConfig(base).demo, undefined);
  for (const extra of [
    { DEMO_CLEANUP_ENABLED: "true" },
    { DEMO_MODE: "true" },
    { DEMO_MODE: "yes" },
    { TRUST_PROXY_HOPS: "true" },
    {
      DEMO_MODE: "true",
      DEMO_DATABASE_ID: "00000000-0000-4000-8000-000000000000",
      DEMO_IP_HASH_SECRET: "x".repeat(32),
      DEMO_CLEANUP_ENABLED: "true",
    },
  ])
    assert.throws(() => readConfig({ ...base, ...extra }));
  assert.equal(clientNetwork("::ffff:192.0.2.1"), "192.0.2.1");
  assert.equal(
    clientNetwork("2001:db8:1:2::1"),
    clientNetwork("2001:db8:1:2::abcd"),
  );
});
test("headers e payloads inválidos não expõem stack ou detalhes internos", async () => {
  const app = buildApp({ check: async () => {}, close: async () => {} }, false);
  app.post("/echo", async (req) => req.body);
  try {
    const health = await app.inject("/health");
    assert.equal(health.headers["x-content-type-options"], "nosniff");
    assert.ok(health.headers["content-security-policy"]);
    const huge = await app.inject({
      method: "POST",
      url: "/echo",
      payload: { text: "x".repeat(130 * 1024) },
    });
    assert.equal(huge.statusCode, 413);
    assert.equal(huge.json().error, "payload_too_large");
    assert.ok(!huge.body.includes("stack"));
    const bad = await app.inject({
      method: "POST",
      url: "/echo",
      headers: { "content-type": "application/json" },
      payload: '{"bad"',
    });
    assert.equal(bad.statusCode, 400);
    assert.ok(!bad.body.includes("SyntaxError"));
  } finally {
    await app.close();
  }
});
test("cold start repete somente leitura; escrita incerta não é reenviada", async () => {
  let calls = 0;
  const transport: typeof fetch = async () => {
    calls++;
    return calls === 1
      ? new Response("starting", { status: 503 })
      : Response.json({ status: "ok" });
  };
  assert.deepEqual(
    await requestApi("https://api.example", "/health", {}, true, transport),
    { status: "ok" },
  );
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(
    requestApi(
      "https://api.example",
      "/tickets",
      { method: "POST" },
      true,
      async () => {
        calls++;
        throw new Error("timeout");
      },
    ),
    /Confira o chamado/,
  );
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(
    requestApi("https://api.example", "/tickets", {}, true, async () => {
      calls++;
      return Response.json(
        {},
        { status: 429, headers: { "Retry-After": "90" } },
      );
    }),
    (e) => e instanceof ApiError && e.status === 429 && e.retryAfter === 90,
  );
  assert.equal(calls, 1);
});
