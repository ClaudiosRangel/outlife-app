import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

// SSR_Build_Target (default, implantado na Vercel com SSR/server functions)
// vs SPA_Build_Target (build estática, sem SSR/server functions, empacotada
// no Outlife_Native_Shell). Ver Requirements 1.2 e 1.6.
const buildTarget = process.env.BUILD_TARGET ?? "ssr"; // "ssr" | "native-spa"
const isNativeSpa = buildTarget === "native-spa";

export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    ...(isNativeSpa
      ? []
      : [
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
        ]),
    react(),
  ],
  resolve: {
    alias: {
      "@": `${process.cwd()}/src`,
      // O plugin @outlife/capacitor-location-tracking é um pacote local
      // cujo dist/ não é commitado. No SSR e SPA build, resolve direto
      // para o source TS — o bundler vai tree-shake tudo que não é usado
      // de fato (os métodos nativos nunca são chamados no SSR).
      "@outlife/capacitor-location-tracking": `${process.cwd()}/native/capacitor-location-tracking/src/index.ts`,
      // SPA_Build_Target: as rotas de API server-only (`api.places.*`,
      // `api.push.*`) acabam incluídas no bundle client-only por
      // construção do TanStack Router (routeTree.gen.ts as importa
      // estaticamente), mesmo nunca sendo de fato invocadas dentro do
      // Outlife_Native_Shell (que as consome via HTTP remoto). Substitui
      // `node:async_hooks` por um shim mínimo apenas nesse alvo, para o
      // bundler resolver a dependência sem exigir polyfill real de Node.
      ...(isNativeSpa ? { "node:async_hooks": `${process.cwd()}/src/shims/async-local-storage-shim.ts` } : {}),
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
  define: {
    "import.meta.env.VITE_BUILD_TARGET": JSON.stringify(buildTarget),
  },
  ...(isNativeSpa ? { build: { outDir: "dist/native-spa" } } : {}),
});
