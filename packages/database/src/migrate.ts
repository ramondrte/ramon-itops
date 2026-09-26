import { config } from "dotenv";
import { migrate } from "./migrations.js";
config({ path: new URL("../../../.env", import.meta.url), quiet: true });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL obrigatória");
console.table(
  await migrate(process.env.DATABASE_URL, process.argv.includes("--status")),
);
