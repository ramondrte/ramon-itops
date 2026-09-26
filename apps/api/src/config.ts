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
  const demoMode = env.DEMO_MODE === "true";
  const cleanupEnabled = env.DEMO_CLEANUP_ENABLED === "true";
  for (const key of ["DEMO_MODE", "DEMO_CLEANUP_ENABLED"] as const)
    if (env[key] && !["true", "false"].includes(env[key]!))
      throw new Error(`${key} inválido`);
  if (cleanupEnabled && (!demoMode || !production))
    throw new Error("Limpeza exige produção e DEMO_MODE=true");
  const trustProxyHops = Number(env.TRUST_PROXY_HOPS ?? 0);
  if (
    !Number.isInteger(trustProxyHops) ||
    trustProxyHops < 0 ||
    trustProxyHops > 5
  )
    throw new Error("TRUST_PROXY_HOPS inválido");
  if (
    demoMode &&
    (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      env.DEMO_DATABASE_ID ?? "",
    ) ||
      (env.DEMO_IP_HASH_SECRET?.length ?? 0) < 32)
  )
    throw new Error(
      "Modo demo exige identificação do banco e segredo de hash com 32 caracteres ou mais",
    );
  return {
    demo: demoMode
      ? {
          databaseId: env.DEMO_DATABASE_ID!,
          ipHashSecret: env.DEMO_IP_HASH_SECRET!,
          cleanupEnabled,
        }
      : undefined,
    trustProxyHops,
    port,
    host: env.API_HOST ?? (production ? "0.0.0.0" : "127.0.0.1"),
    databaseUrl,
    corsOrigins,
  };
}
