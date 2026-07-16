import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Teste E2E de cadastro de novo usuário (task 18.1 do spec
 * outlife-production-plan).
 *
 * Executa contra uma instância real da OutLife_Application (por padrão o
 * servidor de desenvolvimento local em http://localhost:3000, iniciado
 * automaticamente pela seção `webServer` do playwright.config.ts; pode ser
 * redirecionado para outra instância via `E2E_BASE_URL`).
 *
 * Preenche o formulário de cadastro (perfil "adventurer"), submete via UI
 * real (o que aciona `supabase.auth.signUp` contra o Production_Supabase_Project
 * real — não há banco de teste local disponível neste projeto, conforme já
 * documentado em outras partes deste spec) e valida o Requirement 10.2/10.3
 * de duas formas complementares:
 *
 *   (a) smoke check de UI: o toast de sucesso do cadastro aparece na tela
 *       (o Production_Supabase_Project exige confirmação de e-mail, então
 *       nenhuma sessão é estabelecida no signUp; a navegação para `/perfil`
 *       feita pelo app acaba redirecionando para `/login` pela guarda de
 *       autenticação, então o toast é o smoke check de UI confiável aqui);
 *   (b) verificação server-side (principal, mais forte): consulta direta à
 *       tabela `profiles` via client Supabase admin (`SUPABASE_SERVICE_ROLE_KEY`),
 *       confirmando que o trigger `handle_new_user` criou o profile com
 *       `full_name` não vazio e `role` igual a "adventurer".
 *
 * Usa um e-mail único por execução (timestamp + random) para nunca colidir
 * com "User already registered" em execuções repetidas. Isso significa que
 * cada execução deste teste cria um usuário real no Production_Supabase_Project.
 *
 * Requirements: 10.2, 10.3
 */

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.skip(
  !supabaseUrl || !supabaseServiceRoleKey,
  "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configuradas — verificação server-side do profile não pode ser executada.",
);

function uniqueEmail(): string {
  return `outlife.e2e.signup.${Date.now()}.${Math.floor(Math.random() * 1e6)}@gmail.com`;
}

test("cadastro de novo usuário (adventurer) cria profile com full_name e role válidos", async ({ page }) => {
  const email = uniqueEmail();
  const fullName = `Teste E2E Aventureiro ${Date.now()}`;
  const password = "TesteE2ESignup123!";

  await page.goto("/cadastro");

  // A app usa SSR (TanStack Start) — um clique disparado antes da hidratação
  // React anexar o handler pode ser um no-op silencioso. Reclica até o campo
  // `#name` (que só é renderizado depois que `setRole("adventurer")` de fato
  // executa) ficar visível.
  await expect(async () => {
    await page.getByTestId("role-adventurer").click();
    await expect(page.locator("#name")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });

  await page.locator("#name").fill(fullName);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);

  await page.getByTestId("signup-submit").click();

  // (a) smoke check de UI: toast de sucesso do cadastro aparece.
  //
  // Observação: o Production_Supabase_Project exige confirmação de e-mail,
  // então `supabase.auth.signUp` não estabelece sessão imediatamente. O app
  // navega para `/perfil` mesmo assim (linha `navigate({ to: "/perfil" })`
  // em `cadastro.tsx`), mas como não há sessão, `/perfil` redireciona de
  // volta para `/login` (guarda de autenticação em `use-auth.tsx`). Por
  // isso o smoke check de UI usado aqui é o toast de sucesso — feedback
  // imediato que não depende do estabelecimento de sessão — em vez de
  // aguardar o conteúdo da página `/perfil`.
  await expect(page.getByText(/Cadastro criado/i)).toBeVisible({ timeout: 15_000 });

  // (b) verificação server-side (principal): profile criado via trigger
  // `handle_new_user` com full_name não vazio e role válido.
  const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userList, error: userListError } = await supabaseAdmin.auth.admin.listUsers();
  expect(userListError).toBeNull();
  const createdUser = userList?.users.find((u) => u.email === email);
  expect(createdUser?.id).toBeTruthy();

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("full_name, role")
    .eq("id", createdUser!.id)
    .single();

  expect(profileError).toBeNull();
  expect(profile?.full_name).toBeTruthy();
  expect(profile?.full_name?.length).toBeGreaterThan(0);
  expect(["adventurer", "partner"]).toContain(profile?.role);
  expect(profile?.role).toBe("adventurer");
});
