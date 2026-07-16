import { describe, it } from 'vitest';
import fc from 'fast-check';
import { calculateReviewXp } from '../../src/lib/review-xp';

/**
 * Property test do cálculo de XP de avaliação (task 10.2 do spec
 * outlife-production-plan).
 *
 * IMPORTANTE: este teste valida a LÓGICA de decisão do trigger SQL,
 * extraída como função pura (`calculateReviewXp` em `src/lib/review-xp.ts`)
 * que espelha fielmente o corpo de `public.award_review_xp` (migration
 * `supabase/migrations/20260525185054_ec235c23-70f1-4c79-a6df-aa8c1d46b98f.sql`).
 * Não é um teste de integração contra a execução real do trigger no
 * Postgres — Docker não está disponível neste ambiente, o que impede rodar
 * o Supabase local necessário para testar o trigger real. A validação da
 * execução real permanece pendente para um ambiente com Docker disponível
 * (mesma limitação já registrada para a Property 13 em
 * tests/property/rate-limit.property.test.ts).
 */

// Comentário "inválido": null, vazio, ou composto só de espaços em branco.
const invalidCommentArb = fc.oneof(
  fc.constant(null),
  fc.constant(''),
  fc.constant('   '),
  fc.constant('\t\n  \t'),
);

// Comentário "válido": conteúdo real, com espaços em branco arbitrários nas
// pontas (o trim() deve remover essas pontas e ainda restar conteúdo).
const validCommentArb = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter((s) => s.trim().length > 0)
  .map((s) => `  ${s}  `);

// imageUrl "inválida": null, vazia, ou composta só de espaços.
const invalidImageUrlArb = fc.oneof(fc.constant(null), fc.constant(''), fc.constant('   '));

// imageUrl "válida": URL com conteúdo real.
const validImageUrlArb = fc
  .webUrl()
  .filter((s) => s.trim().length > 0);

describe('Cálculo de XP de avaliação — calculateReviewXp (lógica de decisão espelhada do trigger SQL)', () => {
  it('concede XP=10 quando não há comentário válido, independentemente da foto', () => {
    // Feature: outlife-production-plan, Property 2: Cálculo de XP de avaliação segue a tabela de regras
    fc.assert(
      fc.property(
        invalidCommentArb,
        fc.oneof(invalidImageUrlArb, validImageUrlArb),
        (comment, imageUrl) => {
          return calculateReviewXp(comment, imageUrl) === 10;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('concede XP=30 quando há comentário válido sem foto válida', () => {
    // Feature: outlife-production-plan, Property 2: Cálculo de XP de avaliação segue a tabela de regras
    fc.assert(
      fc.property(validCommentArb, invalidImageUrlArb, (comment, imageUrl) => {
        return calculateReviewXp(comment, imageUrl) === 30;
      }),
      { numRuns: 100 },
    );
  });

  it('concede XP=50 quando há comentário válido e foto válida', () => {
    // Feature: outlife-production-plan, Property 2: Cálculo de XP de avaliação segue a tabela de regras
    fc.assert(
      fc.property(validCommentArb, validImageUrlArb, (comment, imageUrl) => {
        return calculateReviewXp(comment, imageUrl) === 50;
      }),
      { numRuns: 100 },
    );
  });

  it('a tabela de regras é exaustiva: o XP é sempre exatamente 10, 30 ou 50 para qualquer combinação', () => {
    // Feature: outlife-production-plan, Property 2: Cálculo de XP de avaliação segue a tabela de regras
    const anyCommentArb = fc.oneof(invalidCommentArb, validCommentArb, fc.constant(undefined));
    const anyImageUrlArb = fc.oneof(invalidImageUrlArb, validImageUrlArb, fc.constant(undefined));

    fc.assert(
      fc.property(anyCommentArb, anyImageUrlArb, (comment, imageUrl) => {
        const xp = calculateReviewXp(comment, imageUrl);
        return xp === 10 || xp === 30 || xp === 50;
      }),
      { numRuns: 100 },
    );
  });
});
