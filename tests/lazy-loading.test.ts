import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Teste (task 15.4 do spec outlife-production-plan).
 *
 * Confirma, via leitura do código-fonte, que os componentes de imagem de
 * listagem identificados/ajustados na task 15.3 usam loading="lazy" em
 * suas tags <img>, conforme Requirement 11.2. Não renderiza componentes
 * React (evita depender de dados/rede) — valida a presença do atributo
 * como comportamento observável no código entregue.
 */

const IMG_TAG = /<img\b/;
const LAZY_LITERAL = /loading="lazy"/;
const LAZY_CONDITIONAL = /loading=\{[^}]*"lazy"[^}]*\}/;

describe('loading="lazy" em componentes de imagem de listagem (Requirement 11.2)', () => {
  const filesWithLiteralLazy = [
    'src/routes/index.tsx',
    'src/routes/explorar.tsx',
    'src/routes/marketplace.tsx',
    'src/routes/comunidade.tsx',
    'src/routes/busca.tsx',
  ];

  it.each(filesWithLiteralLazy)(
    '%s contém pelo menos uma tag <img> com loading="lazy"',
    (relativePath) => {
      const content = readFileSync(relativePath, 'utf-8');
      expect(content).toMatch(IMG_TAG);
      expect(content).toMatch(LAZY_LITERAL);
    },
  );

  it('src/routes/parceiro.$partnerId.tsx contém loading="lazy" na galeria de imagens', () => {
    // A primeira imagem da galeria é intencionalmente "eager" (task 15.3);
    // as demais resolvem para "lazy" via expressão condicional. O teste
    // valida apenas a presença geral do comportamento observável
    // (loading="lazy" em alguma <img>), sem acoplar ao detalhe de
    // implementação de qual índice é eager/lazy.
    const content = readFileSync('src/routes/parceiro.$partnerId.tsx', 'utf-8');
    expect(content).toMatch(IMG_TAG);
    expect(LAZY_LITERAL.test(content) || LAZY_CONDITIONAL.test(content)).toBe(true);
  });
});
