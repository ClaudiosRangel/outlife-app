import { describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/**
 * Smoke test de acessibilidade dos buckets de storage (task 3.4 do spec
 * outlife-production-plan).
 *
 * Conecta no Production_Supabase_Project (via SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY, mesmas variáveis usadas por
 * `src/integrations/supabase/client.server.ts` e `scripts/seed.ts`) e
 * confirma, através da API de Storage do `supabase-js`, que os buckets
 * `review-photos` e `partner-gallery` existem e são acessíveis.
 *
 * Este teste é pulado automaticamente quando SUPABASE_URL ou
 * SUPABASE_SERVICE_ROLE_KEY não estão definidas (ex.: CI sem acesso ao
 * projeto real), para não quebrar `npm test` em ambientes sem essas
 * credenciais — mesmo padrão de `describe.skipIf` já usado em
 * `tests/migration/schema-objects.test.ts`.
 *
 * Requirements: 1.4
 */

const EXPECTED_BUCKETS = ['review-photos', 'partner-gallery'];

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!supabaseUrl || !supabaseServiceRoleKey)(
  'acessibilidade dos buckets de storage no Production_Supabase_Project',
  () => {
    const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceRoleKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    it('lista ambos os buckets esperados via listBuckets()', async () => {
      const { data, error } = await supabaseAdmin.storage.listBuckets();

      expect(error).toBeNull();
      const bucketIds = (data ?? []).map((bucket) => bucket.id);
      for (const expected of EXPECTED_BUCKETS) {
        expect(bucketIds, `bucket ${expected} deve estar presente`).toContain(expected);
      }
    });

    it.each(EXPECTED_BUCKETS)('retorna o bucket %s sem erro via getBucket()', async (bucketId) => {
      const { data, error } = await supabaseAdmin.storage.getBucket(bucketId);

      expect(error).toBeNull();
      expect(data?.id).toBe(bucketId);
    });
  },
);
