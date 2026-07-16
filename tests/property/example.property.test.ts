import { describe, it } from 'vitest';
import fc from 'fast-check';

/**
 * Teste de exemplo (task 1.1 do spec outlife-production-plan).
 *
 * Confirma que a infraestrutura de property-based testing com `fast-check`
 * está corretamente configurada no projeto (devDependency instalada,
 * pasta tests/property/ criada, execução com numRuns: 100 funcionando).
 *
 * Não valida nenhum Requirement do produto — é a base sobre a qual as
 * property tests reais das seções 5, 7, 8, 10, 12 e 15 serão escritas.
 */

describe('infraestrutura fast-check', () => {
  it('soma é comutativa para quaisquer dois inteiros', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        return a + b === b + a;
      }),
      { numRuns: 100 },
    );
  });
});
