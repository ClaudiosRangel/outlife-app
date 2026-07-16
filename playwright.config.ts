import { defineConfig, devices } from "@playwright/test";

// Carrega o `.env` da raiz do projeto (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// etc.), mesmo padrão já usado em `scripts/seed.ts`. Necessário porque
// `playwright test` roda via Node puro, sem o carregamento automático de
// env vars que o Vite faz para o app.
try {
  process.loadEnvFile(new URL("./.env", import.meta.url));
} catch {
  // Sem .env local (ex: variáveis já exportadas no ambiente de CI) — ok.
}

/**
 * Configuração do Playwright para a E2E_Test_Suite da OutLife_Application.
 *
 * A baseURL é configurável via variável de ambiente `E2E_BASE_URL`, com
 * padrão para o servidor de desenvolvimento local (`npm run dev`,
 * http://localhost:3000). Para rodar contra outra instância (ex: preview
 * da Vercel), defina `E2E_BASE_URL` antes de executar `npm run test:e2e`.
 *
 * Requirements: 10.1
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Inicia `npm run dev` automaticamente antes dos testes, reaproveitando um
  // servidor já em execução em http://localhost:3000 (útil em dev local).
  // Não é usado quando `E2E_BASE_URL` aponta para outra instância (preview,
  // produção), pois nesse caso o Playwright ignora `webServer` só se você
  // remover esta seção — mantemos ativa pois `reuseExistingServer` cobre o
  // caso local sem custo extra.
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
