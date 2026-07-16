import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      // Sob Vitest, o "import protection" do TanStack Start substitui
      // qualquer arquivo `*.client.*` (ex.: src/instrument.client.ts) por um
      // módulo mock vazio quando importado fora do ambiente "client" do
      // Vite — o que impediria testes unitários de exercitar o código real
      // desses arquivos (Requirement 9.3, task 17.4). Desabilitado apenas
      // quando `VITEST` está definido (setado automaticamente pelo próprio
      // Vitest); build e dev normais continuam com a proteção ativa.
      importProtection: { enabled: !process.env.VITEST },
    }),
    nitro({ preset: "vercel" }),
    react(),
  ],
  resolve: {
    alias: {
      "@": `${process.cwd()}/src`,
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  css: { transformer: "lightningcss" },
  server: {
    host: "::",
    port: 3000,
  },
});
