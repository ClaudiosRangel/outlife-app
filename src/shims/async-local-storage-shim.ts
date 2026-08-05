// Shim de `node:async_hooks` usado exclusivamente pelo SPA_Build_Target
// (Outlife_Native_Shell). O bundle client-only da árvore de rotas
// (routeTree.gen.ts) inclui, por construção do TanStack Router, também as
// rotas de API server-only (`api.places.*`, `api.push.*`), que dependem de
// `AsyncLocalStorage` (via `@tanstack/react-start`) apenas em tempo de
// execução no servidor — nunca de fato chamado dentro do WebView nativo,
// já que esse alvo consome essas rotas via HTTP remoto, nunca localmente.
// Este stub existe só para satisfazer o bundler (Rollup/Vite não
// polyfillam `node:async_hooks` no browser); nenhuma lógica real dele é
// executada no cliente.
export class AsyncLocalStorage<T> {
  private store: T | undefined;

  run<R>(store: T, callback: () => R): R {
    const previous = this.store;
    this.store = store;
    try {
      return callback();
    } finally {
      this.store = previous;
    }
  }

  getStore(): T | undefined {
    return this.store;
  }
}
