import { describe, expect, it } from 'vitest';
import { generateSitemapXml, PUBLIC_ROUTES, SITE_BASE_URL } from '../scripts/generate-sitemap';

/**
 * Teste de exemplo (task 14.2 do spec outlife-production-plan).
 *
 * Valida que o `sitemap.xml` gerado por `generateSitemapXml` (Requirement 8.1)
 * é XML bem formado e contém exatamente uma entrada `<loc>` para cada rota
 * pública esperada (`PUBLIC_ROUTES`), sem rotas extras ou faltantes.
 *
 * Chama diretamente a função pura exportada por scripts/generate-sitemap.ts,
 * nunca o `main()` interno — portanto não escreve em disco.
 */

describe('generateSitemapXml (sitemap.xml gerado)', () => {
  it('gera XML bem formado com o cabeçalho declarativo e o namespace do sitemap', () => {
    const xml = generateSitemapXml();

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('</urlset>');

    // Validação de estrutura bem formada via checagem de tags balanceadas
    // (o projeto não tem parser XML nas dependências).
    const openTags = xml.match(/<(url|loc)>/g) ?? [];
    const closeTags = xml.match(/<\/(url|loc)>/g) ?? [];
    expect(openTags.length).toBe(closeTags.length);

    const urlOpenCount = (xml.match(/<url>/g) ?? []).length;
    const urlCloseCount = (xml.match(/<\/url>/g) ?? []).length;
    const locOpenCount = (xml.match(/<loc>/g) ?? []).length;
    const locCloseCount = (xml.match(/<\/loc>/g) ?? []).length;

    expect(urlOpenCount).toBe(urlCloseCount);
    expect(locOpenCount).toBe(locCloseCount);
  });

  it('contém exatamente uma <url> por rota pública, sem extras ou faltantes', () => {
    const xml = generateSitemapXml();

    const urlCount = (xml.match(/<url>/g) ?? []).length;
    expect(urlCount).toBe(PUBLIC_ROUTES.length);

    const locCount = (xml.match(/<loc>/g) ?? []).length;
    expect(locCount).toBe(PUBLIC_ROUTES.length);
  });

  it('inclui a URL completa (baseUrl + rota) para cada rota pública, exatamente uma vez', () => {
    const xml = generateSitemapXml();

    for (const route of PUBLIC_ROUTES) {
      const expectedLoc = `<loc>${SITE_BASE_URL}${route}</loc>`;
      const occurrences = xml.split(expectedLoc).length - 1;
      expect(occurrences).toBe(1);
    }
  });

  it('respeita routes e baseUrl customizados passados como parâmetros', () => {
    const customRoutes = ['/a', '/b'] as const;
    const customBaseUrl = 'https://staging.example.com';

    const xml = generateSitemapXml(customRoutes, customBaseUrl);

    expect((xml.match(/<url>/g) ?? []).length).toBe(customRoutes.length);
    expect(xml).toContain('<loc>https://staging.example.com/a</loc>');
    expect(xml).toContain('<loc>https://staging.example.com/b</loc>');
  });
});
