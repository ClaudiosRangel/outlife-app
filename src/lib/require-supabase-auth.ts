/**
 * Helper server-only para validar o header `Authorization: Bearer <token>`
 * de uma `Request` contra o Supabase Auth, usado pelos endpoints HTTP do
 * proxy remoto do Google Places (`src/routes/api.places.search.ts`,
 * `api.places.photos.ts`, task 13.2) e dos endpoints de registro de push
 * (task 12.5) — ambos chamados pelo SPA_Build_Target/Outlife_Native_Shell,
 * que não tem acesso à sessão via cookie como o SSR_Build_Target
 * (Requirement 12.4).
 *
 * Usa `supabaseAdmin` (service role, bypassa RLS) apenas para validar o
 * token via `auth.getUser(token)` — nunca para consultas de dados de
 * usuário além disso.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Erro tipado lançado quando o header de autorização está ausente ou o
 * token é inválido/expirado. Os chamadores (endpoints HTTP) devem capturar
 * esse erro e responder com HTTP 401.
 */
export class UnauthorizedRequestError extends Error {
  readonly status = 401;

  constructor(message = "Não autenticado.") {
    super(message);
    this.name = "UnauthorizedRequestError";
  }
}

/**
 * Valida o header `Authorization: Bearer <token>` de `request` contra o
 * Supabase Auth. Retorna o usuário autenticado em caso de sucesso.
 *
 * Lança `UnauthorizedRequestError` (a ser tratado como HTTP 401 pelo
 * chamador) quando o header está ausente, malformado, ou o token é
 * inválido/expirado.
 */
export async function requireSupabaseAuthFromRequest(request: Request) {
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!authHeader) {
    throw new UnauthorizedRequestError("Cabeçalho Authorization ausente.");
  }

  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!match) {
    throw new UnauthorizedRequestError("Cabeçalho Authorization malformado (esperado 'Bearer <token>').");
  }
  const token = match[1];

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    throw new UnauthorizedRequestError("Token inválido ou expirado.");
  }

  return data.user;
}
