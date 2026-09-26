import { createDatabase } from "@ramon-itops/database";
import { readConfig } from "./config.js";
const settings = readConfig();
if (
  process.env.NODE_ENV !== "production" ||
  !settings.demo ||
  !process.argv.includes("--confirm-empty-demo-database")
)
  throw new Error(
    "Vinculação exige produção, modo demo e --confirm-empty-demo-database",
  );
const db = createDatabase(settings.databaseUrl);
try {
  await db.transaction(async (client) => {
    await client.query(
      "LOCK TABLE demo_environment, tickets IN EXCLUSIVE MODE",
    );
    const existing = (
      await client.query("SELECT environment_id FROM demo_environment")
    ).rows[0];
    if (existing) {
      if (existing.environment_id !== settings.demo!.databaseId)
        throw new Error("Banco já vinculado a outro ambiente");
      return;
    }
    if (
      Number((await client.query("SELECT count(*) FROM tickets")).rows[0].count)
    )
      throw new Error("Vinculação exige banco sem chamados");
    await client.query(
      "INSERT INTO demo_environment(environment_id,purpose) VALUES ($1,'public-demo')",
      [settings.demo!.databaseId],
    );
  });
  console.log(
    "Banco exclusivo de demonstração vinculado. Nenhum chamado removido.",
  );
} finally {
  await db.close();
}
