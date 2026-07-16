import { describe, it, expect, vi, type Mock } from 'vitest';
import fc from 'fast-check';

// Mock do client Supabase antes de importar `api.ts`, para interceptar a
// cadeia `.from('destinations').select('*').eq('status', 'approved').order(...)`
// exatamente como usada por `fetchDestinations` em src/lib/api.ts.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '@/integrations/supabase/client';
import { fetchDestinations } from '@/lib/api';

/**
 * Task 10.1 do spec outlife-production-plan.
 *
 * `fetchDestinations` já filtra por `status = 'approved'` no código atual
 * (src/lib/api.ts). Este teste apenas confirma esse comportamento já
 * implementado, sem alterar nada na implementação.
 */

type DestinationRow = {
  id: string;
  name: string;
  status: 'approved' | 'pending' | 'rejected';
  created_by: string;
  region: string | null;
  difficulty: string | null;
  main_image_url: string | null;
  rating: number | null;
  distance: string | null;
  elevation: string | null;
  duration: string | null;
  type: string | null;
  trail_type: string | null;
};

/**
 * Configura o mock do client Supabase para uma execução da property:
 * `.from('destinations').select('*').eq('status', 'approved').order(...)`
 * resolve, sem erro, com as linhas de `allRows` cujo `status === 'approved'`,
 * replicando a semântica real do `.eq()` do Postgres/Supabase.
 */
function setupSupabaseMock(allRows: DestinationRow[]) {
  (supabase.from as Mock).mockImplementation((table: string) => {
    expect(table).toBe('destinations');
    return {
      select: (columns: string) => {
        expect(columns).toBe('*');
        return {
          eq: (column: string, value: string) => {
            expect(column).toBe('status');
            expect(value).toBe('approved');
            const filtered = allRows.filter((r) => r.status === value);
            return {
              order: () => Promise.resolve({ data: filtered, error: null }),
            };
          },
        };
      },
    };
  });
}

const statusArbitrary = fc.constantFrom<'approved' | 'pending' | 'rejected'>(
  'approved',
  'pending',
  'rejected',
);

const destinationRowArbitrary: fc.Arbitrary<DestinationRow> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  status: statusArbitrary,
  created_by: fc.uuid(),
  region: fc.option(fc.string({ maxLength: 20 }), { nil: null }),
  difficulty: fc.option(fc.constantFrom('facil', 'moderado', 'dificil'), { nil: null }),
  main_image_url: fc.constant(null),
  rating: fc.option(fc.integer({ min: 0, max: 5 }), { nil: null }),
  distance: fc.option(fc.string({ maxLength: 10 }), { nil: null }),
  elevation: fc.option(fc.string({ maxLength: 10 }), { nil: null }),
  duration: fc.option(fc.string({ maxLength: 10 }), { nil: null }),
  type: fc.option(fc.string({ maxLength: 10 }), { nil: null }),
  trail_type: fc.option(fc.string({ maxLength: 10 }), { nil: null }),
});

describe('fetchDestinations', () => {
  it(
    // Feature: outlife-production-plan, Property 1: Filtro de destinos por status approved
    'retorna exclusivamente destinos com status approved, independentemente de quantos pending/rejected existirem',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(destinationRowArbitrary, { minLength: 0, maxLength: 15 }),
          async (allRows) => {
            setupSupabaseMock(allRows);

            const result = await fetchDestinations();

            const approvedIds = new Set(
              allRows.filter((r) => r.status === 'approved').map((r) => r.id),
            );

            // O resultado nunca contém um destino com status != 'approved'.
            for (const destination of result) {
              expect(approvedIds.has(destination.id)).toBe(true);
            }

            // Reflete exatamente a quantidade de destinos approved gerados.
            expect(result).toHaveLength(approvedIds.size);
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
