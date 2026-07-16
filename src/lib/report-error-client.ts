import { createIsomorphicFn } from "@tanstack/react-start";

/**
 * Reporta um erro ao Error_Monitoring_Service (Sentry) com a rota atual
 * como tag (Requirement 9.1). Usa `createIsomorphicFn` para que apenas a
 * implementação do client importe `@sentry/tanstackstart-react` — no
 * servidor, esta função é um no-op. Isso evita que o bundler do TanStack
 * Start/Nitro precise incluir as dependências server-side do Sentry
 * (`@sentry/node`, OpenTelemetry) no bundle da função serverless da Vercel
 * apenas por causa deste reporte de erro do `errorComponent`, que hoje quebra
 * o build (ver Property/limitação documentada na task 17.2).
 */
export const reportErrorToSentry = createIsomorphicFn().client((error: Error, route: string) => {
  // Import dinâmico: mantém o pacote fora do grafo de módulos estático
  // resolvido em build-time para o ambiente server, mesmo com
  // createIsomorphicFn já garantindo que este branch só executa no client.
  import("@sentry/tanstackstart-react").then((Sentry) => {
    Sentry.captureException(error, { tags: { route } });
  });
});
