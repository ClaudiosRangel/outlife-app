import { describe, expect, it } from 'vitest';

/**
 * Unit test de meta tags distintas por rota (task 14.6 do spec
 * outlife-production-plan).
 *
 * Abordagem escolhida: importar diretamente o objeto `Route` exportado por
 * cada arquivo de rota pública e por `__root.tsx`, e acessar a função
 * configurada via `Route.options.head()` (API do `createFileRoute`/
 * `createRootRouteWithContext` do TanStack Router — confirmado por inspeção
 * rápida do objeto `Route` retornado, que expõe `options.head` como a
 * função passada na definição da rota). Essa é a forma mais fiel de testar
 * o `head()` real sem precisar montar um router completo.
 *
 * Diferente do previsto no passo 4 da task, importar os arquivos de rota
 * diretamente NÃO causou nenhum erro de resolução de módulo (assets de
 * imagem/CSS resolvem normalmente sob Vite+Vitest com a config do projeto),
 * então nenhum mock/stub adicional foi necessário.
 *
 * Requirements: 8.3
 */

import { Route as IndexRoute } from '@/routes/index';
import { Route as ExplorarRoute } from '@/routes/explorar';
import { Route as MarketplaceRoute } from '@/routes/marketplace';
import { Route as BuscaRoute } from '@/routes/busca';
import { Route as ComunidadeRoute } from '@/routes/comunidade';
import { Route as ComplianceRoute } from '@/routes/compliance';
import { Route as RootRoute } from '@/routes/__root';

type HeadMeta = Array<Record<string, string | undefined>>;
type HeadResult = { meta?: HeadMeta; links?: unknown[] };
type RouteWithHead = { options: { head?: () => HeadResult } };

const PUBLIC_ROUTES: Record<string, RouteWithHead> = {
  index: IndexRoute as unknown as RouteWithHead,
  explorar: ExplorarRoute as unknown as RouteWithHead,
  marketplace: MarketplaceRoute as unknown as RouteWithHead,
  busca: BuscaRoute as unknown as RouteWithHead,
  comunidade: ComunidadeRoute as unknown as RouteWithHead,
  compliance: ComplianceRoute as unknown as RouteWithHead,
};

function extractTitle(meta: HeadMeta | undefined): string | undefined {
  return meta?.find((m) => 'title' in m)?.title;
}

function extractDescription(meta: HeadMeta | undefined): string | undefined {
  return meta?.find((m) => m.name === 'description')?.content;
}

function getHeadResult(route: RouteWithHead): HeadResult {
  const head = route.options.head;
  expect(typeof head, 'rota deve configurar options.head como função').toBe('function');
  return head!();
}

const rootHead = getHeadResult(RootRoute as unknown as RouteWithHead);
const rootTitle = extractTitle(rootHead.meta);

describe('head() das rotas públicas — title/description distintos (Requirement 8.3)', () => {
  it('o root (__root.tsx) tem um title genérico definido', () => {
    expect(rootTitle, 'title genérico do root não deve ser vazio/undefined').toBeTruthy();
  });

  it.each(Object.entries(PUBLIC_ROUTES))(
    'rota "%s" tem title e description não vazios',
    (_name, route) => {
      const { meta } = getHeadResult(route);
      const title = extractTitle(meta);
      const description = extractDescription(meta);

      expect(title, 'title não deve ser undefined/vazio').toBeTruthy();
      expect(description, 'description não deve ser undefined/vazio').toBeTruthy();
    },
  );

  it.each(Object.entries(PUBLIC_ROUTES))(
    'rota "%s" tem title distinto do title genérico do root',
    (_name, route) => {
      const { meta } = getHeadResult(route);
      const title = extractTitle(meta);

      expect(title).not.toBe(rootTitle);
    },
  );

  it('todos os titles das rotas públicas são distintos entre si (sem duplicados)', () => {
    const titles = Object.values(PUBLIC_ROUTES).map((route) => extractTitle(getHeadResult(route).meta));

    const uniqueTitles = new Set(titles);
    expect(uniqueTitles.size, 'não deve haver title duplicado entre as rotas públicas').toBe(titles.length);
  });
});
