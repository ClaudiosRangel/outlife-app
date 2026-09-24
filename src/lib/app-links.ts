// Links públicos do app usados em convites/compartilhamento. Centralizado
// para facilitar troca única quando houver domínio próprio / links da loja.

/** Domínio público de produção (mesma base usada nos redirects de auth). */
export const PUBLIC_APP_ORIGIN = "https://outlife-app.vercel.app";

/**
 * URL para onde o convidado (que ainda não tem o app) é levado: a tela de
 * cadastro, que já sabe capturar `?ref=CODIGO`. Quando houver link direto da
 * Play Store / App Store, trocar aqui num único ponto.
 */
export const APP_INSTALL_URL = `${PUBLIC_APP_ORIGIN}/cadastro`;
