// Hook `useLiveActivityPublisher` — publicação da posição ao vivo durante o
// rastreamento de atividade (feature "Amigos em Atividade ao Vivo").
//
// Conecta o Activity_Tracker (`use-activity-tracker.ts`, fonte de `status`,
// `currentPos` e `permissionDenied`) ao canal de compartilhamento
// (`updateMyLocation` em `@/lib/api`), aplicando a decisão pura de publicação
// `shouldPublish` (`@/lib/live-publish`).
//
// Princípios (Requirements 2.1–2.6, 6.1, 6.2, 6.4, 5.5):
// - Reaproveita a posição já capturada pelo tracker (`currentPos`) — NÃO abre
//   um segundo `watchPosition`, evitando custo de bateria duplicado.
// - A decisão de publicar (autorização + throttle) permanece na função pura
//   `shouldPublish`; o hook apenas fornece o relógio (`Date.now()`) ao chamá-la.
// - O laço é um `setInterval` de `LIVE_PUBLISH_INTERVAL_MS` dentro de um
//   `useEffect`, recriado apenas quando `status`/`sharingMode` mudam. A última
//   posição e o instante da última publicação ficam em refs para não recriar o
//   timer a cada nova posição capturada.
// - Falha de obtenção (`currentPos == null`) ou erro de rede no
//   `updateMyLocation` apenas pula a janela: não sobrescreve dados válidos e
//   não interrompe a captura local do tracker (erro capturado/ignorado com log
//   leve).

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { updateMyLocation, type LocationSharingMode } from "@/lib/api";
import type { TrackerStatus, TrackPoint } from "@/hooks/use-activity-tracker";
import { shouldPublish, LIVE_PUBLISH_INTERVAL_MS } from "@/lib/live-publish";

export interface UseLiveActivityPublisherArgs {
  /** Status do Activity_Tracker (`use-activity-tracker`). */
  status: TrackerStatus;
  /** Última posição capturada pelo tracker (reaproveitada, sem novo watch). */
  currentPos: TrackPoint | null;
  /** Modo de compartilhamento de `profiles.location_sharing_mode`. */
  sharingMode: LocationSharingMode | undefined;
  /** Permissão de localização negada/revogada (exposta pelo tracker). */
  permissionDenied: boolean;
}

export interface UseLiveActivityPublisher {
  /** true enquanto autorizado e ativo (tracking + consentimento concedido). */
  isPublishing: boolean;
  /** epoch ms da última publicação bem-sucedida, ou null. */
  lastPublishedAt: number | null;
}

export function useLiveActivityPublisher(
  args: UseLiveActivityPublisherArgs,
): UseLiveActivityPublisher {
  const { status, currentPos, sharingMode, permissionDenied } = args;
  const queryClient = useQueryClient();

  const [lastPublishedAt, setLastPublishedAt] = useState<number | null>(null);

  // Refs para manter posição/último-instante acessíveis dentro do tick sem
  // recriar o timer a cada nova posição (o efeito só depende de
  // status/sharingMode). `lastPublishedAtRef` espelha o state para o cálculo
  // determinístico do throttle dentro do intervalo.
  const currentPosRef = useRef<TrackPoint | null>(currentPos);
  const lastPublishedAtRef = useRef<number | null>(lastPublishedAt);
  const publishingRef = useRef(false);

  useEffect(() => {
    currentPosRef.current = currentPos;
  }, [currentPos]);

  useEffect(() => {
    lastPublishedAtRef.current = lastPublishedAt;
  }, [lastPublishedAt]);

  // `isPublishing`: autorizado e ativo (tracking + consentimento concedido).
  // Independe de já ter havido publicação ou de ter posição no momento.
  const isPublishing = status === "tracking" && !!sharingMode && sharingMode !== "none";

  useEffect(() => {
    // Suspende em `paused` e em qualquer status != 'tracking' (Req 6.2), e
    // quando o consentimento não está concedido (mode 'none'/indefinido —
    // Req 2.2, 5.5). Sem consentimento/tracking o publisher fica inerte: não
    // obtém nem envia posição.
    if (status !== "tracking" || !sharingMode || sharingMode === "none") {
      publishingRef.current = false;
      return;
    }

    publishingRef.current = true;

    // Um único canal de publicação, reutilizável na primeira tentativa
    // imediata e nos ticks subsequentes.
    const tryPublish = () => {
      // Reaproveita a posição já capturada pelo tracker; se não há posição
      // válida ainda, pula a janela sem sobrescrever dados (Req 2.5).
      const pos = currentPosRef.current;
      if (!pos) return;

      const now = Date.now();
      // A decisão (autorização + throttle) permanece na função pura; o hook
      // apenas injeta o relógio via `nowMs` (Req 2.1, 2.3, 2.6, 6.1).
      if (
        !shouldPublish({
          status,
          mode: sharingMode,
          nowMs: now,
          lastPublishedAtMs: lastPublishedAtRef.current,
        })
      ) {
        return;
      }

      // Marca o instante ANTES do await para respeitar o throttle mesmo com
      // publicações concorrentes/lentas; em caso de falha, o valor é
      // restaurado para permitir nova tentativa na próxima janela.
      const previous = lastPublishedAtRef.current;
      lastPublishedAtRef.current = now;

      void updateMyLocation({
        latitude: pos.lat,
        longitude: pos.lng,
        mode: sharingMode,
      })
        .then(() => {
          // Publicação bem-sucedida: atualiza o marcador de recência
          // (`location_updated_at` já é gravado pelo servidor — Req 2.4) e
          // reaproveita o mecanismo de refetch de ["shared-locations"]
          // (Req 6.3) para os amigos verem a nova posição.
          setLastPublishedAt(now);
          queryClient.invalidateQueries({ queryKey: ["shared-locations"] });
        })
        .catch((err: unknown) => {
          // Falha de rede/servidor: não sobrescreve a última posição válida e
          // não interrompe a captura local do tracker; apenas adia para a
          // próxima janela (Req 2.5, 6.4). Log leve para diagnóstico.
          lastPublishedAtRef.current = previous;
          if (import.meta.env?.DEV) {
            console.warn("[useLiveActivityPublisher] publicação adiada:", err);
          }
        });
    };

    // Primeira publicação imediata quando as condições passam a valer
    // (coerente com `shouldPublish`, que retorna true quando
    // `lastPublishedAtMs == null`); o throttle é respeitado nas subsequentes.
    tryPublish();

    const timer = setInterval(tryPublish, LIVE_PUBLISH_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      publishingRef.current = false;
    };
    // `permissionDenied` participa das deps para reavaliar o laço quando a
    // permissão muda (o tracker já rebaixa `status` para `paused` nesse caso,
    // encerrando naturalmente as publicações — DECISÃO-E).
  }, [status, sharingMode, permissionDenied, queryClient]);

  return { isPublishing, lastPublishedAt };
}
