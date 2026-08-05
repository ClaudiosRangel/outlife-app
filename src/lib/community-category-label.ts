// Mapeia categorias de publicações da comunidade para chaves de i18n.
//
// Observação: `src/lib/api.ts` já exporta seu próprio tipo
// `CommunityPostCategory` (usado na integração com a API/banco). Este
// arquivo não reexporta esse tipo para evitar declarações conflitantes -
// aqui trabalhamos apenas com os valores brutos (string) recebidos.

const KNOWN_CATEGORIES: readonly string[] = [
  "trilha",
  "camping",
  "relato",
  "outro",
  "pedalada",
  "caminhada",
];

/**
 * Retorna a chave de tradução (i18n) correspondente a uma categoria de
 * publicação da comunidade.
 *
 * Para os 6 valores conhecidos ("trilha", "camping", "relato", "outro",
 * "pedalada", "caminhada"), retorna `community.categories.<valor>`.
 * Para valores ausentes (null/undefined) ou desconhecidos, retorna
 * `community.categories.unspecified`.
 */
export function communityCategoryTranslationKey(
  category: string | null | undefined
): string {
  if (category && KNOWN_CATEGORIES.includes(category)) {
    return `community.categories.${category}`;
  }
  return "community.categories.unspecified";
}
