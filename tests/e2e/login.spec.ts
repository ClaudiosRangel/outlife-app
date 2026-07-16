import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Teste E2E de login (task 18.2 do spec outlife-production-plan).
 *
 * Autossuficiente: cria um usuário de teste dedicado via Supabase Admin API
 * (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, mesmo par de env vars usado por
 * `scripts/seed.ts` e `src/integrations/supabase/client.server.ts`) com
 * e-mail único e senha conhecida em `test.beforeAll`, em vez de depender de
 * credenciais de usuários de teste pré-existentes (`teste.aventureiro@...`,
 * `teste.parceiro@...`) cuja senha não está documentada em texto claro em
 * nenhum lugar do repositório (ver `docs/migration-log.md`, task 11 da
 * migração — apenas o e-mail e o fato de terem sido criados via Admin API
 * estão registrados, nunca a senha).
 *
 * Essa abordagem evita duas armadilhas de um teste E2E dependente de estado
 * externo: (1) a senha ficaria indisponível para o teste automatizado, e
 * (2) mesmo que estivesse, o teste ficaria acoplado a um registro mutável
 * do Production_Supabase_Project (alguém pode trocar a senha, desativar o
 * usuário, etc.), tornando o teste frágil.
 *
 * Cleanup: o usuário criado é removido em `test.afterAll` via
 * `supabase.auth.admin.deleteUser`, para não acumular usuários de teste no
 * Production_Supabase_Project a cada execução. Decisão tomada: a limpeza é
 * feita best-effort (loga um aviso em caso de falha, mas não derruba a
 * suíte) — não é crítica ao propósito do teste (validar o fluxo de login)
 * e a complexidade de um mecanismo de retry/garantia adicional não se
 * justifica aqui.
 *
 * Requirements: 10.2, 10.3
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TEST_PASSWORD = "OutlifeE2ELogin123!";

function uniqueEmail(): string {
  return `outlife.e2e.login.${Date.now()}.${Math.floor(Math.random() * 1e6)}@gmail.com`;
}

test.describe("Login (E2E)", () => {
  test.skip(
    !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY,
    "Requer SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY definidas (.env na raiz do projeto) para criar o usuário de teste via Admin API.",
  );

  let supabaseAdmin: SupabaseClient;
  let testEmail: string;
  let testUserId: string | undefined;

  test.beforeAll(async () => {
    supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    testEmail = uniqueEmail();

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        role: "adventurer",
        full_name: "Teste E2E Login",
      },
    });

    if (error || !data.user) {
      throw new Error(`[e2e/login] Falha ao criar usuário de teste via Admin API: ${error?.message}`);
    }

    testUserId = data.user.id;
  });

  test.afterAll(async () => {
    if (!supabaseAdmin || !testUserId) return;

    const { error } = await supabaseAdmin.auth.admin.deleteUser(testUserId);
    if (error) {
      // Best-effort: não falha a suíte por não conseguir limpar o usuário
      // de teste (ver decisão documentada no comentário do arquivo).
      console.warn(`[e2e/login] Falha ao remover usuário de teste ${testUserId}: ${error.message}`);
    }
  });

  test("login com usuário existente redireciona para /perfil", async ({ page }) => {
    await page.goto("/login");

    await page.locator("#email").fill(testEmail);
    await page.locator("#password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /entrar/i }).click();

    await page.waitForURL(/\/perfil$/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/perfil$/);
  });
});
