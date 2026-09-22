# Implementation Plan: Card da Comunidade estilo Strava + likes com avatares

## Overview

Repaginação do card do feed em 3 frentes (dados/RPC, componentes visuais,
verificação). Uma frente por vez, sem quebrar o existente.

## Task Dependency Graph

- Tarefa 1 (lib pura + RPC avatares + enriquecimento) — base.
- Tarefa 2 (componentes visuais + troca no comunidade) — depende de 1.
- Tarefa 3 (verificação + APK) — depende de 1 e 2.

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3"] }
  ]
}
```

## Tasks

- [ ] 1. Dados e lógica pura (Frente A)
  - [ ] 1.1 `src/lib/community-card.ts`: `buildCardMedia(post)` (ordena
    mapa/foto/vídeo existentes) e `formatLikeSummary(count)` + testes
    fast-check (Requisitos 3, 5.1, 5.2, 6.1).
  - [ ] 1.2 Migration `20260915130000_post-like-avatars.sql`: RPC
    `post_like_avatars(_post_ids uuid[], _limit int)` retornando avatares por
    post (join post_likes+profiles). Aplicar 2× + NOTIFY pgrst + consolidado
    (Requisito 6.1, 6.4).
  - [ ] 1.3 API: enriquecer `fetchCommunityPosts` com embed de
    `user_activities`; `fetchPostLikeAvatars(postIds, limit)`; tipos
    (Requisitos 1.2, 3.1, 6.1).

- [ ] 2. Componentes visuais (Frente B)
  - [ ] 2.1 `LikeAvatars.tsx` (até 3 avatares + total) (Requisito 6).
  - [ ] 2.2 `MediaCarousel.tsx` (scroll-snap mapa/foto/vídeo; 1 mídia sem
    controles; vídeo via SafeVideo) (Requisito 5).
  - [ ] 2.3 `CommunityPostCard.tsx`: cabeçalho (autor+ícone+data/hora+cidade),
    descrição destacada, métricas por metric_form, selo de conquista/nível
    (slot de segmento), carrossel, ações (mantém like/comment/share/follow/
    delete) + avatares (Requisitos 1, 2, 3, 4, 6, 7).
  - [ ] 2.4 Trocar o JSX inline do card em `comunidade.tsx` por
    `<CommunityPostCard>`, mantendo todo o state/handlers (Requisito 7.1).
  - [ ] 2.5 i18n de rótulos novos (métricas/"deram kudos"/conquista) PT+EN.

- [ ] 3. Verificação e fechamento
  - [ ] 3.1 `tsc` limpo (só 6 de use-local-push); testes novos passando.
  - [ ] 3.2 Build APK (build:native → cap sync → assembleDebug).
  - [ ] 3.3 Commit+push na main; atualizar ROADMAP + backlog.

## Notes

- Slot de "conquista de segmento" fica pronto para a frente #5 (segmentos).
- Não regredir memória de vídeo (SafeVideo, sem autoplay).
