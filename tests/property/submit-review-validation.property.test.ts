import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

/**
 * Task 10.3 do spec outlife-production-plan.
 *
 * `submitReview` (src/lib/api.ts) já valida `!Number.isFinite(rating) ||
 * rating < 1 || rating > 5`, lançando erro antes de qualquer chamada ao
 * Supabase. Este teste apenas confirma esse comportamento já implementado:
 * ratings fora de [1, 5] devem ser rejeitados sem nenhuma escrita em
 * `reviews`, e ratings dentro de [1, 5] (incluindo decimais) devem
 * prosseguir normalmente até a chamada de `insert`.
 *
 * O client `@/integrations/supabase/client` é mockado (padrão já usado em
 * `user-data-functions.property.test.ts`), com `.auth.getUser()` resolvendo
 * um usuário autenticado válido e um spy no encadeamento
 * `.from('reviews').insert(...)` que registra se foi chamado.
 */

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      auth: { getUser: vi.fn() },
      from: vi.fn(),
    },
  };
});

import { supabase } from '@/integrations/supabase/client';
import { submitReview } from '@/lib/api';

const AUTH_USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function mockAuthenticatedUser() {
  vi.mocked(supabase.auth.getUser).mockResolvedValue({
    data: { user: { id: AUTH_USER_ID } as never },
    error: null,
  } as never);
}

/**
 * Configura o mock de `supabase.from('reviews')` espelhando a cadeia real
 * usada por `submitReview`: `.insert(row).select('xp_awarded').single()`.
 * Cada chamada de `insert` é registrada em `insertSpy`, permitindo ao teste
 * confirmar que ela NUNCA ocorre quando o rating é inválido.
 */
function mockReviewsInsert(insertSpy: ReturnType<typeof vi.fn>) {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table !== 'reviews') {
      throw new Error(`unexpected table in mock: ${table}`);
    }
    return {
      insert: (row: unknown) => {
        insertSpy(row);
        return {
          select: (_cols: string) => ({
            single: async () => ({ data: { xp_awarded: 5 }, error: null }),
          }),
        };
      },
    } as never;
  });
}

// Valores de rating fora do intervalo válido [1, 5]: negativos, zero, acima
// de 5, NaN, Infinity e -Infinity.
const invalidRatingArb = fc.oneof(
  fc.double({ min: -1000, max: 0.999999, noNaN: true }),
  fc.double({ min: 5.000001, max: 1000, noNaN: true }),
  fc.constant(0),
  fc.constant(NaN),
  fc.constant(Infinity),
  fc.constant(-Infinity),
);

// Valores de rating dentro do intervalo válido [1, 5], incluindo decimais.
const validRatingArb = fc.double({ min: 1, max: 5, noNaN: true, noDefaultInfinity: true });

describe('submitReview - validação do intervalo de rating', () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.getUser).mockReset();
    vi.mocked(supabase.from).mockReset();
  });

  it(
    // Feature: outlife-production-plan, Property 3: Rejeição de rating fora do intervalo válido
    'rejeita qualquer rating fora de [1, 5] sem executar nenhuma escrita em reviews',
    async () => {
      await fc.assert(
        fc.asyncProperty(invalidRatingArb, async (invalidRating) => {
          mockAuthenticatedUser();
          const insertSpy = vi.fn();
          mockReviewsInsert(insertSpy);

          await expect(
            submitReview('destination-id', 'destination', invalidRating, 'comentário'),
          ).rejects.toThrow();

          expect(insertSpy).not.toHaveBeenCalled();
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    // Feature: outlife-production-plan, Property 3: Rejeição de rating fora do intervalo válido
    'permite a submissão prosseguir normalmente para qualquer rating dentro de [1, 5]',
    async () => {
      await fc.assert(
        fc.asyncProperty(validRatingArb, async (validRating) => {
          mockAuthenticatedUser();
          const insertSpy = vi.fn();
          mockReviewsInsert(insertSpy);

          const result = await submitReview('destination-id', 'destination', validRating, 'comentário');

          expect(insertSpy).toHaveBeenCalledTimes(1);
          expect(result).toEqual({ ok: true, xp: 5 });
        }),
        { numRuns: 100 },
      );
    },
  );
});
