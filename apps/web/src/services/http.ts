export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}
export async function requestApi<T>(
  base: string,
  path: string,
  options: RequestInit = {},
  demo = false,
  transport: typeof fetch = fetch,
): Promise<T> {
  const reading = ["GET", "HEAD"].includes(
    (options.method ?? "GET").toUpperCase(),
  );
  const attempts = demo && reading ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    let response: Response;
    try {
      const timeout = AbortSignal.timeout(demo ? 90000 : 10000);
      response = await transport(`${base}${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", ...options.headers },
        signal: options.signal
          ? AbortSignal.any([options.signal, timeout])
          : timeout,
      });
    } catch {
      if (options.signal?.aborted) throw new ApiError(0, "Consulta cancelada.");
      if (attempt + 1 < attempts) continue;
      throw new ApiError(
        0,
        reading
          ? "Serviço temporariamente indisponível. Aguarde e tente novamente."
          : "Não foi possível confirmar a operação. Confira o chamado ou a fila antes de tentar novamente.",
      );
    }
    const body = await response.json().catch(() => null);
    const retryAfter = Number(response.headers.get("Retry-After"));
    if (response.status === 429)
      throw new ApiError(
        429,
        `Limite temporário da demonstração atingido.${retryAfter > 0 ? ` Tente novamente em ${Math.ceil(retryAfter / 60)} minuto(s).` : " Aguarde e tente novamente."}`,
        retryAfter > 0 ? retryAfter : undefined,
      );
    if (
      demo &&
      reading &&
      (body === null || [502, 503, 504].includes(response.status)) &&
      attempt + 1 < attempts
    )
      continue;
    if (!response.ok || body === null)
      throw new ApiError(
        response.status,
        body?.message ??
          (demo
            ? "Serviço iniciando ou temporariamente indisponível. Aguarde e tente novamente."
            : "Não foi possível concluir a operação. Tente novamente."),
      );
    return body as T;
  }
  throw new ApiError(0, "Serviço temporariamente indisponível.");
}
