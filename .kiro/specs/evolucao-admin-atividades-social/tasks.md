# Implementation Plan — evolucao-admin-atividades-social

## Overview

Plano de implementação das 8 frentes do bloco de evolução do OutVitar, em
ordem deliberada (menor → maior risco). Cada frente é entregue isolada:
migração aplicada em produção (idempotente, rodada 2×), `tsc` limpo (só os 6
erros pré-existentes de `use-local-push.ts`), APK gerado, commit+push na
`main`, e o roadmap atualizado. Só passar para a próxima frente após a atual
funcionar. Frentes: A) trial 1 ano · B) bug deep link · C) comentários ·
D) catálogo de atividades · E) banners · F) sugestões de amizade ·
G) conquistas GPS · H) importação de trilhas.

## Task Dependency Graph

Execução sequencial recomendada A → B → C → D → E → F → G → H (uma frente por
vez). A única dependência forte é E depende de D (métricas/ícones); as demais
frentes são independentes. As "waves" abaixo agrupam as tarefas por frente.

```json
{
  "waves": [
    { "wave": 1, "frente": "A - trial", "tasks": [1, 2, 3, 4], "dependsOn": [] },
    { "wave": 2, "frente": "B - deep link", "tasks": [5, 6, 7], "dependsOn": [] },
    { "wave": 3, "frente": "C - comentarios", "tasks": [8, 9, 10, 11], "dependsOn": [] },
    { "wave": 4, "frente": "D - catalogo atividades", "tasks": [12, 13, 14, 15, 16], "dependsOn": [] },
    { "wave": 5, "frente": "E - banners", "tasks": [17, 18, 19, 20], "dependsOn": [4] },
    { "wave": 6, "frente": "F - sugestoes amizade", "tasks": [21, 22, 23], "dependsOn": [] },
    { "wave": 7, "frente": "G - conquistas GPS", "tasks": [24, 25, 26, 27], "dependsOn": [] },
    { "wave": 8, "frente": "H - importacao trilhas", "tasks": [28, 29, 30, 31], "dependsOn": [] }
  ]
}
```

## Tasks

## Frente A — Req 6: Trial de parceiro de 1 ano

- [x] 1. Módulo puro de trial + testes
  - Criar `src/lib/partner-trial.ts` com `computeTrialStatus(startedAtIso, nowMs)` e `TRIAL_DURATION_DAYS = 365`
  - Criar `src/lib/partner-trial.test.ts` (Vitest + fast-check) cobrindo a Property 1
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 2. Migração `profiles.trial_started_at`
  - Criar migration idempotente `ADD COLUMN IF NOT EXISTS trial_started_at`
  - Aplicar em produção via `scripts/run-one-migration.mjs` (rodar 2×) e refletir no `migrations-pendentes.sql`
  - _Requirements: 6.1_

- [x] 3. API + painel do parceiro
  - Reescrever `fetchPartnerTrialStatus` em `api.ts` para usar `computeTrialStatus(trial_started_at ?? created_at)`
  - Ajustar o banner de trial em `parceiro.painel.tsx` (dias restantes / encerrado + progresso por tempo); i18n pt-BR/en
  - _Requirements: 6.2, 6.3, 6.4_

- [x] 4. Verificação + entrega da Frente A
  - `tsc --noEmit`, `build:native`, `cap sync`, APK, commit+push, atualizar roadmap
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

## Frente B — Req 7: Bug do deep link `/a/:id` 404 no nativo

- [x] 5. Função pura de parsing de deep link + testes
  - Criar `src/lib/deep-link.ts` com `parseDeepLink(url)` (retorna destino de rota; distingue auth de atividade)
  - Criar `src/lib/deep-link.test.ts` cobrindo a Property 2
  - _Requirements: 7.1, 7.2, 7.4, 7.5_

- [x] 6. Corrigir roteamento nativo
  - Ajustar `useDeepLinkNavigation` em `__root.tsx` para tratar `/a/:id` via `parseDeepLink`, com fallback no `catch` (intent scheme)
  - Garantir cold start (rota inicial `/a/:id` resolve no router, não cai no NotFound)
  - _Requirements: 7.1, 7.2, 7.3, 7.5_

- [x] 7. Verificação + entrega da Frente B
  - `tsc`, build, APK, commit+push, atualizar roadmap; teste no aparelho (abrir link real de atividade)
  - _Requirements: 7.1, 7.2, 7.4_

## Frente C — Req 9: Comentários — respostas, curtidas e exclusão

- [x] 8. Migração threads + curtidas de comentário
  - Migration idempotente: `post_comments.parent_comment_id` (self-FK cascade), `post_comments.likes_count`, tabela `comment_likes` (UNIQUE), RLS (delete own or admin; likes own)
  - Aplicar em produção (2×) e refletir no `migrations-pendentes.sql`
  - _Requirements: 9.1, 9.3, 9.5, 9.6, 9.7_

- [x] 9. RPCs de comentário (SECURITY DEFINER)
  - Estender `create_post_comment` para aceitar `_parent_comment_id`; criar `toggle_comment_like`, `delete_post_comment` (autor/admin, cascata, ajusta `comments_count`)
  - _Requirements: 9.1, 9.3, 9.4, 9.5, 9.6, 9.8_

- [x] 10. API + UI de comentários
  - `api.ts`: `fetchPostComments` (raiz+replies+liked_by_me), `replyToComment`, `toggleCommentLike`, `deleteComment` (checa autoria/admin — camada extra)
  - `comunidade.tsx`: replies aninhados, curtir (otimista), responder, excluir (autor/admin); i18n
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [x] 11. Testes + entrega da Frente C
  - Idempotência de curtida validada no banco (Property 3); `tsc` limpo; commit+push; roadmap. APK adiado para o fim do bloco.
  - _Requirements: 9.3, 9.4, 9.5, 9.8_

## Frente D — Req 5: Catálogo de tipos de atividade

- [x] 12. Módulo puro `metric-forms.ts` + testes
  - `computeByMetricForm(form, input)` (pace_km, speed_elevation, pace_100m); `activity-metrics.ts` delega/preserva retrocompat
  - Testes (Property 4) — fast-check achou bug real de distância subnormal (Infinity); corrigido com MIN_SIGNIFICANT_METERS/finiteOrNull
  - _Requirements: 5.4, 5.6_

- [x] 13. Migração `activity_types` + relax do CHECK
  - Tabela `activity_types` (code/name/icon_key/metric_form/active/position) + RLS; relaxar CHECK de `user_activities.activity_type`; seed idempotente dos 8 tipos
  - Aplicada em produção 2× (`20260912110000_activity-types-catalog.sql`) e refletida no `migrations-pendentes.sql`
  - _Requirements: 5.2, 5.3, 5.4, 5.8_

- [x] 14. Icon_Model_Set + API
  - `src/lib/activity-icons.ts` (`getActivityIcon(iconKey)` via lucide) para os 8 tipos
  - `api.ts`: `fetchActivityTypes`, `fetchAllActivityTypes`, `createActivityType`, `updateActivityType`, `deleteActivityType`, `reorderActivityTypes`
  - _Requirements: 5.3, 5.5, 5.8_

- [x] 15. Tela admin + integração no rastreamento
  - Rota `/admin/atividades` (CRUD + seletor de ícone + metric_form + reorder + toggle active); card no hub; routeTree regenerado
  - `atividade.rastrear.tsx`: seletor de tipo lê `fetchActivityTypes` (fallback ao enum); i18n
  - _Requirements: 5.1, 5.2, 5.5, 5.6, 5.7, 5.8_

- [x] 16. Verificação + entrega da Frente D
  - `tsc` limpo (só 6 erros pré-existentes de use-local-push.ts); commit+push; roadmap atualizado. APK adiado para o fim do bloco.
  - _Requirements: 5.1, 5.5, 5.6_

## Frente E — Req 8: Banners de compartilhamento OUTVITAR

- [x] 17. PNGs dos ícones de atividade
  - `public/activity-icons/<icon_key>.png` (branco, stroke lucide) para os 8 tipos, gerados por `scripts/gen-activity-icons.mjs` (extrai path do lucide-react + sharp)
  - _Requirements: 8.1_

- [x] 18. Estender `banner-generator.ts`
  - `ActivityBannerInput` ampliado (variant, backgroundUrl, iconKey, activityName, description, defaultDescription, metrics[]) de forma retrocompatível; desenha marca "OUTVITAR" (canto sup. dir.), ícone+nome (canto sup. esq.), descrição (ou Default_Description) e `metrics[]`; variantes photo/map/video_poster via backgroundUrl; timeout/erro tipado preservado
  - Testes (Property 5): `resolveBannerDescription` + `truncateForBanner` (fast-check, 4 passando)
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_

- [x] 19. Integrar na tela de atividade
  - `atividade.$activityId.tsx`: busca `fetchActivityTypes`, resolve icon_key/metric_form/nome, monta `metrics[]` via `computeByMetricForm`; seletor de variante (Foto/Mapa) quando há ambos; Default_Description i18n
  - _Requirements: 8.3, 8.4, 8.5, 8.6, 8.7_

- [x] 20. Verificação + entrega da Frente E
  - `tsc` limpo (só 6 erros pré-existentes); commit+push; roadmap. APK adiado para o fim do bloco.
  - _Requirements: 8.1, 8.2, 8.9_

## Frente F — Req 4: Sugestões de amizade

- [x] 21. RPC `suggest_friends` (SECURITY DEFINER)
  - `suggest_friends(_limit)`: amigos-de-amigos (accepted) + atividade de tipo em comum (completed); exclui self e qualquer relação existente em user_friends; dedup por candidato (prioriza amigo-de-amigo); só campos públicos; `reason`
  - Aplicada em produção 2× (`20260912120000_suggest-friends.sql`, executa sem erro) e refletida no `migrations-pendentes.sql`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6_

- [x] 22. API + UI em /amigos
  - `fetchFriendSuggestions(limit)` + type `FriendSuggestion`; seção "Sugestões para você" no topo de `/amigos` com Adicionar (remove otimista via `dismissedSuggestions`); placeholder de nome ("Aventureiro") + avatar fallback; rótulo por `reason`; i18n
  - _Requirements: 4.1, 4.5, 4.7_

- [x] 23. Verificação + entrega da Frente F
  - `tsc` limpo (só 6 erros pré-existentes); commit+push; roadmap. APK adiado para o fim do bloco.
  - _Requirements: 4.1, 4.5_

## Frente G — Req 3: Conquistas por Destino via GPS

- [x] 24. Função pura de proximidade + testes
  - `isWithinRadius(point, dest, radius)` em `haversine.ts` (reutiliza `haversineMeters`; entradas inválidas → false, nunca NaN); `haversine.test.ts` (Property 7 — 3 testes fast-check passando)
  - _Requirements: 3.1, 3.2_

- [x] 25. Migração visitas + RPCs de conquista
  - Tabela `user_destination_visits` (UNIQUE user+destination, RLS leitura própria; escrita só via RPC) + RPCs `register_destination_visits` (cruza route_geojson × destinos aprovados via `ST_DWithin`, raio 500m) e `grant_destination_achievements` (keys destinos_1/5/10 em achievement_records, idempotente). Aplicada em prod 2× (`20260912130000_destination-visits-achievements.sql`)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_

- [x] 26. Integração no finish + exibição no perfil
  - `finishActivity` chama `registerDestinationVisits(id)` best-effort (não bloqueia o finish); labels `destinos_1/5/10` em `ACHIEVEMENT_RULE_LABELS`; ícones (MapPin/Award) em `achievementIconMap` do perfil
  - _Requirements: 3.1, 3.3, 3.5_

- [x] 27. Verificação + entrega da Frente G
  - `tsc` limpo (só 6 erros pré-existentes); commit+push; roadmap. APK adiado para o fim do bloco.
  - _Requirements: 3.3, 3.5_

## Frente H — Req 1/2: Importação e curadoria de trilhas/destinos

- [ ] 28. Migração `imported_trails`
  - Tabela `imported_trails` (UNIQUE source+external_id, visible default false, license, attribution) + RLS (visible OR admin; escrita admin); aplicar em produção (2×)
  - _Requirements: 1.6, 2.2, 2.3, 2.4, 2.7_

- [ ] 29. Script de importação
  - `scripts/import-trails.mjs` (Overpass QL para osm route=hiking; ICMBio/CNUC para parques) com upsert idempotente por (source, external_id); atribuição/licença para osm
  - Testar importação de uma região (ex.: Serra dos Órgãos/Itatiaia)
  - _Requirements: 2.1, 2.2, 2.3, 2.7_

- [ ] 30. Tela admin de curadoria + exibição ao usuário
  - Rota `/admin/trilhas` (lista nome/fonte/atribuição + toggle visível/oculto); card no hub; regenerar routeTree
  - Exibir trilhas `visible=true` em Explorar com atribuição OSM; i18n
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7_

- [ ] 31. Verificação + entrega da Frente H
  - `tsc`, build, APK, commit+push, atualizar roadmap; marcar o bloco como concluído
  - _Requirements: 1.1, 1.3, 1.5_

## Notes

- **Migrações**: sempre idempotentes, aplicadas via `scripts/run-one-migration.mjs`
  (rodar 2× para confirmar idempotência) e refletidas em
  `supabase/migrations-pendentes.sql`. O agente aplica em produção
  (`SUPABASE_DB_URL` no `.env`).
- **Continuidade entre sessões**: o `docs/ROADMAP-FINALIZACAO-APP.md` tem a
  seção deste bloco; marcar cada frente concluída com data/resumo/migration.
- **Build por frente**: `npm run build:native` → `npx cap sync android` →
  `assembleDebug`. Rotas novas (`/admin/atividades`, `/admin/trilhas`) exigem
  routeTree regenerado (o build:native faz).
- **Banner de vídeo (Frente E)**: decisão do design — arte estática sobre o
  poster; o vídeo em si segue o fluxo de mídia existente (evita
  transcodificação client-side, lição do Bloco B).
- **Atribuição OSM (Frente H)**: obrigatória (© OpenStreetMap contributors,
  licença ODbL) sempre que exibir dados de origem `osm`.
