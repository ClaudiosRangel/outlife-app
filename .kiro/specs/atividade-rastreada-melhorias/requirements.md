# Requirements Document

Melhorias na Atividade Rastreada

## Introduction

Este documento especifica um conjunto de melhorias para a funcionalidade de
**Atividade Rastreada** (rastreamento GPS de atividades outdoor) do OutLife.
As melhorias cobrem: correção de dados que hoje se perdem, feedback de pausa
automática no estilo Strava, compartilhamento automático da atividade na
comunidade, proteção contra logout com atividade em andamento, e notificação
de amigos ao concluir uma atividade.

A funcionalidade atual está implementada em `src/routes/atividade.rastrear.tsx`,
`src/routes/atividade.$activityId.tsx`, `src/hooks/use-activity-tracker.ts`,
`src/hooks/use-activity-sync.ts`, `src/lib/activity-*.ts`,
`src/components/ActivityMap.tsx`, `src/lib/api.ts`, e nas migrations em
`supabase/migrations/`. Este spec estende essa base sem reescrevê-la.

## Glossary

- **User_Activity**: registro de uma atividade rastreada, persistido em
  `public.user_activities` (Supabase). Possui `status` (`in_progress` /
  `completed`), trajeto (`route_geojson`), distância, duração, tipo, etc.
- **Activity_Tracker**: o hook `use-activity-tracker.ts` que gerencia o estado
  do rastreamento (GPS, timer, distância, elevação, pausas, persistência local).
- **Activity_Type**: classificação da atividade — `caminhada`, `pedalada`,
  `trilha` ou `outro`.
- **Auto_Pause**: pausa automática do timer disparada por inatividade
  (ausência de deslocamento significativo por um intervalo), sem interromper
  a captura de pontos GPS.
- **Elevation_Gain**: ganho de elevação acumulado (soma apenas de subidas),
  hoje calculado e exibido ao vivo mas não persistido.
- **Activity_Map_Snapshot**: imagem estática (WebP) do trajeto, gerada ao
  finalizar e salva em `user_activities.map_snapshot_url`.
- **Community_Post**: publicação da comunidade, persistida em
  `public.community_posts`, com `category` (Community_Post_Category), texto,
  local, imagem e autor.
- **Community_Post_Category**: categoria de uma publicação — `trilha`,
  `camping`, `relato`, `outro`, `pedalada`, `caminhada`.
- **Friendship**: relação de amizade entre dois usuários em
  `public.user_friends` (ou equivalente), com `status` `accepted` / `pending`.
- **Notification**: registro em `public.notifications` (`recipient_id`,
  `type`, `payload`), com trigger `fn_dispatch_push_notification` que dispara
  o Push_Notification correspondente automaticamente após o INSERT.
- **Sync_Queue**: fila offline em IndexedDB (`activity-storage.ts`) de
  atividades finalizadas que ainda não foram sincronizadas com o servidor.
- **Offline_Sync**: o processo de esvaziar a Sync_Queue quando há conexão
  (`use-activity-sync.ts` / `flushQueue`).

---

## Requirements

### Requirement 1: Persistência do ganho de elevação

**User Story:** Como usuário que registra trilhas com variação de altitude,
quero que o ganho de elevação apareça também no resumo final da atividade,
para que essa métrica não se perca depois que eu finalizo.

#### Acceptance Criteria

1. QUANDO uma User_Activity é finalizada com um Elevation_Gain acumulado
   maior que zero, ENTÃO a OutLife_Application DEVE persistir esse valor
   junto com a User_Activity.
2. QUANDO a Activity_Detail_Screen exibe uma User_Activity que possui
   Elevation_Gain persistido maior que zero, ENTÃO ela DEVE exibir o ganho
   de elevação arredondado ao metro inteiro.
3. QUANDO a Activity_Detail_Screen exibe uma User_Activity sem Elevation_Gain
   persistido (ausente ou zero), ENTÃO ela DEVE exibir um indicador de
   indisponibilidade ("—"), nunca `NaN` nem `0m` derivado de dado ausente.
4. QUANDO uma User_Activity é sincronizada pela Sync_Queue (fluxo offline),
   ENTÃO o Elevation_Gain, QUANDO disponível na fila, DEVE ser persistido
   junto com os demais dados da atividade.

### Requirement 2: Preservação de Activity_Type e Activity_Map_Snapshot no fluxo offline

**User Story:** Como usuário que finaliza uma atividade sem conexão, quero
que o tipo da atividade e o mapa do trajeto sejam preservados, para que a
atividade sincronizada fique completa como se tivesse sido salva online.

#### Acceptance Criteria

1. QUANDO uma User_Activity é finalizada offline e enfileirada na Sync_Queue,
   ENTÃO a OutLife_Application DEVE incluir o Activity_Type na entrada
   enfileirada.
2. QUANDO uma User_Activity é finalizada offline e enfileirada na Sync_Queue,
   ENTÃO a OutLife_Application DEVE incluir a referência ao Activity_Map_Snapshot
   (ou os dados necessários para gerá-lo/enviá-lo na sincronização) na
   entrada enfileirada.
3. QUANDO a Offline_Sync sincroniza uma entrada da Sync_Queue que possui
   Activity_Type, ENTÃO ela DEVE persistir esse Activity_Type na User_Activity.
4. QUANDO a Offline_Sync sincroniza uma entrada da Sync_Queue que possui
   Activity_Map_Snapshot pendente, ENTÃO ela DEVE fazer o upload e persistir
   a URL na User_Activity.
5. SE o upload do Activity_Map_Snapshot falhar durante a Offline_Sync, ENTÃO
   a sincronização da User_Activity NÃO DEVE ser bloqueada por esse motivo —
   apenas o snapshot fica ausente.

### Requirement 3: Feedback visual de pausa automática (estilo Strava)

**User Story:** Como usuário rastreando uma atividade, quero ser avisado
claramente quando o app pausa automaticamente por inatividade, para saber
que o cronômetro parou e que voltará a contar quando eu me mover.

#### Acceptance Criteria

1. QUANDO o Auto_Pause é disparado durante o rastreamento, ENTÃO a
   OutLife_Application DEVE exibir um indicador visual explícito de
   "pausado automaticamente", distinto do estado de pausa manual.
2. ENQUANTO o Auto_Pause estiver ativo, a OutLife_Application DEVE manter o
   indicador visível até que o movimento seja retomado ou o usuário aja
   manualmente.
3. QUANDO o movimento é detectado novamente e o rastreamento retoma
   automaticamente, ENTÃO a OutLife_Application DEVE remover o indicador de
   pausa automática.
4. QUANDO o usuário pausa manualmente (botão "Pausar"), ENTÃO a
   OutLife_Application NÃO DEVE exibir o indicador de pausa automática — o
   estado exibido DEVE refletir a pausa manual.
5. QUANDO o Auto_Pause está ativo e o usuário aciona uma ação manual
   (retomar, finalizar ou descartar), ENTÃO essa ação DEVE ter precedência
   sobre o estado de pausa automática.

### Requirement 4: Compartilhamento automático da atividade na comunidade

**User Story:** Como usuário que finaliza uma atividade, quero que ela seja
publicada automaticamente na comunidade, para compartilhar meu progresso com
os outros usuários sem precisar postar manualmente.

#### Acceptance Criteria

1. QUANDO uma User_Activity é finalizada e salva com sucesso, ENTÃO a
   OutLife_Application DEVE criar um Community_Post correspondente a essa
   atividade.
2. QUANDO o Community_Post da atividade é criado, ENTÃO sua Community_Post_Category
   DEVE ser derivada do Activity_Type da atividade QUANDO houver correspondência
   direta (`caminhada`, `pedalada`, `trilha`), e `outro` nos demais casos.
3. QUANDO o Community_Post da atividade é criado, ENTÃO ele DEVE usar o
   Activity_Map_Snapshot como imagem QUANDO disponível.
4. QUANDO o Community_Post da atividade é criado, ENTÃO seu texto DEVE
   conter as métricas principais da atividade (distância e duração) e a
   descrição informada pelo usuário QUANDO houver.
5. SE a criação do Community_Post falhar, ENTÃO a User_Activity finalizada
   NÃO DEVE ser perdida nem revertida — a falha da publicação DEVE ser
   isolada do salvamento da atividade.
6. QUANDO a User_Activity foi salva offline (Sync_Queue), ENTÃO o
   Community_Post correspondente DEVE ser criado no momento da Offline_Sync
   bem-sucedida, não antes.

### Requirement 5: Notificar amigos ao concluir uma atividade

**User Story:** Como usuário, quero que meus amigos sejam notificados quando
eu concluir uma atividade, para que eles acompanhem minhas aventuras.

#### Acceptance Criteria

1. QUANDO uma User_Activity é finalizada e salva com sucesso, ENTÃO a
   OutLife_Application DEVE criar uma Notification para cada usuário que
   tenha Friendship com status `accepted` com o autor da atividade.
2. QUANDO a Notification de atividade concluída é criada, ENTÃO seu `payload`
   DEVE conter os dados necessários para identificar o autor e a atividade
   (id do autor e id da User_Activity).
3. QUANDO a Notification de atividade concluída é criada, ENTÃO ela DEVE
   disparar o Push_Notification correspondente aos dispositivos ativos do
   destinatário, pelo mesmo mecanismo já existente
   (`fn_dispatch_push_notification`).
4. QUANDO a Notification de atividade concluída é exibida na tela de
   notificações do destinatário, ENTÃO ela DEVE apresentar quem concluiu a
   atividade e um texto descritivo, e ao ser tocada DEVE levar aos detalhes
   dessa atividade.
5. QUANDO o autor não possui nenhum amigo com Friendship `accepted`, ENTÃO
   nenhuma Notification de atividade concluída DEVE ser criada.
6. SE a criação das Notifications falhar, ENTÃO a User_Activity finalizada
   NÃO DEVE ser perdida nem revertida — a falha DEVE ser isolada do
   salvamento da atividade.
7. QUANDO a User_Activity foi salva offline (Sync_Queue), ENTÃO as
   Notifications aos amigos DEVEM ser criadas no momento da Offline_Sync
   bem-sucedida.
8. SE a criação das Notifications de uma atividade concluída online falhar,
   ENTÃO a OutLife_Application NÃO DEVE reprocessar/repetir o envio dessas
   Notifications — a falha é definitiva para aquela finalização.

### Requirement 6: Bloqueio de logout com atividade em andamento

**User Story:** Como usuário com uma atividade em andamento, quero ser
impedido de sair do app sem antes finalizar ou descartar a atividade, para
não perder acidentalmente um rastreamento em progresso.

#### Acceptance Criteria

1. ENQUANTO existir uma User_Activity com rastreamento em andamento (estado
   `tracking` ou `paused`, incluindo Auto_Pause), QUANDO o usuário aciona o
   logout, ENTÃO a OutLife_Application DEVE impedir o logout imediato e
   informar que há uma atividade em andamento.
2. QUANDO o logout é impedido por atividade em andamento, ENTÃO a
   OutLife_Application DEVE oferecer ao usuário as opções de finalizar ou
   descartar a atividade antes de sair.
3. QUANDO o usuário finaliza a atividade em andamento, ENTÃO o logout
   subsequente DEVE ser permitido.
4. QUANDO o usuário descarta a atividade em andamento, ENTÃO o logout
   subsequente DEVE ser permitido.
5. QUANDO não existe nenhuma User_Activity com rastreamento em andamento,
   ENTÃO o logout DEVE ocorrer normalmente, sem bloqueio nem confirmação
   adicional relativa a atividade.
6. QUANDO o logout é impedido por atividade em andamento, ENTÃO a sessão do
   usuário DEVE permanecer ativa e nenhum efeito de logout (ex.: invalidação
   de push, navegação para login) DEVE ocorrer.
