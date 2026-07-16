import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Teste (task 17.4 do spec outlife-production-plan).
 *
 * Confirma resiliência a falha de inicialização do Error_Monitoring_Service
 * (Sentry) e do Web_Analytics_Service (Vercel Analytics): uma falha em
 * qualquer um dos dois NÃO deve impedir a OutLife_Application de continuar
 * renderizando/carregando normalmente (Requirements 9.3 e 9.4).
 *
 * Nota sobre `importProtection` (ver vite.config.ts): o plugin
 * `tanstackStart()` mocka arquivos `*.client.*` (como
 * src/instrument.client.ts) para um módulo vazio quando importados fora do
 * ambiente "client" do Vite — o que impediria este teste de exercitar o
 * código real do arquivo sob Vitest (que roda no ambiente "ssr"). Por isso
 * `importProtection` é desabilitado condicionalmente quando `VITEST` está
 * definido, sem afetar build/dev de produção.
 */

// Mock hoisted (aplicado antes de qualquer import deste arquivo de teste,
// inclusive o import dinâmico de src/instrument.client.ts feito dentro do
// teste abaixo) fazendo `Sentry.init` lançar, para simular falha de
// inicialização.
vi.mock('@sentry/tanstackstart-react', () => ({
  init: vi.fn(() => {
    throw new Error('Falha simulada de inicialização do Sentry');
  }),
}));

describe('Resiliência à falha de inicialização do Sentry (client) — Requirement 9.3', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('não lança exceção quando Sentry.init falha, e loga o erro via console.error', async () => {
    // src/instrument.client.ts executa `Sentry.init(...)` no nível do módulo,
    // dentro de um try/catch (Requirement 9.3). Com `Sentry.init` mockado
    // para lançar (acima), re-executamos o módulo via import dinâmico (com
    // vi.resetModules() antes, já que módulos ES são cacheados) para
    // confirmar que a falha não escapa do import.
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let caughtError: unknown;
    try {
      await import('../src/instrument.client');
    } catch (error) {
      caughtError = error;
    }

    // A aplicação deve continuar carregando normalmente: nenhuma exceção
    // deve escapar do import, mesmo com Sentry.init lançando.
    expect(caughtError).toBeUndefined();

    // A falha deve ser apenas logada, conforme implementação.
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[OutLife] Falha ao inicializar Sentry (client):',
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });
});

describe('Resiliência à falha do Vercel Analytics — Requirement 9.4', () => {
  /**
   * O componente <Analytics /> (@vercel/analytics/react) já é projetado
   * pela própria biblioteca para falhar silenciosamente caso o script não
   * carregue, e o design.md do projeto documenta explicitamente que nenhum
   * tratamento adicional (try/catch/error boundary) é necessário em torno
   * dele. Montar a árvore completa de RootComponent exigiria mockar várias
   * dependências (@tanstack/react-router, @tanstack/react-query,
   * AuthProvider, PhoneFrame, BottomNav, etc.) e o projeto não tem
   * jsdom/@testing-library configurado para testes de componente — o que
   * tornaria esse teste complexo e frágil sem ganho real de confiança.
   *
   * Seguindo a mesma abordagem pragmática já usada em outros testes deste
   * projeto (tests/lazy-loading.test.ts, tests/pwa-manifest.test.ts),
   * validamos via leitura do código-fonte que <Analytics /> está presente
   * no JSX de RootComponent e que ele NÃO está envolvido por um try/catch
   * ou error boundary que pudesse suprimir indevidamente eventos de
   * analytics — o que confirma, por leitura, que uma falha na montagem do
   * componente (silenciosa por design da biblioteca) não é capturada/
   * escondida por lógica adicional do projeto, e também não impede o
   * restante da árvore (que está fora do escopo desse trecho) de renderizar.
   */
  it('<Analytics /> está presente em RootComponent sem try/catch ou error boundary ao redor', () => {
    const content = readFileSync('src/routes/__root.tsx', 'utf-8');

    // RootComponent é a última função declarada no arquivo, então o trecho
    // do seu início até o fim do arquivo corresponde ao corpo completo da
    // função (mais robusto que casar chaves de fechamento via regex).
    const rootComponentStart = content.indexOf('function RootComponent()');
    expect(rootComponentStart).toBeGreaterThan(-1);
    const rootComponentBody = content.slice(rootComponentStart);

    expect(rootComponentBody).toMatch(/<Analytics\s*\/>/);
    expect(rootComponentBody).not.toMatch(/try\s*\{/);
    expect(rootComponentBody).not.toMatch(/<ErrorBoundary/);
  });
});
