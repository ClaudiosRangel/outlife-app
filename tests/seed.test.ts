import { describe, expect, it } from 'vitest';
import {
  DESTINATIONS,
  PARTNERS,
  VALID_PARTNER_CATEGORIES,
  BRAZIL_BOUNDS,
  assertSeedDataIsValid,
} from '../scripts/seed';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Testes de validação de exemplo do Seed_Script (task 3.2 do spec
 * outlife-production-plan).
 *
 * Requirements 1.2, 1.3:
 * - 1.3: os dados fixos do Seed_Script (DESTINATIONS/PARTNERS) devem ter
 *   coordenadas dentro do território brasileiro e categoria válida —
 *   validado abaixo por inspeção direta dos dados (vitest, não fast-check,
 *   pois são exemplos concretos e fixos, não um espaço de entrada gerado).
 * - 1.2: idempotência (rodar 2x contra um banco e comparar contagens, sem
 *   duplicação e sem erro) — a validação FUNCIONAL real já foi feita
 *   manualmente na task 3.1: o script (`npm run seed`) foi executado 2x
 *   seguidas contra o Production_Supabase_Project real
 *   (dxmbftbhmjjqtpjymakj), e a segunda execução não duplicou nenhum
 *   registro (contagens de `destinations`/`profiles`/`profile_contacts`
 *   idênticas antes/depois da 2ª rodada) nem retornou erro — confirmando o
 *   comportamento idempotente do `upsert(..., { onConflict: "id" })`.
 *   Essa validação não é reexecutada aqui dentro da suíte automatizada
 *   (`npm run test`) porque o projeto não tem Docker disponível para um
 *   Supabase local de teste, e reexecutar o script contra produção a cada
 *   `npm run test`/CI escreveria no banco real a cada execução — o que não
 *   é aceitável. Em vez disso, o teste abaixo garante estruturalmente que
 *   toda chamada de `upsert` no seed.ts usa `onConflict: "id"`, que é o
 *   mecanismo que torna a idempotência possível.
 */

describe('Seed_Script — validação de bounds e categoria (Requirement 1.3)', () => {
  it('assertSeedDataIsValid() não lança erro com os dados atuais', () => {
    expect(() => assertSeedDataIsValid()).not.toThrow();
  });

  it('todos os destinos têm latitude/longitude dentro do território brasileiro', () => {
    expect(DESTINATIONS.length).toBeGreaterThan(0);
    for (const d of DESTINATIONS) {
      expect(d.latitude, `latitude de "${d.name}"`).toBeGreaterThanOrEqual(BRAZIL_BOUNDS.minLat);
      expect(d.latitude, `latitude de "${d.name}"`).toBeLessThanOrEqual(BRAZIL_BOUNDS.maxLat);
      expect(d.longitude, `longitude de "${d.name}"`).toBeGreaterThanOrEqual(BRAZIL_BOUNDS.minLng);
      expect(d.longitude, `longitude de "${d.name}"`).toBeLessThanOrEqual(BRAZIL_BOUNDS.maxLng);
    }
  });

  it('todos os parceiros têm categoria dentro de VALID_PARTNER_CATEGORIES', () => {
    expect(PARTNERS.length).toBeGreaterThan(0);
    for (const p of PARTNERS) {
      expect(VALID_PARTNER_CATEGORIES, `categoria de "${p.full_name}"`).toContain(p.category);
    }
  });

  it('todos os IDs em DESTINATIONS e PARTNERS são únicos', () => {
    const allIds = [...DESTINATIONS.map((d) => d.id), ...PARTNERS.map((p) => p.id)];
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size, 'não deve haver ID duplicado entre DESTINATIONS e PARTNERS').toBe(
      allIds.length,
    );
  });
});

describe('Seed_Script — garantia estrutural de idempotência (Requirement 1.2)', () => {
  it('toda chamada de upsert no seed.ts usa onConflict: "id"', () => {
    const seedPath = fileURLToPath(new URL('../scripts/seed.ts', import.meta.url));
    const source = readFileSync(seedPath, 'utf-8');

    const upsertCalls = source.match(/\.upsert\(\s*[\s\S]*?\)/g) ?? [];
    expect(upsertCalls.length, 'seed.ts deve conter chamadas de upsert').toBeGreaterThan(0);

    for (const call of upsertCalls) {
      expect(call, `chamada de upsert deve incluir onConflict: "id" — trecho: ${call}`).toMatch(
        /onConflict:\s*"id"/,
      );
    }
  });
});
