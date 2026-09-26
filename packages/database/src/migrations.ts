import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import pg from "pg";
export async function migrate(
  connectionString: string,
  statusOnly = false,
  directory = new URL("../migrations/", import.meta.url),
) {
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 3000,
  });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock(78201902)");
    const exists = await client.query(
      "SELECT to_regclass('schema_migrations') AS name",
    );
    if (!exists.rows[0].name && !statusOnly) {
      await client.query(
        "CREATE TABLE schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
      );
    }
    const applied =
      exists.rows[0].name || !statusOnly
        ? (
            await client.query(
              "SELECT name, checksum FROM schema_migrations ORDER BY name",
            )
          ).rows
        : [];
    const files = (await readdir(directory))
      .filter((name) => /^\d+_[a-z_]+\.sql$/.test(name))
      .sort();
    if (applied.some((row) => !files.includes(row.name)))
      throw new Error("Migration aplicada ausente no diretório.");
    const result = [];
    for (const name of files) {
      const sql = await readFile(new URL(name, directory), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const previous = applied.find((row) => row.name === name);
      if (previous && previous.checksum !== checksum)
        throw new Error(`Migration alterada após aplicação: ${name}`);
      if (!previous && !statusOnly) {
        await client.query("BEGIN");
        try {
          await client.query(sql);
          await client.query(
            "INSERT INTO schema_migrations(name, checksum) VALUES ($1, $2)",
            [name, checksum],
          );
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }
      result.push({
        name,
        status: previous || !statusOnly ? "applied" : "pending",
      });
    }
    return result;
  } finally {
    await client.end();
  }
}
