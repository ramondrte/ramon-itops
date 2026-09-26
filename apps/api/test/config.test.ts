import { test } from "node:test";
import assert from "node:assert/strict";
import { readConfig } from "../src/config.js";
import { buildApp } from "../src/app.js";
const local = { DATABASE_URL: "postgresql://demo:demo@localhost/demo" };
const production = {
  NODE_ENV: "production",
  DATABASE_URL:
    "postgresql://demo:demo@db.example.com/demo?sslmode=verify-full",
  CORS_ORIGINS: "https://web.example.com",
};
test("configuração distingue desenvolvimento e produção sem fallback silencioso", () => {
  assert.equal(readConfig(local).host, "127.0.0.1");
  assert.equal(
    readConfig({ ...production, PORT: "8080", API_PORT: "3001" }).port,
    8080,
  );
  assert.equal(readConfig(production).host, "0.0.0.0");
  for (const invalid of [
    { ...production, CORS_ORIGINS: "*" },
    { ...production, CORS_ORIGINS: "http://web.example.com" },
    { ...production, CORS_ORIGINS: "" },
    { ...production, DATABASE_URL: local.DATABASE_URL },
    {
      ...production,
      DATABASE_URL:
        "postgresql://demo:demo@db.example.com/demo?sslmode=require",
    },
    { ...local, PORT: "NaN" },
    { ...local, NODE_ENV: "unknown" },
  ])
    assert.throws(() => readConfig(invalid));
});
test("CORS permite origem exata e preflight PATCH sem liberar origens arbitrárias", async () => {
  const app = buildApp(
    { check: async () => {}, close: async () => {} },
    false,
    undefined,
    ["https://web.example.com"],
  );
  try {
    const ok = await app.inject({
      url: "/health",
      headers: { origin: "https://web.example.com" },
    });
    assert.equal(
      ok.headers["access-control-allow-origin"],
      "https://web.example.com",
    );
    assert.equal(ok.headers["access-control-allow-credentials"], undefined);
    const blocked = await app.inject({
      url: "/health",
      headers: { origin: "https://evil.example.com" },
    });
    assert.equal(blocked.headers["access-control-allow-origin"], undefined);
    const preflight = await app.inject({
      method: "OPTIONS",
      url: "/tickets/example",
      headers: {
        origin: "https://web.example.com",
        "access-control-request-method": "PATCH",
        "access-control-request-headers": "content-type",
      },
    });
    assert.equal(preflight.statusCode, 204);
    assert.match(
      String(preflight.headers["access-control-allow-methods"]),
      /PATCH/,
    );
    assert.equal((await app.inject("/health")).statusCode, 200);
  } finally {
    await app.close();
  }
});
