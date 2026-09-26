import { config } from "dotenv";
import { migrate } from "./migrations.js";
if (process.env.NODE_ENV !== "production")
  config({ path: new URL("../../../.env", import.meta.url), quiet: true });
const connection =
  process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connection) throw new Error("DATABASE_URL obrigatória");
console.table(await migrate(connection, process.argv.includes("--status")));
