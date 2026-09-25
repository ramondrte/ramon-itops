import pg from 'pg';
export function createDatabase(connectionString: string) {
  const pool = new pg.Pool({ connectionString, max: 5, connectionTimeoutMillis: 2000, statement_timeout: 2000, query_timeout: 2500 });
  // Um cliente ocioso pode perder a conexão; o próximo check verificará a recuperação.
  pool.on('error', () => console.error('database_pool_connection_lost'));
  return {
    async check() { await pool.query('SELECT 1'); },
    async close() { await pool.end(); }
  };
}
