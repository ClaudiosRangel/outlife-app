import * as Sentry from "@sentry/tanstackstart-react";

/**
 * Inicialização standalone do Sentry no servidor, pensada para ser carregada
 * via `node --import ./instrument.server.mjs` em um servidor Node
 * tradicional. Não é usada pelo deploy atual na Vercel (preset `vercel` do
 * Nitro gera funções serverless, não um processo Node de longa duração que
 * aceite `--import`) — mantido como preparação para uso futuro caso o
 * deploy mude de plataforma. A captura de erro efetiva em produção hoje
 * ocorre via `sentryGlobalRequestMiddleware`/`sentryGlobalFunctionMiddleware`
 * registrados em `src/start.ts`.
 */
try {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
  });
} catch (error) {
  console.error("[OutLife] Falha ao inicializar Sentry (server):", error);
}
