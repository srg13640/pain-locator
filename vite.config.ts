import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: process.env.PAGES_BASE || "/",
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 4721,
    strictPort: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
