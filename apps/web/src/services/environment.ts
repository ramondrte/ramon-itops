const configured = import.meta.env.VITE_API_BASE_URL?.trim();
export const apiBaseUrl = (configured || "/api").replace(/\/$/, "");
if (apiBaseUrl !== "/api") {
  const url = new URL(apiBaseUrl);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["http:", "https:"].includes(url.protocol)
  )
    throw new Error("VITE_API_BASE_URL inválida");
  if (
    import.meta.env.PROD &&
    (url.protocol !== "https:" ||
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  )
    throw new Error("Build público exige URL HTTPS da API remota");
}

export const demoMode = import.meta.env.VITE_DEMO_MODE === "true";
