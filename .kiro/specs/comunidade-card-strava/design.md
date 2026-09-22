# Design Document

Design — Card da Comunidade estilo Strava + likes com avatares

## Overview

Repaginar o card do feed (`comunidade.tsx`) extraindo-o para um componente
próprio `CommunityPostCard`, com layout estilo Strava: cabeçalho (autor + ícone
de atividade + data/hora + cidade), descrição destacada, métricas por
`metric_form`, selo de conquista/nível (dados existentes), carrossel de mídias
(mapa + fotos + vídeo) e linha de likes com avatares + total. Mantém 100% do
comportamento atual (curtir/comentar/compartilhar/seguir/excluir/abas).

Backend: uma RPC leve para trazer os avatares de quem curtiu por post (em lote,
sem N+1) e enriquecimento do post com os dados da atividade via join.

## Architecture

- **Dados do post + atividade**: `fetchCommunityPosts` passa a trazer também os
  campos da atividade vinculada via embed
  `activity:user_activities(activity_type, distance_meters, duration_seconds, elevation_gain, map_snapshot_url, image_url, video_url, description, start_time)`.
  (RLS de user_activities permite leitura pública das concluídas.)
- **Likes com avatares**: RPC `post_like_avatars(_post_ids uuid[], _limit int)`
  retorna, por post, até `_limit` avatares (id, avatar_url, full_name) — uma
  única chamada em lote para os posts visíveis (Req 6.4). Alternativa a um join
  pesado no cliente.
- **Ícone da atividade**: reutiliza `ACTIVITY_TYPE_TO_ICON` + `getActivityIcon`.
- **Métricas**: reutiliza `computeByMetricForm` + catálogo `fetchActivityTypes`.

## Components and Interfaces

- `src/components/community/CommunityPostCard.tsx`: card completo. Props: o
  `UIPost` (estendido com dados de atividade) + handlers já existentes
  (onToggleLike, onToggleFollow, onShare, onDelete, onToggleComments) + dados de
  likeAvatars + catálogo de tipos.
- `src/components/community/MediaCarousel.tsx`: carrossel horizontal simples
  (scroll-snap) para [mapa, foto, vídeo]. Sem lib nova.
- `src/components/community/LikeAvatars.tsx`: renderiza até 3 avatares
  sobrepostos + total.
- `comunidade.tsx`: passa a mapear `visiblePosts` para `<CommunityPostCard>`,
  removendo o JSX inline do card (comportamento e state permanecem no pai).

## Data Models

- Sem alteração de schema. Uso de embed em `user_activities` e RPC de leitura.
- `UIPost` estendido com `activity?: { activityType, distanceMeters,
  durationSeconds, elevationGain, mapSnapshotUrl, imageUrl, videoUrl,
  description, startTime }`.
- Tipo `PostLikeAvatar = { postId, userId, fullName, avatarUrl }`.

## Correctness Properties

- **Property 1 (paridade de comportamento):** todas as ações existentes
  (like/comment/share/follow/delete/abas) continuam com o mesmo efeito após a
  extração para componente.
- **Property 2 (likes sem N+1):** os avatares de todos os posts visíveis são
  obtidos em no máximo 1 chamada agregada.
- **Property 3 (mídia condicional):** o carrossel só mostra as mídias que
  existem; com 1 mídia, sem controles; vídeo nunca dá autoplay.
- **Property 4 (métricas seguras):** métricas ausentes viram "—"/omitidas sem
  quebrar layout; post manual não mostra métricas de atividade.

## Error Handling

- Falha ao buscar avatares/atividade: o card ainda renderiza (degrada só a
  seção afetada). Likes avatars é best-effort (não bloqueia o feed).
- Compartilhamento mantém o try/catch atual.

## Testing Strategy

- Unit puro: `buildCardMedia(post)` (ordena mapa/foto/vídeo existentes) e
  `formatLikeSummary(count)` em `src/lib/community-card.ts` + testes fast-check.
- `filterPostsByTab` já tem cobertura; manter.
- Verificação manual do feed (like/av+total, carrossel, métricas) no APK.

## Notas de implementação

- Uma frente por vez: (A) lib pura + RPC avatares + enriquecimento;
  (B) componentes visuais (card/carrossel/likeavatars) e troca no comunidade;
  (C) verificação + APK.
- Migration idempotente (RPC) aplicada em prod 2× + NOTIFY pgrst.
- tsc limpo (só 6 de use-local-push). Colunas/RPC novas → `as never`.
