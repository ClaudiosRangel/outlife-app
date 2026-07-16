/**
 * Lógica pura de cálculo de XP de avaliação (Requirement 2.3).
 *
 * Espelha fielmente a lógica SQL do trigger `public.award_review_xp`
 * (migration `supabase/migrations/20260525185054_ec235c23-70f1-4c79-a6df-aa8c1d46b98f.sql`):
 *
 *   DECLARE
 *     award integer := 10;
 *   BEGIN
 *     IF NEW.comment IS NOT NULL AND length(btrim(NEW.comment)) > 0 THEN
 *       award := 30;
 *       IF NEW.image_url IS NOT NULL AND length(btrim(NEW.image_url)) > 0 THEN
 *         award := 50;
 *       END IF;
 *     END IF;
 *     NEW.xp_awarded := award;
 *
 * Ou seja: um comentário só é considerado "válido" quando não é `NULL` e,
 * após `btrim` (remoção de espaços em branco nas duas pontas, equivalente a
 * `.trim()` em TypeScript), tem comprimento maior que zero — uma string
 * vazia ou composta só de espaços NÃO conta como comentário válido. A mesma
 * regra de "válido" (não nulo, não vazio após trim) se aplica a `image_url`,
 * mas a foto só é considerada quando o comentário já é válido (uma foto sem
 * comentário válido não eleva o XP para 50, o trigger nunca chega a checar
 * a foto nesse caso).
 *
 * Esta função não acessa o banco de dados — é usada para testar a DECISÃO
 * em isolamento (ver tests/property/review-xp.property.test.ts). Não há
 * Docker/Postgres local disponível neste ambiente para rodar o trigger SQL
 * real; a validação da execução real do trigger permanece pendente para um
 * ambiente com Docker disponível (mesma limitação já registrada em
 * `src/lib/rate-limiter.ts` para a Property 13).
 *
 * @param comment Comentário da avaliação (`NEW.comment`), ou `null`/`undefined`
 *   quando não informado.
 * @param imageUrl URL da foto da avaliação (`NEW.image_url`), ou `null`/`undefined`
 *   quando não informada.
 * @returns O XP a ser concedido (`xp_awarded`): 10, 30 ou 50.
 */
export function calculateReviewXp(
  comment: string | null | undefined,
  imageUrl: string | null | undefined,
): number {
  const hasValidComment = comment != null && comment.trim().length > 0;

  if (!hasValidComment) {
    return 10;
  }

  const hasValidImage = imageUrl != null && imageUrl.trim().length > 0;

  if (hasValidImage) {
    return 50;
  }

  return 30;
}
