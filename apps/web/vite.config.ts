import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../..", ["API_", "WEB_"]);
  const proxy = {
    "/api": {
      target: `http://127.0.0.1:${process.env.API_PORT || env.API_PORT || "3001"}`,
      rewrite: (path: string) => path.replace(/^\/api/, ""),
    },
  };
  return {
    plugins: [react()],
    envDir: "../..",
    server: { port: Number(process.env.WEB_PORT || env.WEB_PORT || 5173), strictPort: true, proxy },
    preview: { proxy },
  };
});
