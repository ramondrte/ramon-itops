import pg, { type PoolClient, type QueryResultRow } from "pg";
export type { PoolClient } from "pg";
export function createDatabase(connectionString: string) {
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 2000,
    statement_timeout: 5000,
    query_timeout: 6000,
  });
  pool.on("error", () => console.error("database_pool_connection_lost"));
  return {
    async check() {
      await pool.query("SELECT 1");
    },
    query<T extends QueryResultRow = QueryResultRow>(
      sql: string,
      values?: unknown[],
    ) {
      return pool.query<T>(sql, values);
    },
    async transaction<T>(
      operation: (client: PoolClient) => Promise<T>,
    ): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await operation(client);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}
export type Database = ReturnType<typeof createDatabase>;
