# Implementation Plan: outlife-completar-funcionalidades

## Overview

Este plano implementa as 12 requirements do spec na ordem: primeiro as migrações
de banco (tabelas, RPCs, triggers), depois as funções novas de `src/lib/api.ts`
que consomem esse backend, depois o wiring de UI (rotas novas e rotas
modificadas) requirement a requirement, e por fim os itens de limpeza de
decorativos (Requirement 12). Cada bloco de funcionalidade termina com os
testes de propriedade das Correctness Properties correspondentes do design e,
quando aplicável, testes unitários de wiring/UI. Checkpoints são inseridos após
cada bloco coeso para validar antes de avançar.

Linguagem de implementação: TypeScript (React 19 + TanStack Router/Start no
cliente) e PL/pgSQL (migrações Supabase), conforme o design document, que já
usa código real (não pseudocódigo).

## Tasks

- [x] 1. Migrações de banco de dados
  - [x] 1.1 Migration A: `post_likes` + `toggle_post_like` + bypass do trigger de contadores
    - Criar `supabase/migrations/20260716090000_post-likes-toggle-function.sql`
    - Tabela `post_likes` com `UNIQUE (post_id, user_id)`
    - Função `toggle_post_like(_post_id uuid)` `SECURITY DEFINER` (delete-then-insert idempotente)
    - Estender `prevent_post_counter_tampering` para respeitar `current_setting('outlife.bypass_post_counters', true)`
    - _Requirements: 6.1_

  - [x] 1.2 Migration B: novo status `following` em `user_friends`
    - Criar `supabase/migrations/20260716090100_user-friends-following-status.sql`
    - Substituir a constraint de status para aceitar `'pending' | 'accepted' | 'blocked' | 'following'`
    - _Requirements: 7.1_

  - [x] 1.3 Migration C: `post_comments` + `create_post_comment`
    - Criar `supabase/migrations/20260716090200_post-comments.sql`
    - Tabela `post_comments` com `CHECK (length(btrim(text)) > 0)` e políticas de RLS (select público, insert só do próprio autor)
    - Função `create_post_comment(_post_id uuid, _text text)` `SECURITY DEFINER`, usando o mesmo sinalizador `outlife.bypass_post_counters` da Migration A para incrementar `comments_count`
    - _Requirements: 8.1, 8.4, 8.6_

  - [x] 1.4 Migration D: `notifications` + trigger de solicitação de amizade
    - Criar `supabase/migrations/20260716090300_notifications.sql`
    - Tabela `notifications` com RLS (select/update restritos a `auth.uid() = recipient_id`, sem policy de insert para clientes)
    - Função + trigger `AFTER INSERT ON user_friends` que cria notificação `friend_request` quando `status = 'pending'`
    - _Requirements: 9.1, 9.2_

  - [x] 1.5 Migration E: bucket `avatars`
    - Criar `supabase/migrations/20260716090400_avatars-bucket.sql`
    - `INSERT INTO storage.buckets` para `avatars` (público, `image/jpeg,png,webp`, 5MB) + policies de upload restritas à própria pasta do usuário, seguindo o padrão de `partner-gallery`
    - _Requirements: 10.3_

  - [x] 1.6 Migration F: `cadastur_verification_requests` + bucket `compliance-documents` + funções de decisão
    - Criar `supabase/migrations/20260716090500_cadastur-verification-requests.sql`
    - Tipo `cadastur_request_status`, tabela `cadastur_verification_requests`, índice único parcial `WHERE status = 'pending'` por `partner_id`
    - RLS: select para o próprio parceiro ou admin, insert para o próprio parceiro, update só para admin
    - Bucket `compliance-documents` (privado) + policies (upload pelo próprio parceiro, leitura por admin)
    - Funções `approve_cadastur_request(_id uuid)` e `reject_cadastur_request(_id uuid)`, ambas `SECURITY DEFINER` checando `is_admin(auth.uid())` explicitamente
    - _Requirements: 11.1, 11.3, 11.5, 11.6, 11.8, 11.9_

  - [x] 1.7 Migration G: `partner_metric_daily` + atualização das RPCs de incremento
    - Criar `supabase/migrations/20260716090600_partner-metric-daily.sql`
    - Tabela `partner_metric_daily` (`UNIQUE (partner_id, day)`)
    - Modificar `increment_partner_profile_view`/`increment_partner_contact_click` para também fazer `INSERT ... ON CONFLICT DO UPDATE` no dia corrente
    - _Requirements: 12.2_

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. API — busca de usuários (Requirement 3)
  - [x] 3.1 Implementar `searchUsers` em `src/lib/api.ts`
    - Adicionar tipo `UserSearchResult`
    - Query `ILIKE` server-side sobre `full_name`/`username` em `profiles`
    - _Requirements: 3.2_

  - [ ]* 3.2 Escrever property test para `searchUsers`
    - **Property 7: `searchUsers` retorna exatamente os perfis correspondentes ao texto de busca**
    - **Validates: Requirements 3.2**
    - Criar `tests/property/friends.property.test.ts` (mock de `supabase.from('profiles')`)

- [x] 4. API — curtidas, follow e comentários da comunidade (Requirements 6, 7, 8)
  - [x] 4.1 Implementar `togglePostLike`, `toggleAuthorFollow`, `fetchMyFollowedAuthorIds` em `src/lib/api.ts`
    - `togglePostLike` chama a RPC `toggle_post_like`
    - `toggleAuthorFollow` faz upsert/delete de uma linha `status = 'following'` em `user_friends`
    - _Requirements: 6.1, 6.2, 6.3, 7.2, 7.3_

  - [ ]* 4.2 Escrever property tests para curtidas e follow
    - **Property 12: Toggle de curtida é consistente, idempotente por par e persistido**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
    - **Property 13: Toggle de seguir autor é consistente, idempotente por par e persistido**
    - **Validates: Requirements 7.2, 7.3, 7.4**
    - Criar `tests/property/community-persistence.property.test.ts` (banco de teste local para a RPC; mock para `toggleAuthorFollow`)

  - [x] 4.3 Implementar `fetchPostComments`, `createPostComment` em `src/lib/api.ts`
    - Adicionar tipo `PostComment`
    - `createPostComment` chama a RPC `create_post_comment`
    - _Requirements: 8.2, 8.3_

  - [ ]* 4.4 Escrever property tests para comentários
    - **Property 14: Criação de comentário é refletida no fetch e incrementa o contador atomicamente**
    - **Validates: Requirements 8.2, 8.3, 8.4**
    - **Property 15: Comentário vazio ou composto apenas de espaços é sempre rejeitado**
    - **Validates: Requirements 8.6**
    - Adicionar aos testes de `tests/property/community-persistence.property.test.ts` (banco de teste local para a RPC)

- [x] 5. API — notificações (Requirement 9)
  - [x] 5.1 Implementar `fetchNotifications`, `fetchUnreadNotificationCount`, `markNotificationsAsRead` em `src/lib/api.ts`
    - Adicionar tipo `Notification`
    - _Requirements: 9.3, 9.5, 9.6, 9.7_

  - [ ]* 5.2 Escrever property tests para notificações
    - **Property 16: Enviar solicitação de amizade cria exatamente uma Notification para o destinatário**
    - **Validates: Requirements 9.2**
    - **Property 17: `fetchNotifications` reflete exatamente as Notification do usuário autenticado em ordem cronológica decrescente**
    - **Validates: Requirements 9.3**
    - **Property 18: Indicador do sino reflete exatamente a existência de Notification não lida**
    - **Validates: Requirements 9.5, 9.6**
    - **Property 19: Abrir a Notifications_Screen marca como lidas e remove o indicador imediatamente**
    - **Validates: Requirements 9.7, 9.8**
    - Criar `tests/property/notifications.property.test.ts` (banco de teste local para o trigger; mock para a leitura/indicador)

- [x] 6. API — perfil e upload de avatar (Requirement 10)
  - [x] 6.1 Implementar `uploadAvatarImage`, `isUsernameTaken` em `src/lib/api.ts`
    - `uploadAvatarImage` segue o mesmo padrão de resize client-side de `uploadPartnerGalleryImage`, bucket `avatars`
    - _Requirements: 10.3, 10.4, 10.6_

  - [ ]* 6.2 Escrever property tests para avatar e unicidade de username
    - **Property 20: Atualização de avatar é um round-trip simples**
    - **Validates: Requirements 10.4**
    - **Property 21: Unicidade de username é respeitada e mapeada corretamente**
    - **Validates: Requirements 10.6**
    - Criar `tests/property/profile-settings.property.test.ts`

- [x] 7. API — compliance e admin (Requirement 11)
  - [x] 7.1 Implementar `submitCadasturRequest`, `fetchMyCadasturRequest`, `uploadComplianceDocument`, `fetchPendingCadasturRequests`, `approveCadasturRequest`, `rejectCadasturRequest`, `fetchMyRole`, `isCurrentUserAdmin` em `src/lib/api.ts`
    - Adicionar tipo `CadasturRequest`
    - `submitCadasturRequest` mapeia a violação do índice único parcial para "você já tem uma solicitação em análise"
    - _Requirements: 11.2, 11.4, 11.5, 11.6, 11.8, 11.9_

  - [ ]* 7.2 Escrever property tests para submissão e moderação Cadastur
    - **Property 22: Submissão de compliance sempre cria solicitação `pending`, nunca aprovada automaticamente**
    - **Validates: Requirements 11.2**
    - **Property 23: Segunda submissão de compliance com solicitação pendente existente é sempre bloqueada**
    - **Validates: Requirements 11.9**
    - **Property 24: Listagem e controle de acesso do Admin_Compliance_Screen dependem exatamente do Admin_Role**
    - **Validates: Requirements 11.4, 11.8**
    - **Property 25: Decisão de aprovação/rejeição admin é determinística e afeta exatamente os campos esperados**
    - **Validates: Requirements 11.5, 11.6**
    - Criar `tests/property/cadastur-moderation.property.test.ts` (banco de teste local para RLS e as RPCs de decisão)

- [x] 8. API — gráfico real do painel do parceiro (Requirement 12.2)
  - [x] 8.1 Reescrever `fetchPartnerChart` em `src/lib/api.ts`
    - Agregar `partner_metric_daily` dos últimos 7 dias, preenchendo dias ausentes com zero no cliente
    - _Requirements: 12.2_

  - [ ]* 8.2 Escrever property test para o gráfico do parceiro
    - **Property 27: Gráfico do parceiro varia com os dados reais de `profile_views`/`contact_clicks`**
    - **Validates: Requirements 12.2**
    - Criar `tests/property/partner-chart.property.test.ts`

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Destination_Detail_Screen e correção do link em Explorar (Requirement 1)
  - [x] 10.1 Criar rota `src/routes/destino.$destinationId.tsx`
    - Seguir o padrão de `atividade.$activityId.tsx`: `Route.useParams()`, `useQuery`, skeleton de loading, estado "não encontrado" sem distinguir inexistente de pending-de-outro-usuário
    - Exibir nome, descrição, imagem principal, dificuldade, distância, duração, elevação, tipo, e indicação visual de status pendente quando aplicável
    - _Requirements: 1.1, 1.3, 1.4, 1.5_

  - [x] 10.2 Corrigir link do card de destino em `src/routes/explorar.tsx`
    - Trocar `Link to="/marketplace"` por `Link to="/destino/$destinationId" params={{ destinationId: d.id }}`
    - _Requirements: 1.6_

  - [ ]* 10.3 Escrever property tests para visibilidade e avaliações do destino
    - **Property 1: Visibilidade de destino é exatamente `approved` ou próprio pendente**
    - **Validates: Requirements 1.3, 1.4, 1.5, 5.3**
    - **Property 2: Lista de avaliações reflete exatamente `fetchReviewsByDestination`**
    - **Validates: Requirements 1.2**
    - Criar `tests/property/destination-detail.property.test.ts` (banco de teste local para RLS de `destinations`; mock para `fetchReviewsByDestination`)

  - [x] 10.4 Adicionar ação de avaliar na Destination_Detail_Screen
    - Formulário de nota/comentário chamando `submitReview` já existente com `targetType: "destination"`
    - _Requirements: 1.7_

  - [ ]* 10.5 Escrever unit tests de navegação e avaliação
    - Navegação do card em `/explorar` para a rota de detalhe
    - Submissão de review com `targetType: "destination"` chamando `submitReview` corretamente
    - _Requirements: 1.6, 1.7_

- [x] 11. Ações de coleção: salvar destino e favoritar parceiro (Requirement 2)
  - [x] 11.1 Criar componente reutilizável de toggle de coleção
    - Componente único parametrizável para Saved_Destination_Action e Favorite_Partner_Action, com guarda `if (!user) { toast; return; }` consistente com `comunidade.tsx`
    - _Requirements: 2.1, 2.4, 2.7_

  - [ ]* 11.2 Escrever property tests para os toggles de coleção e guarda de autenticação
    - **Property 3: Toggle de Saved_Destination_Action é consistente e idempotente por par**
    - **Validates: Requirements 2.1, 2.2, 2.3**
    - **Property 4: Toggle de Favorite_Partner_Action é consistente e idempotente por par**
    - **Validates: Requirements 2.4, 2.5, 2.6**
    - **Property 5: Guarda de autenticação bloqueia mutações de coleção/comunidade sem sessão**
    - **Validates: Requirements 2.7, 6.5, 7.5, 8.5**
    - Criar `tests/property/collection-toggles.property.test.ts` (mock de `saveDestination`/`unsaveDestination`/`favoritePartner`/`unfavoritePartner`/`togglePostLike`/`toggleAuthorFollow`/`createPostComment`)

  - [x] 11.3 Ligar o componente de toggle em `destino.$destinationId.tsx` e `parceiro.$partnerId.tsx`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8_

  - [ ]* 11.4 Escrever unit tests para refresh das abas "Salvos"/"Favoritos" do perfil
    - Verificar que uma mudança feita em qualquer tela é refletida na próxima renderização das abas de `/perfil`
    - _Requirements: 2.8_

- [x] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Friends_Screen (Requirement 3)
  - [x] 13.1 Criar rota `src/routes/amigos.tsx`
    - Lista de amigos aceitos (`fetchFriends`), busca (`searchUsers`), envio/aceite/remoção de solicitação (`sendFriendRequest`/`acceptFriendRequest`/`removeFriend`)
    - Bloquear no client o envio para si mesmo ou para usuário com Friendship existente (pending ou accepted), com mensagem explicativa
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 13.2 Escrever property tests para `fetchFriends` e máquina de estados de Friendship
    - **Property 6: `fetchFriends` reflete exatamente as Friendship `accepted` do usuário autenticado**
    - **Validates: Requirements 3.1**
    - **Property 8: Máquina de estados de Friendship é consistente para qualquer sequência de ações**
    - **Validates: Requirements 3.3, 3.4, 3.5, 3.6**
    - Adicionar aos testes de `tests/property/friends.property.test.ts` (banco de teste local para a máquina de estados)

  - [ ]* 13.3 Escrever unit tests para acesso à Friends_Screen
    - Navegação a partir de `/perfil`
    - _Requirements: 3.1_

- [x] 14. Partner_Service_Management_Screen (Requirement 4)
  - [x] 14.1 Adicionar seção "Meus serviços" em `src/routes/parceiro.painel.tsx`
    - `Sheet` reaproveitado com lista (`fetchMyServices`), formulário de criação (`createService`) e remoção com confirmação (`deleteService`)
    - Validação client-side: destino selecionado, título preenchido, descrição não vazia, preço válido — bloqueando a submissão e indicando os campos pendentes
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 14.2 Escrever property tests para CRUD e validação de Partner_Service
    - **Property 9: CRUD de Partner_Service é um round-trip completo**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.5**
    - **Property 10: Validação do formulário de Partner_Service bloqueia submissão com qualquer campo obrigatório inválido**
    - **Validates: Requirements 4.4**
    - Criar `tests/property/partner-services.property.test.ts` (mock de `createService`/`deleteService`/`fetchMyServices`/`fetchServicesByPartner`)

  - [ ]* 14.3 Escrever unit tests de refresh de `parceiro.$partnerId.tsx`
    - Verificar que criação/remoção de serviço é refletida por `fetchServicesByPartner` na próxima carga
    - _Requirements: 4.5_

- [x] 15. Sugestão de novo destino (Requirement 5)
  - [x] 15.1 Criar componente de formulário de sugestão de destino (drawer/sheet)
    - Coleta de nome, descrição e localização via `navigator.geolocation` (mesmo padrão de `use-location-sharing.ts`)
    - Chama `createPendingDestination`, confirma envio para análise em sucesso, exibe erro em falha sem confirmar
    - Validação client-side bloqueando submissão sem nome ou sem localização válida
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

  - [ ]* 15.2 Escrever property test para validação do formulário de sugestão
    - **Property 11: Validação do formulário de sugestão de destino bloqueia submissão com nome ou localização inválidos**
    - **Validates: Requirements 5.4**
    - Criar `tests/property/destination-suggestion-validation.property.test.ts`

  - [ ]* 15.3 Escrever unit tests de sucesso e erro na submissão
    - Confirmação de envio em sucesso; mensagem de erro sem confirmação em falha de `createPendingDestination`
    - _Requirements: 5.2, 5.5_

- [x] 16. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Persistência real de comunidade: curtidas, follow e comentários (Requirements 6, 7, 8)
  - [x] 17.1 Ligar curtidas em `src/routes/comunidade.tsx`
    - `toggleLike` passa a usar `useMutation` chamando `togglePostLike`, com `onMutate` otimista e `onError` de rollback
    - Estado de curtida ao recarregar reflete `fetchCommunityPosts`/persistência real
    - _Requirements: 6.2, 6.3, 6.4, 6.5_

  - [x] 17.2 Ligar seguir autor em `src/routes/comunidade.tsx`
    - `toggleFollow` passa a usar `useMutation` chamando `toggleAuthorFollow`, com `fetchMyFollowedAuthorIds` para o estado inicial
    - _Requirements: 7.2, 7.3, 7.4, 7.5_

  - [x] 17.3 Ligar comentários reais em `src/routes/comunidade.tsx`
    - Lista fixa de comentários substituída por `useQuery(["post-comments", postId], () => fetchPostComments(postId))`, carregada quando `showComments[id]` é `true`
    - Input de comentário chama `createPostComment`, bloqueando submissão de texto vazio/apenas espaços
    - _Requirements: 8.2, 8.3, 8.5, 8.6_

  - [ ]* 17.4 Escrever unit tests de guarda de autenticação e rollback otimista em `comunidade.tsx`
    - Usuário não autenticado ativando curtida/seguir/comentário é redirecionado para login sem chamar as funções de mutação
    - Rollback do estado otimista quando a mutação falha
    - _Requirements: 6.5, 7.5, 8.5_

- [x] 18. Notifications_Screen e sino de notificação (Requirement 9)
  - [x] 18.1 Criar rota `src/routes/notificacoes.tsx`
    - Lista de `fetchNotifications` em ordem cronológica decrescente
    - Marca como lidas (`markNotificationsAsRead`) as notificações exibidas na sessão de visualização
    - _Requirements: 9.3, 9.7_

  - [x] 18.2 Ligar sino de notificação em `src/routes/index.tsx`
    - Sino navega para `/notificacoes`; indicador visual baseado em `fetchUnreadNotificationCount` (React Query), removido imediatamente ao marcar como lida sem esperar novo carregamento
    - _Requirements: 9.4, 9.5, 9.6, 9.8_

  - [ ]* 18.3 Escrever unit tests de navegação e indicador do sino
    - Navegação do sino para `/notificacoes`
    - Indicador presente/ausente conforme existência de notificação não lida
    - _Requirements: 9.4, 9.5, 9.6_

- [x] 19. Profile_Settings_Screen (Requirement 10)
  - [x] 19.1 Criar rota `src/routes/configuracoes.tsx`
    - Upload de foto de perfil via `uploadAvatarImage` + atualização de `avatar_url`
    - Edição de nome completo, username e localização via `updateMyProfile`, com verificação prévia de `isUsernameTaken` e mensagem de "nome de usuário já está em uso" ao ser rejeitado
    - _Requirements: 10.3, 10.4, 10.5, 10.6_

  - [x] 19.2 Ligar ícone de engrenagem em `src/routes/perfil.tsx`
    - Substituir `<button>` sem `onClick` por `<Link to="/configuracoes">`
    - _Requirements: 10.1, 10.2_

  - [ ]* 19.3 Escrever unit tests de navegação e atualização de perfil em `/perfil`
    - Navegação da engrenagem para `/configuracoes`
    - Nova foto exibida em `/perfil` após confirmação do upload
    - _Requirements: 10.2, 10.4_

- [x] 20. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 21. Admin_Compliance_Screen e fluxo real de moderação Cadastur (Requirement 11)
  - [x] 21.1 Criar rota `src/routes/admin.compliance.tsx`
    - Guard client-side via `isCurrentUserAdmin`, negando renderização/redirecionando quando o usuário não tem Admin_Role
    - Lista de `fetchPendingCadasturRequests`, ações de `approveCadasturRequest`/`rejectCadasturRequest`
    - _Requirements: 11.4, 11.5, 11.6, 11.8_

  - [x] 21.2 Modificar `src/routes/compliance.tsx` para submissão real
    - `onSubmit` chama `uploadComplianceDocument` + `submitCadasturRequest` em vez do `setTimeout` de aprovação automática
    - Badge de status (`unverified`/`pending`/`verified`) obtido de `fetchMyCadasturRequest`/`profile.is_verified` em vez de estado local
    - Mapear erro do índice único parcial para mensagem de "solicitação já em análise"
    - _Requirements: 11.2, 11.7, 11.9_

  - [ ]* 21.3 Escrever unit tests de guard e status de compliance
    - Redirecionamento/negação de acesso a `/admin/compliance` para usuário sem Admin_Role
    - Badge de status refletindo `pending`/`approved`/`rejected` após recarregar `compliance.tsx`
    - _Requirements: 11.7, 11.8_

- [x] 22. Remoção de decorativos remanescentes (Requirement 12)
  - [x] 22.1 Extrair e aplicar filtro funcional em `src/routes/explorar.tsx`
    - Função pura de filtro por dificuldade, aplicada via `useState<Difficulty | "all">` sobre o array já carregado por `fetchDestinations`
    - _Requirements: 12.1_

  - [ ]* 22.2 Escrever property test para o filtro de Explorar
    - **Property 26: Filtro de dificuldade em Explorar restringe a lista exatamente ao critério selecionado**
    - **Validates: Requirements 12.1**
    - Criar `tests/property/explore-filter.property.test.ts`

  - [x] 22.3 Implementar listas reais de seguidores/seguindo em `src/routes/perfil.tsx`
    - Botões abrem lista real reaproveitando `fetchFriends` (Friendship `accepted`), substituindo qualquer lista anteriormente exibida pelo outro botão, nunca ambas simultaneamente
    - _Requirements: 12.3_

  - [ ]* 22.4 Escrever property test para as listas de seguidores/seguindo
    - **Property 28: Listas de seguidores/seguindo exibem exatamente a Friendship reaproveitada e nunca ambas simultaneamente**
    - **Validates: Requirements 12.3**
    - Criar `tests/property/profile-decorative-fixes.property.test.ts` (mock de `fetchFriends`)

  - [x] 22.5 Ocultar condicionalmente a previsão do tempo em `src/routes/perfil.tsx`
    - Renderizar a seção somente quando `forecast.length > 0` a partir de `fetchNextAdventure`
    - _Requirements: 12.4_

  - [ ]* 22.6 Escrever property test para a ocultação da previsão do tempo
    - **Property 29: Seção de previsão do tempo é ocultada exatamente quando não há forecast**
    - **Validates: Requirements 12.4**
    - Adicionar aos testes de `tests/property/profile-decorative-fixes.property.test.ts` (função pura extraída de condição de renderização)

  - [x] 22.7 Implementar compartilhamento nativo/clipboard
    - Botão de compartilhar em `src/routes/comunidade.tsx` (Community_Post) e em `src/routes/parceiro.$partnerId.tsx` (topo da galeria) usando `navigator.share` com fallback para `navigator.clipboard.writeText`, com confirmação visível
    - _Requirements: 12.5_

  - [ ]* 22.8 Escrever unit tests de fallback de compartilhamento
    - `navigator.share` presente vs. ausente, verificando fallback para clipboard e mensagens de confirmação/erro
    - _Requirements: 12.5_

- [x] 23. Checkpoint final - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido.
- Cada tarefa referencia sub-requirements específicos para rastreabilidade.
- Checkpoints garantem validação incremental após cada bloco coeso de funcionalidade.
- Testes de propriedade validam as 29 Correctness Properties universais do design; testes unitários validam exemplos concretos e casos de erro.
- Migrações que envolvem PL/pgSQL (RPCs, triggers) são validadas por testes de propriedade que rodam contra um banco de teste local/efêmero (Postgres local via `supabase start`), nunca contra o Production_Supabase_Project; testes que cobrem apenas `src/lib/api.ts` mockam `@/integrations/supabase/client`, seguindo o padrão de `tests/property/user-data-functions.property.test.ts`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "3.1", "10.1", "10.2", "11.1", "14.1", "15.1", "22.3", "22.7"] },
    { "id": 1, "tasks": ["3.2", "4.1", "10.3", "10.4", "13.1", "14.2", "14.3", "15.2", "15.3", "22.1", "22.4", "22.5", "22.8"] },
    { "id": 2, "tasks": ["4.2", "4.3", "10.5", "11.3", "13.2", "13.3", "17.1", "22.2", "22.6"] },
    { "id": 3, "tasks": ["4.4", "5.1", "11.2", "11.4", "17.2"] },
    { "id": 4, "tasks": ["5.2", "6.1", "17.3", "18.1", "18.2"] },
    { "id": 5, "tasks": ["6.2", "7.1", "17.4", "18.3", "19.1"] },
    { "id": 6, "tasks": ["7.2", "8.1", "19.2", "21.1", "21.2"] },
    { "id": 7, "tasks": ["8.2", "19.3", "21.3"] }
  ]
}
```

Wave boundaries respeitam duas regras: (1) uma tarefa só entra em uma wave depois que todas as suas dependências reais estiverem em waves anteriores (ex: `4.3`/`5.1`/`6.1`/`7.1`/`8.1` dependem das migrations da wave 0; `17.x` dependem das funções novas de `api.ts`); (2) tarefas que escrevem no mesmo arquivo nunca compartilham a mesma wave — por isso as sete tarefas que editam `src/lib/api.ts` (`3.1`, `4.1`, `4.3`, `5.1`, `6.1`, `7.1`, `8.1`) ficam em waves distintas entre si, assim como as edições concorrentes em `comunidade.tsx` (`17.1`/`17.2`/`17.3`/`22.7`), `perfil.tsx` (`22.3`/`22.5`/`19.2`), `explorar.tsx` (`10.2`/`22.1`), `destino.$destinationId.tsx` (`10.1`/`10.4`/`11.3`) e `parceiro.$partnerId.tsx` (`11.3`/`22.7`).
