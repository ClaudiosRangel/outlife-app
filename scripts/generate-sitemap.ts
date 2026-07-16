/**
 * Sitemap generator (Requirement 8.1)
 *
 * Gera `public/sitemap.xml` a partir da constante `PUBLIC_ROUTES`: a lista
 * explícita de rotas navegáveis sem autenticação da OutLife_Application
 * (mesma fonte usada para validar o Requirement 8.3 — títulos/descrições
 * por rota pública).
 *
 * Roda no hook `prebuild` de `package.json`, então `public/sitemap.xml`
 * é sempre regenerado antes de cada `npm run build`.
 *
 * Uso:
 *   npx tsx scripts/generate-sitemap.ts
 *   npm run build   (dispara automaticamente via prebuild)
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// URL base de produção da OutLife_Application (Vercel_Production_Deployment,
// ver requirements.md do spec outlife-production-plan). Configurável via
// env var para permitir gerar o sitemap contra outro domínio (ex: staging)
// sem alterar código.
export const SITE_BASE_URL = (process.env.SITE_BASE_URL ?? "https://outlife-app.vercel.app").replace(/\/$/, "");

// Rotas navegáveis sem autenticação (arquivos correspondentes em
// `src/routes/*.tsx`, TanStack Router file-based routing). Rotas que
// exigem sessão (perfil, checklist, painel de parceiro, rastreamento de
// atividade, etc.) SHALL NOT aparecer aqui.
export const PUBLIC_ROUTES = [
  "/",
  "/explorar",
  "/marketplace",
  "/busca",
  "/comunidade",
  "/compliance",
] as const;

export function generateSitemapXml(routes: readonly string[] = PUBLIC_ROUTES, baseUrl: string = SITE_BASE_URL): string {
  const urls = routes
    .map((route) => `  <url>\n    <loc>${baseUrl}${route}</loc>\n  </url>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function main() {
  const xml = generateSitemapXml();
  const outputPath = new URL("../public/sitemap.xml", import.meta.url);
  writeFileSync(outputPath, xml, "utf-8");
  console.log(`[generate-sitemap] public/sitemap.xml gerado com ${PUBLIC_ROUTES.length} rota(s).`);
}

// Só executa `main()` quando o arquivo é rodado diretamente (`npm run
// prebuild` / `tsx scripts/generate-sitemap.ts`), nunca quando é importado
// por outro módulo (ex: teste unitário importando PUBLIC_ROUTES/
// generateSitemapXml sem disparar escrita em disco).
const isMainModule = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  main();
}
