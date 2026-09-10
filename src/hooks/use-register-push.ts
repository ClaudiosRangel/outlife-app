/**
 * Hook que dispara o registro de Push_Notification (Native_Push_Token via
 * FCM/APNs dentro do shell Capacitor, ou Web_Push_Subscription no navegador)
 * assim que há um usuário autenticado.
 *
 * Por que existe: `registerPushForCurrentPlatform()` (em push-registration.ts)
 * é o ponto de entrada do registro, mas não era chamado em lugar nenhum — por
 * isso a tabela `native_push_tokens` ficava vazia e NENHUM push era entregue.
 * Este hook conecta esse ponto de entrada ao ciclo de vida da autenticação.
 *
 * Regras:
 * - Só registra com usuário logado (o endpoint associa o token ao usuário
 *   autenticado via Authorization).
 * - Registra uma única vez por sessão de usuário (evita re-solicitar permissão
 *   e re-upsertar a cada render/navegação).
 * - Nunca lança: falha de permissão/rede é silenciosa (não quebra o app).
 */
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { registerPushForCurrentPlatform } from "@/lib/push-registration";

export function useRegisterPush(): void {
  const { user } = useAuth();
  const registeredForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // Já registrou para este usuário nesta sessão? Não repete.
    if (registeredForUserRef.current === user.id) return;
    registeredForUserRef.current = user.id;

    registerPushForCurrentPlatform().catch((err) => {
      if (import.meta.env?.DEV) {
        console.warn("[useRegisterPush] registro de push falhou:", err);
      }
    });
  }, [user]);
}
