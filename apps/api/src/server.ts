import { readConfig } from "./config.js";
import { config } from "dotenv";
import { createDatabase } from "@ramon-itops/database";
import { buildApp } from "./app.js";
if (process.env.NODE_ENV !== "production")
  config({ path: new URL("../../../.env", import.meta.url), quiet: true });
const settings = readConfig();
const app = buildApp(
  createDatabase(settings.databaseUrl),
  true,
  undefined,
  settings.corsOrigins,
);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void app.close().catch(() => {
      process.exitCode = 1;
    });
  });
}
try {
  await app.listen({ port: settings.port, host: settings.host });
} catch {
  app.log.error("api_start_failed");
  await app.close();
  process.exitCode = 1;
}
