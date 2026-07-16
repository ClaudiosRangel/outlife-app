import { describe, expect, it } from 'vitest';

/**
 * Unit test de ausência de referência à Lovable nas meta tags de preview
 * social (task 14.4 do spec outlife-production-plan).
 *
 * Abordagem: mesma já validada em `tests/route-meta-tags.test.ts` —
 * importar diretamente o objeto `Route` de `__root.tsx` e acessar a função
 * configurada via `Route.options.head()` (API do
 * `createRootRouteWithContext` do TanStack Router).
 *
 * Requirements: 8.2
 */

import { Route as RootRoute } from '@/routes/__root';

type HeadMeta = Array<Record<string, string | undefined>>;
type HeadResult = { meta?: HeadMeta; links?: unknown[] };
type RouteWithHead = { options: { head?: () => HeadResult } };

const LOVABLE_PATTERNS = [/lovable\.app/i, /lovable-app/i];

function getHeadResult(route: RouteWithHead): HeadResult {
  const head = route.options.head;
  expect(typeof head, 'rota deve configurar options.head como função').toBe('function');
  return head!();
}

const { meta } = getHeadResult(RootRoute as unknown as RouteWithHead);

const ogImage = meta?.find((m) => m.property === 'og:image')?.content;
const twitterImage = meta?.find((m) => m.name === 'twitter:image')?.content;

describe('__root.tsx meta tags — sem referência à Lovable (Requirement 8.2)', () => {
  it('og:image está definido', () => {
    expect(ogImage, 'og:image não deve ser undefined/vazio').toBeTruthy();
  });

  it('twitter:image está definido', () => {
    expect(twitterImage, 'twitter:image não deve ser undefined/vazio').toBeTruthy();
  });

  it.each(LOVABLE_PATTERNS)('og:image não contém %s', (pattern) => {
    expect(ogImage).not.toMatch(pattern);
  });

  it.each(LOVABLE_PATTERNS)('twitter:image não contém %s', (pattern) => {
    expect(twitterImage).not.toMatch(pattern);
  });

  it('og:image aponta para /social-preview.png', () => {
    expect(ogImage).toBe('/social-preview.png');
  });

  it('twitter:image aponta para /social-preview.png', () => {
    expect(twitterImage).toBe('/social-preview.png');
  });
});
