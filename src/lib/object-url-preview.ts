// Gerenciamento puro/testável do Object_URL de preview de imagem
// (spec estabilidade-comunidade-midia, Req 1).
//
// Encapsula a regra "revogar o URL anterior antes de criar/limpar o novo",
// recebendo as funções de create/revoke por injeção — assim é testável sem
// DOM (o projeto não tem jsdom) e reutilizável. `comunidade.tsx` usa
// diretamente `URL.createObjectURL`/`URL.revokeObjectURL`; este módulo existe
// para tornar a regra verificável por testes e evitar vazamento/dupla
// revogação.

export interface ObjectUrlManager {
  /** Cria um novo Object_URL para `file`, revogando o anterior se houver. */
  set(file: Blob): string;
  /** Revoga o Object_URL atual, se houver. */
  clear(): void;
  /** URL vigente (ou null). */
  current(): string | null;
}

export interface ObjectUrlDeps {
  create: (file: Blob) => string;
  revoke: (url: string) => void;
}

/**
 * Cria um gerenciador de Object_URL. Garante que:
 * - ao chamar `set`, o URL anterior é revogado exatamente uma vez antes de
 *   criar o novo (Req 1.3, Property 2);
 * - ao chamar `clear`, o URL atual é revogado exatamente uma vez e some
 *   (Req 1.2, Property 2);
 * - nunca revoga duas vezes o mesmo URL.
 */
export function createObjectUrlManager(deps: ObjectUrlDeps): ObjectUrlManager {
  let currentUrl: string | null = null;

  return {
    set(file: Blob): string {
      if (currentUrl) {
        deps.revoke(currentUrl);
        currentUrl = null;
      }
      const url = deps.create(file);
      currentUrl = url;
      return url;
    },
    clear(): void {
      if (currentUrl) {
        deps.revoke(currentUrl);
        currentUrl = null;
      }
    },
    current(): string | null {
      return currentUrl;
    },
  };
}
