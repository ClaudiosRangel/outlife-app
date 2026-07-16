import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

/**
 * Arquivo compartilhado por múltiplas property tests da wave 7 do spec
 * outlife-production-plan (tasks 7.2, 7.4, 7.6, 7.8), cada uma cobrindo uma
 * das Mocked_Data_Function substituídas por dados reais em `src/lib/api.ts`.
 *
 * Docker/Postgres local não está disponível neste ambiente, então os testes
 * mockam o client `@/integrations/supabase/client` (via `vi.mock`) em vez de
 * rodar contra uma instância Supabase real, validando exatamente a mesma
 * cadeia de chamadas usada pela implementação (`.from(...).select(...).eq(...).order(...)`).
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
import { fetchFavoritePartners, type FavoritePartner } from '@/lib/api';

type MockFavoriteRow = {
  user_id: string;
  partner_id: string;
  partner: { id: string; full_name: string | null; category: string | null };
  created_at: string;
};

/**
 * Configura o mock de `supabase.from('favorite_partners')` para espelhar a
 * cadeia real usada por `fetchFavoritePartners`: `.select().eq().order()`.
 * O `.eq(col, val)` filtra `allRows` pelo campo correspondente, replicando o
 * comportamento de uma consulta real filtrada por `user_id = auth.uid()`.
 */
function mockFavoritePartnersFrom(allRows: MockFavoriteRow[]) {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table !== 'favorite_partners') {
      throw new Error(`unexpected table in mock: ${table}`);
    }
    return {
      select: (_cols: string) => ({
        eq: (col: string, val: string) => {
          const filtered = allRows.filter((row) => (row as Record<string, unknown>)[col] === val);
          return {
            order: (_orderCol: string, _opts: unknown) => Promise.resolve({ data: filtered, error: null }),
          };
        },
      }),
    } as never;
  });
}

function mockAuthUser(userId: string | null) {
  vi.mocked(supabase.auth.getUser).mockResolvedValue({
    data: { user: userId ? ({ id: userId } as never) : null },
    error: null,
  } as never);
}

function sortById(list: FavoritePartner[]): FavoritePartner[] {
  return [...list].sort((a, b) => a.id.localeCompare(b.id));
}

const favoriteRecordArb = fc.record({
  user_id: fc.uuid(),
  partner_id: fc.uuid(),
  full_name: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
  category: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  created_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }).map((d) => d.toISOString()),
});

// Cada registro é único por (user_id, partner_id), espelhando a constraint
// UNIQUE (user_id, partner_id) da tabela favorite_partners.
const favoriteRecordsArb = fc.uniqueArray(favoriteRecordArb, {
  selector: (r) => `${r.user_id}:${r.partner_id}`,
  maxLength: 12,
});

// Gera o conjunto de registros e, junto, o "usuário autenticado" do cenário:
// null (sem sessão), um userId presente nos registros (com favoritos), ou um
// userId fresco não presente em nenhum registro (usuário sem favoritos).
const scenarioArb = favoriteRecordsArb.chain((records) => {
  const userIdsWithFavorites = Array.from(new Set(records.map((r) => r.user_id)));
  const currentUserArb: fc.Arbitrary<string | null> = fc.oneof(
    { weight: 1, arbitrary: fc.constant(null) },
    { weight: 1, arbitrary: fc.uuid() },
    ...(userIdsWithFavorites.length > 0
      ? [{ weight: 2, arbitrary: fc.constantFrom(...userIdsWithFavorites) }]
      : []),
  );
  return fc.tuple(fc.constant(records), currentUserArb);
});

describe('fetchFavoritePartners', () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.getUser).mockReset();
    vi.mocked(supabase.from).mockReset();
  });

  it(
    // Feature: outlife-production-plan, Property 6: fetchFavoritePartners reflete exatamente os parceiros favoritados pelo usuário autenticado
    'retorna exatamente os parceiros favoritados pelo usuário autenticado, nunca incluindo favoritos de outro usuário',
    async () => {
      await fc.assert(
        fc.asyncProperty(scenarioArb, async ([records, currentUserId]) => {
          const rows: MockFavoriteRow[] = records.map((r) => ({
            user_id: r.user_id,
            partner_id: r.partner_id,
            partner: { id: r.partner_id, full_name: r.full_name, category: r.category },
            created_at: r.created_at,
          }));

          mockAuthUser(currentUserId);
          mockFavoritePartnersFrom(rows);

          const result = await fetchFavoritePartners();

          if (currentUserId === null) {
            // Sem sessão autenticada -> array vazio, sem consultar o banco.
            expect(result).toEqual([]);
            return;
          }

          const expected: FavoritePartner[] = records
            .filter((r) => r.user_id === currentUserId)
            .map((r) => ({
              id: r.partner_id,
              name: r.full_name ?? 'Parceiro',
              category: r.category ?? '',
            }));

          expect(sortById(result)).toEqual(sortById(expected));

          // Nenhum favorito de outro usuário deve aparecer no resultado.
          const otherUsersPartnerIds = new Set(
            records.filter((r) => r.user_id !== currentUserId).map((r) => r.partner_id),
          );
          const ownPartnerIds = new Set(expected.map((e) => e.id));
          for (const id of result.map((r) => r.id)) {
            if (otherUsersPartnerIds.has(id) && !ownPartnerIds.has(id)) {
              throw new Error(`resultado incluiu favorito de outro usuário: ${id}`);
            }
          }
        }),
        { numRuns: 100 },
      );
    },
  );
});

import { fetchSavedDestinations, type SavedDestination } from '@/lib/api';

type MockSavedDestinationRow = {
  user_id: string;
  destination_id: string;
  destination: { id: string; name: string | null; region: string | null } | null;
  created_at: string;
};

/**
 * Configura o mock de `supabase.from('saved_destinations')` para espelhar a
 * cadeia real usada por `fetchSavedDestinations`: `.select().eq().order()`.
 * O `.eq(col, val)` filtra `allRows` pelo campo correspondente, replicando o
 * comportamento de uma consulta real filtrada por `user_id = auth.uid()`.
 */
function mockSavedDestinationsFrom(allRows: MockSavedDestinationRow[]) {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table !== 'saved_destinations') {
      throw new Error(`unexpected table in mock: ${table}`);
    }
    return {
      select: (_cols: string) => ({
        eq: (col: string, val: string) => {
          const filtered = allRows.filter((row) => (row as Record<string, unknown>)[col] === val);
          return {
            order: (_orderCol: string, _opts: unknown) => Promise.resolve({ data: filtered, error: null }),
          };
        },
      }),
    } as never;
  });
}

function sortSavedDestinationsById(list: SavedDestination[]): SavedDestination[] {
  return [...list].sort((a, b) => a.id.localeCompare(b.id));
}

const savedDestinationRecordArb = fc.record({
  user_id: fc.uuid(),
  destination_id: fc.uuid(),
  name: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
  region: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  created_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }).map((d) => d.toISOString()),
});

// Cada registro é único por (user_id, destination_id), espelhando a
// constraint UNIQUE (user_id, destination_id) da tabela saved_destinations.
const savedDestinationRecordsArb = fc.uniqueArray(savedDestinationRecordArb, {
  selector: (r) => `${r.user_id}:${r.destination_id}`,
  maxLength: 12,
});

// Gera o conjunto de registros e, junto, o "usuário autenticado" do cenário:
// null (sem sessão), um userId presente nos registros (com destinos salvos),
// ou um userId fresco não presente em nenhum registro (usuário sem nenhum
// destino salvo).
const savedDestinationsScenarioArb = savedDestinationRecordsArb.chain((records) => {
  const userIdsWithSaved = Array.from(new Set(records.map((r) => r.user_id)));
  const currentUserArb: fc.Arbitrary<string | null> = fc.oneof(
    { weight: 1, arbitrary: fc.constant(null) },
    { weight: 1, arbitrary: fc.uuid() },
    ...(userIdsWithSaved.length > 0
      ? [{ weight: 2, arbitrary: fc.constantFrom(...userIdsWithSaved) }]
      : []),
  );
  return fc.tuple(fc.constant(records), currentUserArb);
});

describe('fetchSavedDestinations', () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.getUser).mockReset();
    vi.mocked(supabase.from).mockReset();
  });

  it(
    // Feature: outlife-production-plan, Property 5: fetchSavedDestinations reflete exatamente os destinos salvos pelo usuário autenticado
    'retorna exatamente os destinos salvos pelo usuário autenticado, nunca incluindo destinos salvos por outro usuário',
    async () => {
      await fc.assert(
        fc.asyncProperty(savedDestinationsScenarioArb, async ([records, currentUserId]) => {
          const rows: MockSavedDestinationRow[] = records.map((r) => ({
            user_id: r.user_id,
            destination_id: r.destination_id,
            destination: { id: r.destination_id, name: r.name, region: r.region },
            created_at: r.created_at,
          }));

          mockAuthUser(currentUserId);
          mockSavedDestinationsFrom(rows);

          const result = await fetchSavedDestinations();

          if (currentUserId === null) {
            // Sem sessão autenticada -> array vazio, sem consultar o banco.
            expect(result).toEqual([]);
            return;
          }

          const expected: SavedDestination[] = records
            .filter((r) => r.user_id === currentUserId)
            .map((r) => ({
              id: r.destination_id,
              name: r.name ?? 'Destino',
              region: r.region ?? '',
            }));

          expect(sortSavedDestinationsById(result)).toEqual(sortSavedDestinationsById(expected));

          // Nenhum destino salvo por outro usuário deve aparecer no resultado.
          const otherUsersDestinationIds = new Set(
            records.filter((r) => r.user_id !== currentUserId).map((r) => r.destination_id),
          );
          const ownDestinationIds = new Set(expected.map((e) => e.id));
          for (const id of result.map((r) => r.id)) {
            if (otherUsersDestinationIds.has(id) && !ownDestinationIds.has(id)) {
              throw new Error(`resultado incluiu destino salvo por outro usuário: ${id}`);
            }
          }
        }),
        { numRuns: 100 },
      );
    },
  );
});

// ============ Task 7.8 — Property 7: fetchNextAdventure ============

import { format as formatDateNextAdventure } from 'date-fns';
import { ptBR as ptBRNextAdventure } from 'date-fns/locale';
import { fetchNextAdventure } from '@/lib/api';

type MockActivityRow = {
  id: string;
  user_id: string;
  status: 'completed' | 'in_progress' | 'scheduled';
  start_time: string;
  destination: { name: string } | null;
};

/**
 * Configura o mock de `supabase.from('user_activities')` para espelhar a
 * cadeia real usada por `fetchNextAdventure`:
 * `.select().eq('user_id', ...).eq('status', 'scheduled').gt('start_time', now).order('start_time', {ascending:true}).limit(1).maybeSingle()`.
 *
 * O filtro `.gt(...)` e a ordenação/limite feita em `.order().limit()`
 * reproduzem a semântica real do Postgres (WHERE ... AND start_time > now
 * ORDER BY start_time ASC LIMIT 1), permitindo comparar o resultado com uma
 * expectativa calculada de forma independente em JS puro no próprio teste.
 */
function mockNextAdventureFrom(allRows: MockActivityRow[]) {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table !== 'user_activities') {
      throw new Error(`unexpected table in mock: ${table}`);
    }
    const eqFilters: Record<string, unknown> = {};
    let gtFilter: { col: string; val: string } | null = null;
    const builder = {
      select: (_cols: string) => builder,
      eq: (col: string, val: unknown) => {
        eqFilters[col] = val;
        return builder;
      },
      gt: (col: string, val: unknown) => {
        gtFilter = { col, val: val as string };
        return builder;
      },
      order: (orderCol: string, opts?: { ascending?: boolean }) => {
        const filtered = allRows.filter((row) => {
          const matchesEq = Object.entries(eqFilters).every(
            ([k, v]) => (row as Record<string, unknown>)[k] === v,
          );
          const matchesGt =
            !gtFilter || (row as Record<string, unknown>)[gtFilter.col] as string > gtFilter.val;
          return matchesEq && matchesGt;
        });
        const ascending = opts?.ascending !== false;
        const sorted = [...filtered].sort((a, b) => {
          const av = (a as Record<string, unknown>)[orderCol] as string;
          const bv = (b as Record<string, unknown>)[orderCol] as string;
          if (av === bv) return 0;
          const cmp = av < bv ? -1 : 1;
          return ascending ? cmp : -cmp;
        });
        return {
          limit: (n: number) => {
            const limited = sorted.slice(0, n);
            return {
              maybeSingle: async () => ({ data: limited[0] ?? null, error: null }),
            };
          },
        };
      },
    };
    return builder as never;
  });
}

// Offsets em minutos relativos ao "agora" capturado no teste, nunca
// próximos de zero (mínimo de 1 minuto), para que a diferença entre o
// "agora" do teste e o "agora" real usado dentro de `fetchNextAdventure`
// (capturado alguns milissegundos depois) nunca influencie se uma
// atividade é considerada passada ou futura.
const nonZeroOffsetMinutesArb = fc
  .integer({ min: -100000, max: 100000 })
  .filter((n) => n !== 0)
  .map((n) => (n === 0 ? 1 : n));

const nextAdventureRowTemplateArbitrary = fc.record({
  id: fc.uuid(),
  userIdIndex: fc.integer({ min: 0, max: 2 }),
  status: fc.constantFrom('completed', 'in_progress', 'scheduled') as fc.Arbitrary<
    'completed' | 'in_progress' | 'scheduled'
  >,
  offsetMinutes: nonZeroOffsetMinutesArb,
  destinationName: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
});

describe('fetchNextAdventure', () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.getUser).mockReset();
    vi.mocked(supabase.from).mockReset();
  });

  it(
    // Feature: outlife-production-plan, Property 7: fetchNextAdventure seleciona a atividade agendada futura mais próxima
    'retorna exatamente a atividade scheduled com o menor start_time estritamente futuro do usuário autenticado, ou null quando não houver (incluindo sem sessão)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(fc.uuid(), { minLength: 3, maxLength: 3 }),
          fc.boolean(),
          fc.array(nextAdventureRowTemplateArbitrary, { maxLength: 8 }),
          async (userIds, hasSession, rowTemplates) => {
            const [authUserId, otherUserId1, otherUserId2] = userIds;
            const ids = [authUserId, otherUserId1, otherUserId2];
            const now = new Date();

            const rows: MockActivityRow[] = rowTemplates.map((t) => ({
              id: t.id,
              user_id: ids[t.userIdIndex],
              status: t.status,
              start_time: new Date(now.getTime() + t.offsetMinutes * 60_000).toISOString(),
              destination: t.destinationName != null ? { name: t.destinationName } : null,
            }));

            mockAuthUser(hasSession ? authUserId : null);
            mockNextAdventureFrom(rows);

            const result = await fetchNextAdventure();

            if (!hasSession) {
              expect(result).toBeNull();
              return;
            }

            const scheduledFuture = rows.filter(
              (r) =>
                r.user_id === authUserId &&
                r.status === 'scheduled' &&
                new Date(r.start_time).getTime() > now.getTime(),
            );

            if (scheduledFuture.length === 0) {
              expect(result).toBeNull();
              return;
            }

            const closest = scheduledFuture.reduce((min, r) =>
              new Date(r.start_time).getTime() < new Date(min.start_time).getTime() ? r : min,
            );

            expect(result).toEqual({
              id: closest.id,
              title: closest.destination?.name ?? 'Próxima aventura',
              date: formatDateNextAdventure(new Date(closest.start_time), 'EEE · d MMM', {
                locale: ptBRNextAdventure,
              }),
              forecast: [],
            });
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
