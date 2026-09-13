# Implementation Plan — perfil-publico-redesign

## Overview

Redesenho do perfil unificado (Instagram/Strava) + ícone de parapente para
Voo livre. Um componente compartilhado `ProfileView` renderiza tanto o
Perfil_Próprio (`/perfil`) quanto o Perfil_De_Outro (`/u/$userId`). Entrega
incremental, `tsc` limpo (só os 6 erros pré-existentes de `use-local-push.ts`),
commit+push na `main`, APK no fim. Cada tarefa referencia os requisitos.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "frente": "Icone parapente", "tasks": [1, 2], "dependsOn": [] },
    { "wave": 2, "frente": "Dados", "tasks": [3], "dependsOn": [] },
    { "wave": 3, "frente": "Componente ProfileView", "tasks": [4, 5, 6, 7], "dependsOn": [1, 3] },
    { "wave": 4, "frente": "Rotas + integracao", "tasks": [8, 9], "dependsOn": [4] },
    { "wave": 5, "frente": "Entrega", "tasks": [10], "dependsOn": [2, 8, 9] }
  ]
}
```

## Tasks

- [x] 1. Ícone de parapente (Icon_Parapente)
  - Criado `src/components/icons/ParagliderIcon.tsx` (SVG stroke, assinatura tipo lucide: `size`)
  - `activity-icons.ts`: `flight` usa o ParagliderIcon (não `Plane`); mantém fallback `activity`
  - _Requirements: 6.1, 6.3_

- [x] 2. PNG do ícone de parapente para banners
  - `scripts/gen-activity-icons.mjs`: `flight.png` gerado a partir do path do parapente (CUSTOM_SVG_INNER.flight sincronizado com o componente); PNGs regenerados
  - _Requirements: 6.2_

- [x] 3. Camada de dados do perfil
  - `api.ts`: `fetchUserPostsByAuthor(userId, limit)` + tipo `UserPostSummary` + helper puro `safeCount(n)`
  - Reuso de `fetchPublicProfile`/`fetchUserPublicActivities`/`fetchUserAchievements`/`fetchLiveActivityFriends`
  - _Requirements: 4.1, 4.3, 5.3_

- [x] 4. Componente `ProfileView` — cabeçalho + selo ao vivo + stats
  - `src/routes/profile-view.tsx`: hero (avatar + anel AO VIVO, nome, @, bio, stats inline), botão "Enviar mensagem" só no perfil de outro, selo ao vivo com atalho ao Explorar
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3_

- [x] 5. `ProfileView` — abas com ícones
  - Abas Atividades/Posts/Conquistas com ícones; estados vazios amigáveis
  - _Requirements: 5.1, 5.5_

- [x] 6. Aba Atividades com ícone por tipo
  - Card_Atividade sempre com `getActivityIcon(ACTIVITY_TYPE_TO_ICON[...])` + distância/duração/data
  - _Requirements: 5.2_

- [x] 7. Aba Posts (grade) + aba Conquistas (medalhas)
  - Posts do autor em grade 3 col (foto/poster, marca vídeo), toque abre atividade/comunidade; conquistas com ícone/rótulo
  - _Requirements: 5.3, 5.4_

- [x] 8. Integrar no `/perfil` (Perfil_Próprio)
  - `perfil.tsx` renderiza `<ProfileView viewedUserId={user.id} />` no topo (barra mínima logout/config acima), preservando seguidores/seguindo clicáveis, Ver amigos, admin, parceiro, rastrear, opinião, dark mode, nível, checklist, próxima aventura. Achievements antiga removida (ProfileView já mostra)
  - _Requirements: 1.1, 2.3, 7.1_

- [x] 9. `/u/$userId` fino + navegação da comunidade
  - `u.$userId.tsx` agora só renderiza `<ProfileView viewedUserId={params.userId} />` (deep link preservado); Comunidade já linka o autor para `/u/$userId`
  - _Requirements: 1.2, 1.4_

- [x] 10. Verificação + entrega
  - Testes fast-check (`activity-icons.test.ts`: getActivityIcon flight→parapente + safeCount, 4 passando); `tsc` limpo (6 erros pré-existentes); i18n `profileView.*` pt-BR/en; commit+push; APK; roadmap
  - _Requirements: 6.1, 6.3, 4.3, 7.3_

## Notes

- **Um perfil só**: mesma experiência visual em `/perfil` e `/u/$userId`, via
  `ProfileView`. A rota `/u/:id` fica só para deep links já compartilhados.
- **Conquistas de outro usuário**: `achievement_records` tem RLS de leitura
  própria → no Perfil_De_Outro a aba pode vir vazia (estado vazio normal).
- **Selo ao vivo**: cruza `fetchLiveActivityFriends` por `id === viewedUserId
  && is_live`; offline → sem selo.
- **routeTree**: nenhuma rota nova (reusa `/perfil` e `/u/$userId`); só é
  preciso regenerar se `profile-view.tsx` virar rota — ele é componente, não rota.
- **Build por entrega**: APK só no fim; `tsc` a cada passo (só 6 erros
  pré-existentes de use-local-push.ts).
