// Parsing puro de deep links do Outlife_Native_Shell (Capacitor) — a decisão
// de "URL recebida → destino de navegação interno" isolada do DOM/router para
// ser testável (Frente B, Req 7).
//
// O app é aberto por App Links (https://outlife-app.vercel.app/...),
// custom scheme (outlife://...) e intent (intent://...). Esta função decide,
// a partir da URL, para onde o router interno deve navegar — sem depender de
// servidor externo (Req 7.3). Casos:
// - Auth (contém access_token no hash/fragment) → NÃO é atividade (tratado à parte).
// - /a/<id>            → rota de preview de atividade "/a/$activityId".
// - /atividade/<id>    → rota de detalhe "/atividade/$activityId".
// - outlife://atividade/<id> (scheme/intent) → "/atividade/$activityId".
// - qualquer outro path conhecido → navega para o path.

export type DeepLinkTarget =
  | { kind: "activity-preview"; activityId: string }   // "/a/$activityId"
  | { kind: "activity-detail"; activityId: string }    // "/atividade/$activityId"
  | { kind: "auth"; fragment: string }                 // callback de auth (tokens)
  | { kind: "path"; path: string }                     // navega direto para o path
  | { kind: "none" };                                  // nada a fazer

/** Extrai o fragment (após '#') de uma URL, sem o '#'. */
function extractFragment(url: string): string {
  const hashIndex = url.indexOf("#");
  if (hashIndex < 0) return "";
  return url.slice(hashIndex + 1);
}

/**
 * Decide o destino de navegação a partir de uma URL de deep link. Função
 * pura: não navega, não toca no DOM, nunca lança.
 *
 * Prioridade:
 * 1. Auth: fragment com `access_token` → { kind: "auth" } (nunca vira atividade).
 * 2. `/a/<id>` → activity-preview.
 * 3. `/atividade/<id>` (ou scheme outlife://atividade/<id>) → activity-detail.
 * 4. outro path não-raiz → path.
 * 5. nada reconhecível → none.
 */
export function parseDeepLink(rawUrl: string): DeepLinkTarget {
  if (!rawUrl || typeof rawUrl !== "string") return { kind: "none" };

  const fragment = extractFragment(rawUrl);
  if (fragment && fragment.includes("access_token")) {
    return { kind: "auth", fragment };
  }

  // custom scheme / intent: outlife://atividade/<id>  (ou intent://atividade/<id>...)
  const schemeActivity = rawUrl.match(/^(?:outlife|intent):\/\/atividade\/([^/?#]+)/i);
  if (schemeActivity) {
    return { kind: "activity-detail", activityId: decodeURIComponent(schemeActivity[1]) };
  }

  // Extrai o pathname de forma robusta (funciona com https:// e sem depender de URL válida).
  let pathname = "";
  try {
    pathname = new URL(rawUrl).pathname;
  } catch {
    // Fallback: pega o que houver após o host em URLs malformadas.
    const m = rawUrl.match(/^[a-z]+:\/\/[^/]+(\/[^?#]*)/i);
    pathname = m ? m[1] : rawUrl.startsWith("/") ? rawUrl.split(/[?#]/)[0] : "";
  }

  const preview = pathname.match(/^\/a\/([^/?#]+)$/);
  if (preview) {
    return { kind: "activity-preview", activityId: decodeURIComponent(preview[1]) };
  }

  const detail = pathname.match(/^\/atividade\/([^/?#]+)$/);
  if (detail) {
    return { kind: "activity-detail", activityId: decodeURIComponent(detail[1]) };
  }

  if (pathname && pathname !== "/") {
    return { kind: "path", path: pathname };
  }

  return { kind: "none" };
}
