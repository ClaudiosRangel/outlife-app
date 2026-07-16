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
 * Task 8.3 do spec outlife-production-plan.
 *
 * Foca exclusivamente no caso "com sessão autenticada, mas erro na
 * consulta a achievement_records" — o caso "sem sessão" já é coberto
 * pela task 8.2 (tests/property/user-achievements.property.test.ts).
 *
 * Configura o mock do client Supabase para uma execução da property:
 * - `auth.getUser()` sempre resolve com um usuário autenticado válido;
 * - `.from('achievement_records').select(...).eq('user_id', X).order(...)`
 *   resolve com `{ data: null, error: <erro arbitrário> }`, simulando
 *   qualquer falha real de consulta (conexão, timeout, permissão,
 *   consulta malformada).
 */
function setupSupabaseErrorMock(authUserId: string, simulatedError: unknown) {
  (supabase.auth.getUser as Mock).mockResolvedValue({
    data: { user: { id: authUserId } },
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
            expect(value).toBe(authUserId);
            return {
              order: (orderColumn: string) => {
                expect(orderColumn).toBe('achieved_at');
                return Promise.resolve({ data: null, error: simulatedError });
              },
            };
          },
        };
      },
    };
  });
}

/**
 * Gerador de erros arbitrários retornados pelo client Supabase, cobrindo
 * mensagens/códigos livres que simulam erro de conexão, timeout, falha de
 * permissão e consulta malformada.
 */
const simulatedErrorArbitrary = fc.record({
  message: fc.string(),
  code: fc.oneof(
    fc.constantFrom(
      'ECONNRESET',
      'ETIMEDOUT',
      '57014', // query_canceled (timeout no Postgres)
      '42501', // insufficient_privilege
      '42601', // syntax_error (consulta malformada)
      'PGRST301',
    ),
    fc.string(),
  ),
  details: fc.option(fc.string(), { nil: undefined }),
  hint: fc.option(fc.string(), { nil: undefined }),
});

describe('fetchUserAchievements - propagação de erro', () => {
  it(
    // Feature: outlife-production-plan, Property 10: Falha na consulta de Achievement_Record é sempre propagada
    'sempre propaga (rejeita com) o erro original da consulta, nunca retornando um array que mascare a falha',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          simulatedErrorArbitrary,
          async (authUserId, simulatedError) => {
            setupSupabaseErrorMock(authUserId, simulatedError);

            await expect(fetchUserAchievements()).rejects.toBe(simulatedError);
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
