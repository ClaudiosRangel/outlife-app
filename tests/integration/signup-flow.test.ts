import { afterEach, describe, expect, it } from 'vitest';
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
 * IMPORTANTE — limpeza dos dados de teste: este teste roda contra o
 * Production_Supabase_Project real (não um projeto de teste isolado), e as
 * contas criadas por `signUp` ficavam permanentemente visíveis no
 * marketplace público (`/marketplace`) e no perfil do usuário — 33 contas
 * de teste ("Teste Integração Parceiro ...") se acumularam em produção
 * antes desta correção, e precisaram ser removidas manualmente. Cada `it`
 * agora registra o `userId` criado em `createdUserIds` e `afterEach` faz a
 * limpeza via Auth Admin API (`SUPABASE_SERVICE_ROLE_KEY`, mesmo padrão de
 * `tests/e2e/signup.spec.ts`). Nota importante: `public.profiles.id`
 * NÃO tem FK `ON DELETE CASCADE` para `auth.users.id` (ver comentário em
 * `supabase/migrations/20260521193007_...sql`, decisão intencional para
 * permitir perfis de parceiro de demonstração/seed sem conta de auth
 * correspondente) — por isso excluir apenas via
 * `adminClient.auth.admin.deleteUser` NÃO remove o registro em
 * `public.profiles`, deixando-o órfão e ainda visível no marketplace
 * (causa raiz do acúmulo original). Por isso a limpeza aqui exclui
 * explicitamente as duas linhas: primeiro `public.profiles`, depois
 * `auth.users`. A limpeza é best-effort: uma falha ao excluir não derruba
 * o teste (que já terminou e teve seu resultado registrado), apenas é
 * logada no console para limpeza manual posterior se necessário.
 *
 * Requirements: 2.1
 */

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

    const createdUserIds: string[] = [];

    afterEach(async () => {
      if (createdUserIds.length === 0 || !supabaseServiceRoleKey) return;
      const adminClient = createClient(supabaseUrl!, supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      for (const userId of createdUserIds.splice(0)) {
        // `public.profiles.id` não tem ON DELETE CASCADE a partir de
        // `auth.users.id` (decisão intencional do schema, ver comentário
        // acima) — excluir o perfil explicitamente primeiro é obrigatório;
        // sem isso o registro fica órfão e continua visível no marketplace.
        const { error: profileError } = await adminClient.from('profiles').delete().eq('id', userId);
        if (profileError) {
          console.error(
            `[signup-flow.test.ts] Falha ao limpar profile de teste ${userId} do Production_Supabase_Project:`,
            profileError.message,
          );
        }
        const { error: userError } = await adminClient.auth.admin.deleteUser(userId);
        if (userError) {
          console.error(
            `[signup-flow.test.ts] Falha ao limpar usuário de teste ${userId} do Production_Supabase_Project:`,
            userError.message,
          );
        }
      }
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
      createdUserIds.push(userId);

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
      createdUserIds.push(userId);

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
