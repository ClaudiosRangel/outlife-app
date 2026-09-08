# Implementation Plan: Amigos em Atividade ao Vivo

## Overview

O plano converte o design em passos incrementais de código, começando pela
verificação de terreno (itens "a confirmar" do design), seguindo pela camada
de dados (migração idempotente da VIEW irmã + função `SECURITY DEFINER`),
depois pelo núcleo de lógica pura (`deriveIsLive`, `shouldPublish`, `canView`,
`formatLiveRecency`) que concentra o teste baseado em propriedades, e por fim
pela camada de aplicação (API, hook publisher, `LiveFriendsList`, extensão do
`MapView`) e a integração final em `explorar.tsx`.

Linguagem de implementação: **TypeScript** (cliente React + funções puras) e
**SQL** (migração Supabase), conforme já fixado no design — não houve
pseudocódigo a resolver.

As propriedades de correção do design (Property 1–6) viram sub-tarefas de teste
de propriedade com `fast-check` sobre Vitest, posicionadas junto da
implementação correspondente para pegar erros cedo. Sub-tarefas marcadas com
`*` são opcionais (testes) e podem ser puladas para um MVP mais rápido.

## Tasks

- [x] 1. Verificação de terreno e fundação de dados (itens "a confirmar" do design)
  - [x] 1.1 Confirmar contratos reais antes de qualquer alteração
    - Abrir e ler `supabase/migrations/20260522214044_*.sql` para confirmar nomes exatos das colunas de `public.user_activities` (`user_id`, `status`, `activity_type`, `start_time`, `end_time`) e a existência (ou não) de índice por `(user_id, status)`.
    - Confirmar em `@/lib/api` (arquivo único `src/lib/api.ts`) as assinaturas de `fetchSharedUserLocations`, `updateMyLocation`, `updateLocationSharingMode`, e os tipos `SharedLocation`, `LocationSharingMode`, `ActivityType`, `UserActivity`.
    - Confirmar a RLS de SELECT de `public.user_activities`: se o observador pode ou não ler linhas de outros usuários (decide entre JOIN direto na VIEW `security_invoker` vs função `SECURITY DEFINER`). Registrar a decisão como comentário no arquivo de migração.
    - Confirmar existência da chave i18n `search.activeNow` em `src/lib/i18n.ts`/locales (fallback: criar a chave na tarefa 6).
    - _Requirements: 7.1, 7.3, 7.5_

- [x] 2. Migração idempotente no Supabase (VIEW irmã + função de vínculo)
  - [x] 2.1 Criar a função `SECURITY DEFINER` `public.live_activity_type`
    - Novo arquivo timestampado em `supabase/migrations/` (nome no padrão `AAAAMMDDHHMMSS_live-activity-friends-view.sql`, posterior a `20260820090000_*`).
    - `CREATE OR REPLACE FUNCTION public.live_activity_type(_user_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public` retornando o `activity_type` da atividade `in_progress` mais recente do usuário (encapsula o vínculo sem vazar histórico).
    - _Requirements: 1.3, 7.1, 7.2_

  - [x] 2.2 Criar a VIEW `public.public_user_locations_live` (superset, `security_invoker=on`)
    - No mesmo arquivo de migração: `DROP VIEW IF EXISTS` + `CREATE VIEW ... WITH (security_invoker=on)` expondo os campos de `public_user_locations` mais `activity_type` (via `live_activity_type`) e `is_live` derivado (`activity_type IS NOT NULL AND location_updated_at > now() - interval '120 seconds'`).
    - Preservar as regras de visibilidade (`public` / `friends` + `are_friends(auth.uid(), p.id)` / self), o filtro de 24h e lat/lng não nulos. Não editar a VIEW existente (é preservada intacta).
    - `GRANT SELECT ON public.public_user_locations_live TO anon, authenticated`. Opcional: `CREATE INDEX IF NOT EXISTS idx_user_activities_user_status ON public.user_activities(user_id, status) WHERE status = 'in_progress'`.
    - _Requirements: 1.3, 5.1, 5.2, 5.4, 7.1, 7.2, 7.5_

  - [ ]* 2.3 Escrever testes de integração da VIEW
    - Contra um Postgres de teste: (a) amigo com atividade `in_progress` + posição recente aparece com `activity_type` e `is_live=true`; (b) modo `friends` sem amizade não aparece; (c) posição > 24h não aparece; (d) introspecção confirma `security_invoker=on`.
    - _Requirements: 1.3, 5.1, 5.2, 5.4, 7.5_

  - [ ]* 2.4 Escrever teste de idempotência da migração
    - Aplicar a migração duas vezes no banco de teste; a segunda execução não pode falhar nem duplicar objetos. Rodar a suíte `tests/migration/` para confirmar que nenhuma migração antiga foi editada.
    - _Requirements: 7.2, 7.3, 7.4_

- [x] 3. Checkpoint — camada de dados
  - Garantir que todos os testes passam, perguntar ao usuário se surgirem dúvidas (especialmente sobre a decisão de RLS registrada na tarefa 1.1).

- [x] 4. Núcleo de lógica pura (derivação, throttle, visibilidade, recência)
  - [x] 4.1 Implementar `deriveIsLive` e `formatLiveRecency`
    - Criar `src/lib/live-activity.ts` com `LIVE_RECENCY_WINDOW_MS = 120_000`, `deriveIsLive({ hasInProgressActivity, locationUpdatedAtMs, nowMs })` e `formatLiveRecency({ locationUpdatedAtMs, nowMs }): { live: boolean; label: string }`. Relógio sempre injetado (`nowMs`), nunca `Date.now()` interno.
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 3.3, 5.3, 6.2_

  - [ ]* 4.2 Escrever teste de propriedade para `deriveIsLive`
    - **Property 1: Derivação do estado "ao vivo"**
    - **Validates: Requirements 1.1, 1.2, 1.4, 1.5, 5.3, 6.2**

  - [ ]* 4.3 Escrever teste de propriedade para `formatLiveRecency`
    - **Property 4: Rótulo de recência**
    - **Validates: Requirements 3.3**

  - [x] 4.4 Implementar `shouldPublish` (função pura extraída do publisher)
    - Criar `src/lib/live-publish.ts` com `LIVE_PUBLISH_INTERVAL_MS = 15_000` e `shouldPublish({ status, mode, nowMs, lastPublishedAtMs })` retornando verdadeiro sse e somente se `status === 'tracking'` E `mode !== 'none'` E `nowMs - lastPublishedAtMs >= 15_000`.
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 6.1, 6.2_

  - [ ]* 4.5 Escrever teste de propriedade para `shouldPublish`
    - **Property 2: Decisão de publicação — autorização e throttle**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.6, 6.1, 6.2**

  - [x] 4.6 Implementar `canView` (modelo puro da regra de visibilidade da VIEW)
    - Criar `src/lib/live-visibility.ts` com `canView({ mode, areFriends, isSelf })` retornando verdadeiro sse e somente se `mode === 'public'` OU (`mode === 'friends'` E `areFriends`) OU `isSelf`.
    - _Requirements: 5.1, 5.2, 5.5_

  - [ ]* 4.7 Escrever teste de propriedade para `canView`
    - **Property 3: Visibilidade da posição ao vivo**
    - **Validates: Requirements 5.1, 5.2, 5.5**

- [x] 5. Camada de API — consulta de amigos ao vivo
  - [x] 5.1 Implementar `fetchLiveActivityFriends` e tipo `LiveActivityFriend`
    - Em `src/lib/api.ts`: tipo `LiveActivityFriend = SharedLocation & { activity_type: ActivityType | null; is_live: boolean }` e função `fetchLiveActivityFriends()` que faz SELECT na VIEW `public_user_locations_live`, mantendo o filtro de exclusão do próprio usuário (`r.id !== myId`).
    - _Requirements: 1.3, 3.5, 6.3_

  - [ ]* 5.2 Escrever teste de propriedade para exclusão do próprio usuário
    - **Property 5: Exclusão do próprio usuário**
    - **Validates: Requirements 3.5**

- [x] 6. Componente `LiveFriendsList` (lista abaixo do mapa)
  - [x] 6.1 Implementar `LiveFriendsList`
    - Criar `src/components/LiveFriendsList.tsx` com props `{ friends: LiveActivityFriend[]; onSelectFriend: (friendId: string) => void }`. Para cada amigo: avatar, nome resolvido (`full_name ?? username`), `activity_type` traduzido e rótulo de recência via `formatLiveRecency`. Título via i18n `search.activeNow` (criar a chave se não existir). Estado vazio quando `friends.length === 0`.
    - _Requirements: 3.2, 3.3, 3.4, 1.3_

  - [ ]* 6.2 Escrever teste de propriedade para conteúdo do card
    - **Property 6: Conteúdo do card de amigo ao vivo**
    - **Validates: Requirements 3.2, 1.3**

  - [ ]* 6.3 Escrever testes de exemplo da `LiveFriendsList`
    - `activity_type` exibido para um amigo `in_progress` (Req 1.3); estado vazio (Req 3.4).
    - _Requirements: 1.3, 3.4_

- [x] 7. Hook `useLiveActivityPublisher` (publicação ao vivo durante o rastreamento)
  - [x] 7.1 Implementar `useLiveActivityPublisher`
    - Criar `src/hooks/use-live-activity-publisher.ts` recebendo `{ status, currentPos, sharingMode, permissionDenied }` e expondo `{ isPublishing, lastPublishedAt }`. Reaproveitar `currentPos` do tracker (não abrir segundo `watchPosition`), usar `shouldPublish` para decidir a publicação e `updateMyLocation` como canal. Em falha de obtenção/rede ou `currentPos` nulo, pular a janela sem sobrescrever dados válidos e sem interromper a captura local. Suspender em `paused`.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 6.1, 6.2, 6.4, 5.5_

  - [ ]* 7.2 Escrever testes de exemplo do publisher
    - Consentimento ausente (`mode = 'none'`) mantém o hook inerte; `currentPos` nulo/erro de rede não publica nem quebra; `paused` suspende publicações.
    - _Requirements: 2.2, 2.5, 6.2, 6.4_

- [x] 8. Checkpoint — lógica pura, API e publisher
  - Garantir que todos os testes passam, perguntar ao usuário se surgirem dúvidas.

- [x] 9. Extensão do `MapView` (centralizar, destacar e atualizar marcador ao vivo)
  - [x] 9.1 Adicionar props de seleção ao `MapView`
    - Em `src/components/MapView.tsx`: props opcionais `selectedFriendId?: string | null` e `onSelectedFriendUnavailable?: (friendId: string) => void` (retrocompatível). Ao mudar `selectedFriendId`, `mapRef.setView([lat, lng], ZOOM_RUA ≈ 16, { animate: true })` e destacar o marcador (avatar em destaque). A cada refetch de `["shared-locations"]`, se o selecionado continua ao vivo (`deriveIsLive`), o marcador acompanha a nova posição; se sumiu/deixou de estar ao vivo, chamar `onSelectedFriendUnavailable`. Preservar o `Link` do popup para `/parceiro/$partnerId`.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 9.2 Escrever testes de exemplo do `MapView`
    - Toque em amigo chama `setView` com coords e zoom de rua (Req 4.1), destaca marcador (Req 4.2) e mantém `Link` (Req 4.5), com `mapRef.setView` mockado; selecionado que deixa de estar ao vivo dispara `onSelectedFriendUnavailable` (Req 4.4).
    - _Requirements: 4.1, 4.2, 4.4, 4.5_

- [x] 10. Integração final em `explorar.tsx` (wiring)
  - [x] 10.1 Montar a lista abaixo do mapa e ligar seleção + publisher
    - Em `src/routes/explorar.tsx`: estado `selectedFriendId`; `useQuery` com queryKey `["shared-locations"]` (mesma key — Req 6.3) usando `fetchLiveActivityFriends` como única `queryFn` (opção (a) do design, superset de `SharedLocation`); montar `<LiveFriendsList friends={liveFriends.filter(f => f.is_live)} onSelectFriend={setSelectedFriendId} />` logo após `<MapView selectedFriendId={...} onSelectedFriendUnavailable={...} />` (toast + limpar seleção). Instanciar `useLiveActivityPublisher` com o estado do tracker/sharing. Excluir o próprio usuário permanece garantido em `fetchLiveActivityFriends`.
    - _Requirements: 3.1, 3.6, 4.4, 5.5, 6.3_

  - [ ]* 10.2 Escrever testes de exemplo/integração do wiring
    - `LiveFriendsList` renderizada abaixo do `MapView` (Req 3.1); atualização ao chegar nova resposta sem `setInterval` adicional, reaproveitando `["shared-locations"]` (Req 3.6, 6.3).
    - _Requirements: 3.1, 3.6, 6.3_

- [x] 11. Checkpoint final — Garantir que todos os testes passam
  - Garantir que todos os testes passam, perguntar ao usuário se surgirem dúvidas.

## Notes

- Tarefas marcadas com `*` são opcionais (testes) e podem ser puladas para um MVP mais rápido.
- Cada tarefa referencia cláusulas específicas dos requisitos para rastreabilidade.
- Os checkpoints garantem validação incremental (dados → lógica/API → UI → wiring).
- Testes de propriedade (`fast-check` sobre Vitest, mínimo 100 iterações, relógio injetado) validam as propriedades universais do design; testes de exemplo/integração cobrem UI, VIEW SQL, migração e refetch — onde PBT não se aplica.
- Nenhuma coluna de flag redundante em `profiles`: `is_live` é sempre derivado (Req 1.5).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "4.1", "4.4", "4.6"] },
    { "id": 3, "tasks": ["2.3", "2.4", "4.2", "4.3", "4.5", "4.7", "5.1", "9.1"] },
    { "id": 4, "tasks": ["5.2", "6.1", "7.1", "9.2"] },
    { "id": 5, "tasks": ["6.2", "6.3", "7.2", "10.1"] },
    { "id": 6, "tasks": ["10.2"] }
  ]
}
```
