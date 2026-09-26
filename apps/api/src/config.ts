export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const mode = env.NODE_ENV ?? "development";
  if (!["development", "test", "production"].includes(mode))
    throw new Error("NODE_ENV inválido");
  const production = mode === "production";
  const port = Number(env.PORT ?? env.API_PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT/API_PORT inválida");
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL obrigatória");
  let database: URL;
  try {
    database = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL inválida");
  }
  if (!["postgres:", "postgresql:"].includes(database.protocol))
    throw new Error("DATABASE_URL deve usar PostgreSQL");
  if (
    production &&
    ["localhost", "127.0.0.1", "[::1]"].includes(database.hostname)
  )
    throw new Error("Produção exige banco separado do localhost");
  if (production && database.searchParams.get("sslmode") !== "verify-full")
    throw new Error("Produção exige DATABASE_URL com sslmode=verify-full");
  const corsOrigins = (env.CORS_ORIGINS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (production && !corsOrigins.length)
    throw new Error("CORS_ORIGINS obrigatório em produção");
  for (const origin of corsOrigins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error("CORS_ORIGINS inválido");
    }
    if (
      parsed.origin !== origin ||
      !["http:", "https:"].includes(parsed.protocol) ||
      (production && parsed.protocol !== "https:")
    )
      throw new Error("CORS_ORIGINS exige origens exatas, HTTPS em produção");
  }
  return {
    port,
    host: env.API_HOST ?? (production ? "0.0.0.0" : "127.0.0.1"),
    databaseUrl,
    corsOrigins,
  };
}
