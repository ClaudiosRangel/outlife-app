import { describe, it, expect, vi, type Mock } from 'vitest';
import fc from 'fast-check';

// Mock do client Supabase antes de importar `api.ts`, para interceptar
// `auth.getUser()` e a cadeia `.from('achievement_records').select().eq().order()`
// exatamente como usada por `fetchUserAchievements` em src/lib/api.ts.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

import { supabase } from '@/integrations/supabase/client';
import { fetchUserAchievements } from '@/lib/api';

/**
 * Task 8.2 do spec outlife-production-plan.
 *
 * Mapa rule_code -> label duplicado intencionalmente a partir de
 * `ACHIEVEMENT_RULE_LABELS` (privado em src/lib/api.ts), para validar que
 * `fetchUserAchievements` mapeia corretamente `rule_code` para `label`
 * (incluindo o fallback para códigos desconhecidos, que retornam o próprio
 * rule_code como label).
 */
const ACHIEVEMENT_RULE_LABELS: Record<string, string> = {
  first_activity: 'Primeira Aventura',
  km_100: '100 km Percorridos',
  km_500: '500 km Percorridos',
  explorer: 'Explorador',
  top_reviewer: 'Avaliador Top',
};

type AchievementRecordRow = {
  id: string;
  user_id: string;
  rule_code: string;
  achieved_at: string;
};

/**
 * Configura o mock do client Supabase para uma execução da property:
 * - `auth.getUser()` resolve com sessão do `authUserId` (ou sem sessão);
 * - `.from('achievement_records').select(...).eq('user_id', X).order(...)`
 *   resolve, sem erro, com as linhas de `rows` cujo `user_id === X`,
 *   simulando o filtro real do Postgres/RLS.
 */
function setupSupabaseMock(rows: AchievementRecordRow[], authUserId: string | null) {
  (supabase.auth.getUser as Mock).mockResolvedValue({
    data: { user: authUserId ? { id: authUserId } : null },
    error: null,
  });

  (supabase.from as Mock).mockImplementation((table: string) => {
    expect(table).toBe('achievement_records');
    return {
      select: (columns: string) => {
        expect(columns).toBe('id, rule_code, achieved_at');
        return {
          eq: (column: string, value: string) => {
            expect(column).toBe('user_id');
            return {
              order: (orderColumn: string) => {
                expect(orderColumn).toBe('achieved_at');
                const filtered = rows.filter((r) => r.user_id === value);
                return Promise.resolve({ data: filtered, error: null });
              },
            };
          },
        };
      },
    };
  });
}

const ruleCodeArbitrary = fc.constantFrom(
  'first_activity',
  'km_100',
  'km_500',
  'explorer',
  'top_reviewer',
  'regra_desconhecida_x',
);

const isoDateArbitrary = fc
  .date({ min: new Date('2020-01-01T00:00:00.000Z'), max: new Date('2030-01-01T00:00:00.000Z') })
  .map((d) => d.toISOString());

/**
 * Gerador único que cobre os três cenários pedidos pela task 8.2:
 * - `authenticated = false` => sem sessão (espera `[]`);
 * - `authenticated = true` + nenhuma linha com `user_id === authUserId`
 *   (possível quando `rows` está vazio ou todas as linhas pertencem a
 *   outros usuários do pool) => zero registros próprios (espera `[]`);
 * - `authenticated = true` + linhas de múltiplos usuários misturadas,
 *   incluindo eventualmente linhas do próprio usuário autenticado
 *   (espera exatamente o subconjunto do usuário autenticado, mapeado).
 */
const scenarioArbitrary = fc
  .array(fc.uuid(), { minLength: 2, maxLength: 4 })
  .chain((userPool) => {
    const rowArbitrary: fc.Arbitrary<AchievementRecordRow> = fc.record({
      id: fc.uuid(),
      user_id: fc.constantFrom(...userPool),
      rule_code: ruleCodeArbitrary,
      achieved_at: isoDateArbitrary,
    });

    return fc.record({
      userPool: fc.constant(userPool),
      authenticated: fc.boolean(),
      authUserIndex: fc.integer({ min: 0, max: userPool.length - 1 }),
      rows: fc.array(rowArbitrary, { minLength: 0, maxLength: 8 }),
    });
  });

describe('fetchUserAchievements', () => {
  it(
    // Feature: outlife-production-plan, Property 9: fetchUserAchievements reflete exatamente os Achievement_Record do usuário autenticado
    'retorna exatamente os achievement_records do usuário autenticado, mapeados corretamente, nunca de outro usuário',
    async () => {
      await fc.assert(
        fc.asyncProperty(scenarioArbitrary, async ({ userPool, authenticated, authUserIndex, rows }) => {
          const authUserId = authenticated ? userPool[authUserIndex] : null;
          setupSupabaseMock(rows, authUserId);

          const result = await fetchUserAchievements();

          if (!authenticated) {
            expect(result).toEqual([]);
            return;
          }

          const expectedRows = rows.filter((r) => r.user_id === authUserId);
          const otherUsersRowIds = new Set(
            rows.filter((r) => r.user_id !== authUserId).map((r) => r.id),
          );

          // Nunca inclui registros de outro usuário.
          for (const achievement of result) {
            expect(otherUsersRowIds.has(achievement.id)).toBe(false);
          }

          // Reflete exatamente os registros do usuário autenticado (inclui
          // o caso trivial de zero registros próprios => resultado vazio).
          expect(result).toHaveLength(expectedRows.length);

          for (const row of expectedRows) {
            const mapped = result.find((a) => a.id === row.id);
            expect(mapped).toBeDefined();
            expect(mapped!.key).toBe(row.rule_code);
            expect(mapped!.achievedAt).toBe(row.achieved_at);
            expect(mapped!.label).toBe(ACHIEVEMENT_RULE_LABELS[row.rule_code] ?? row.rule_code);
          }
        }),
        { numRuns: 100 },
      );
    },
  );
});
