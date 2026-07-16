import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Teste E2E de submissão de avaliação (task 18.3 do spec
 * outlife-production-plan).
 *
 * Autossuficiente: cria um usuário de teste dedicado via Supabase Admin API
 * (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, mesmo padrão já usado em
 * `tests/e2e/login.spec.ts`) em `test.beforeAll`, evitando depender de
 * credenciais de usuários pré-existentes cuja senha não está documentada
 * em texto claro em nenhum lugar do repositório.
 *
 * Avalia o parceiro "Rafa Trilhas" (UUID fixo `22222222-2222-2222-2222-222222222201`
 * do Seed_Dataset em `scripts/seed.ts`), sempre presente no
 * Production_Supabase_Project por ser gravado via `upsert(..., { onConflict: "id" })`.
 * Isso evita depender de busca/navegação — o teste vai direto para
 * `/parceiro/{PARTNER_ID}`.
 *
 * Preenche rating (5 estrelas) + comentário via UI real na seção "Deixar
 * avaliação" de `src/routes/parceiro.$partnerId.tsx` (componente inline
 * `LeaveReview`, distinto do `ReviewPromptDialog` usado para destinos) e
 * submete, o que aciona `submitReview` (`src/lib/api.ts`) contra o
 * Production_Supabase_Project real. Comentário com conteúdo e sem foto
 * resulta em XP = 30, conforme a tabela de regras da Property 2 do
 * design.md (`src/lib/review-xp.ts` / trigger `award_review_xp`).
 *
 * Valida o Requirement 10.2/10.3 de duas formas complementares:
 *   (a) smoke check de UI: o toast de sucesso exibe "+30 XP";
 *   (b) verificação server-side (principal, mais forte): consulta direta à
 *       tabela `reviews` via client Supabase admin, confirmando que a
 *       avaliação foi persistida com o rating, comentário e xp_awarded
 *       corretos.
 *
 * Cleanup: o usuário de teste é removido em `test.afterAll` via
 * `supabase.auth.admin.deleteUser` (best-effort, mesma decisão documentada
 * em `tests/e2e/login.spec.ts`). A linha de `reviews` criada durante o
 * teste NÃO é removida: não há FK de `reviews.author_id` para `auth.users`
 * (ver `supabase/migrations/20260521193007_*.sql`, nota sobre omissão
 * intencional dessa FK), então `deleteUser` não faz cascade sobre ela; e
 * como não há constraint de unicidade envolvendo `(author_id, partner_id)`,
 * reviews de teste acumuladas não quebram execuções futuras deste teste
 * nem alteram o comportamento validado. Manter essa review real também
 * documenta, no próprio banco, a evidência de que o fluxo funcionou.
 *
 * Requirements: 10.2, 10.3
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TEST_PASSWORD = "OutlifeE2EReview123!";

// UUID fixo do parceiro "Rafa Trilhas" (Seed_Dataset, scripts/seed.ts),
// sempre presente no Production_Supabase_Project.
const PARTNER_ID = "22222222-2222-2222-2222-222222222201";

function uniqueEmail(): string {
  return `outlife.e2e.review.${Date.now()}.${Math.floor(Math.random() * 1e6)}@gmail.com`;
}

test.describe("Submissão de avaliação (E2E)", () => {
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
        full_name: "Teste E2E Avaliação",
      },
    });

    if (error || !data.user) {
      throw new Error(`[e2e/submit-review] Falha ao criar usuário de teste via Admin API: ${error?.message}`);
    }

    testUserId = data.user.id;
  });

  test.afterAll(async () => {
    if (!supabaseAdmin || !testUserId) return;

    const { error } = await supabaseAdmin.auth.admin.deleteUser(testUserId);
    if (error) {
      // Best-effort: não falha a suíte por não conseguir limpar o usuário
      // de teste (ver decisão documentada no comentário do arquivo).
      console.warn(`[e2e/submit-review] Falha ao remover usuário de teste ${testUserId}: ${error.message}`);
    }
  });

  test("rating + comentário → avaliação persistida e XP refletido na UI", async ({ page }) => {
    await page.goto("/login");
    // Aguarda a hidratação do componente de login (TanStack Router faz
    // code-split de `login.tsx`; sem esperar a rede ociosa, o clique no
    // botão pode ocorrer antes do handler `onSubmit` (React) estar
    // anexado, disparando o submit nativo do <form> (GET para "/login?")
    // em vez de `supabase.auth.signInWithPassword`.
    await page.waitForLoadState("networkidle");
    await page.locator("#email").fill(testEmail);
    await page.locator("#password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /entrar/i }).click();
    await page.waitForURL(/\/perfil$/, { timeout: 15_000 });

    await page.goto(`/parceiro/${PARTNER_ID}`);
    await expect(page.getByRole("heading", { name: /rafa trilhas/i })).toBeVisible({ timeout: 15_000 });

    const commentText = `Experiência incrível, recomendo! ${Date.now()}`;

    await page.getByRole("button", { name: "5 estrelas" }).click();
    await page.getByPlaceholder(/Escreva seu comentário/i).fill(commentText);
    await page.getByRole("button", { name: "Enviar avaliação" }).click();

    // Comentário válido + sem foto -> XP = 30 (Property 2 do design.md).
    await expect(page.getByText(/Avaliação enviada!.*\+30 XP/i)).toBeVisible({ timeout: 15_000 });

    // Verificação server-side (principal): avaliação persistida com rating,
    // comentário e xp_awarded corretos.
    const { data: review, error: reviewError } = await supabaseAdmin
      .from("reviews")
      .select("rating, comment, xp_awarded, author_id, partner_id")
      .eq("author_id", testUserId!)
      .eq("partner_id", PARTNER_ID)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    expect(reviewError).toBeNull();
    expect(Number(review?.rating)).toBe(5);
    expect(review?.comment).toBe(commentText);
    expect(review?.xp_awarded).toBe(30);
  });
});
