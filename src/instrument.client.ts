import * as Sentry from "@sentry/tanstackstart-react";

/**
 * Inicialização do Error_Monitoring_Service (Sentry) no client. Envolvida em
 * try/catch conforme Requirement 9.3: uma falha de inicialização é apenas
 * logada via console.error, sem impedir o carregamento normal da
 * OutLife_Application para o usuário. Sem VITE_SENTRY_DSN configurado,
 * Sentry.init simplesmente não envia eventos.
 */
try {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
  });
} catch (error) {
  console.error("[OutLife] Falha ao inicializar Sentry (client):", error);
}
