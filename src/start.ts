import { createStart, createMiddleware } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

/**
 * NOTA (Requirement 9.1/9.3, task 17.2): os middlewares globais oficiais do
 * Sentry para captura de erro no servidor (`sentryGlobalRequestMiddleware` /
 * `sentryGlobalFunctionMiddleware`, de `@sentry/tanstackstart-react`) NÃO
 * puderam ser adicionados aqui. Tanto o import estático quanto o import
 * dinâmico desse pacote a partir deste arquivo fazem o Nitro (preset
 * `vercel`) rastrear e empacotar as dependências server-side do Sentry
 * (`@sentry/node`, OpenTelemetry), o que dispara um bug conhecido do Rollup
 * (`Cannot read properties of null (reading 'getVariableForExportName')`,
 * rollup/rollup#4739) durante a etapa de bundling da função serverless —
 * quebrando o build de produção por completo. Um relato equivalente foi
 * encontrado especificamente ao integrar Sentry num app TanStack Start
 * (comentário em rollup/rollup#4739, resolvido lá com upgrade para Vite 8,
 * que está fora do escopo desta task por ser um bump maior).
 *
 * Como resultado, a captura de erro do Error_Monitoring_Service nesta
 * aplicação está limitada ao client (`src/instrument.client.ts`,
 * `src/client.tsx` e o `ErrorComponent` de `src/routes/__root.tsx`, via
 * `src/lib/report-error-client.ts`). Erros que ocorrem exclusivamente no
 * servidor (SSR, server functions, middlewares) continuam sendo logados via
 * `console.error` pelo `errorMiddleware` abaixo (visível nos logs da
 * Vercel), mas não são hoje enviados ao Sentry. Ver relatório da task 17.2
 * para detalhes e possíveis caminhos futuros (upgrade de Vite/Rollup, ou
 * aguardar uma correção do SDK do Sentry para este cenário).
 */
const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error("[OutLife SSR Error]", error);
    throw error;
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
