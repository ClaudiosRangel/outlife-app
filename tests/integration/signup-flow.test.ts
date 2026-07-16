import { describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/**
 * Teste de integração do fluxo de cadastro (task 10.4 do spec
 * outlife-production-plan).
 *
 * Conecta no Production_Supabase_Project real (via SUPABASE_URL +
 * SUPABASE_PUBLISHABLE_KEY, mesmas variáveis usadas por
 * `src/integrations/supabase/client.ts`) e confirma que, após
 * `supabase.auth.signUp`, o trigger `handle_new_user` cria em `profiles`
 * um registro com `full_name` não vazio e `role` válido — para 2 variações
 * de metadata (aventureiro e parceiro).
 *
 * Usa e-mails com domínio `@gmail.com` (não `@example.com`, que é
 * rejeitado pelo validador de e-mail do Supabase Auth) com sufixo de
 * timestamp para garantir unicidade entre execuções e não colidir com
 * usuários de teste anteriores.
 *
 * Este teste é pulado automaticamente quando SUPABASE_URL ou
 * SUPABASE_PUBLISHABLE_KEY não estão definidas (ex.: CI sem acesso ao
 * projeto real), mesmo padrão de `describe.skipIf` já usado em
 * `tests/migration/schema-objects.test.ts` e `tests/storage-buckets.test.ts`.
 *
 * Requirements: 2.1
 */

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

const TEST_PASSWORD = 'TesteIntegracao123!';

function uniqueEmail(prefix: string): string {
  return `outlife.${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@gmail.com`;
}

describe.skipIf(!supabaseUrl || !supabasePublishableKey)(
  'fluxo de cadastro contra o Production_Supabase_Project (trigger handle_new_user)',
  () => {
    const supabase = createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    it('cria profile com full_name não vazio e role "adventurer" para metadata de aventureiro', async () => {
      const email = uniqueEmail('adventurer');
      const fullName = `Teste Integração Aventureiro ${Date.now()}`;

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: TEST_PASSWORD,
        options: {
          data: {
            role: 'adventurer',
            full_name: fullName,
          },
        },
      });

      expect(signUpError).toBeNull();
      expect(signUpData.user?.id).toBeTruthy();

      const userId = signUpData.user!.id;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', userId)
        .single();

      expect(profileError).toBeNull();
      expect(profile?.full_name).toBeTruthy();
      expect(profile?.full_name?.length).toBeGreaterThan(0);
      expect(profile?.role).toBe('adventurer');
    });

    it('cria profile com full_name não vazio e role "partner" para metadata de parceiro', async () => {
      const email = uniqueEmail('partner');
      const fullName = `Teste Integração Parceiro ${Date.now()}`;

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: TEST_PASSWORD,
        options: {
          data: {
            role: 'partner',
            full_name: fullName,
            category: 'Guias',
          },
        },
      });

      expect(signUpError).toBeNull();
      expect(signUpData.user?.id).toBeTruthy();

      const userId = signUpData.user!.id;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', userId)
        .single();

      expect(profileError).toBeNull();
      expect(profile?.full_name).toBeTruthy();
      expect(profile?.full_name?.length).toBeGreaterThan(0);
      expect(profile?.role).toBe('partner');
    });
  },
);
