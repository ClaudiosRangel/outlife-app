# Requirements Document

## Introduction

Esta feature conecta dois sistemas hoje independentes do OutLife — o
**rastreamento de atividade** (GPS ao vivo durante uma caminhada/pedalada/
trilha) e o **compartilhamento de localização** entre amigos — para oferecer
uma experiência de "amigos em atividade ao vivo".

Objetivo do usuário (pedido original): *"Preciso que mostre, abaixo do mapa,
uma relação dos amigos que estão em atividade compartilhada; ao clicar neles,
leva para o mapa em tempo real com o avatar."*

Concretamente, a feature entrega três blocos:

1. **Publicação ao vivo durante o rastreamento** — enquanto um usuário rastreia
   uma atividade (User_Activity `in_progress`), a posição ao vivo dele passa a
   ficar disponível para os amigos verem (respeitando o consentimento de
   privacidade), e ele fica marcado como "em atividade ao vivo".
2. **Lista de amigos em atividade abaixo do mapa** — na tela Explorar, logo
   abaixo do MapView compacto, aparece uma relação dos amigos que estão
   atualmente em atividade ao vivo (avatar, nome, tipo de atividade e recência
   "ao vivo"). Quando ninguém está em atividade, um estado vazio apropriado é
   exibido.
3. **Toque leva ao mapa em tempo real** — ao tocar num amigo da lista, o mapa
   centraliza na posição ao vivo dele, com o avatar em destaque, e a posição
   se atualiza em (quase) tempo real enquanto o amigo se move.

A feature reaproveita a infraestrutura existente (colunas de localização em
`public.profiles`, VIEW `public.public_user_locations` com `security_invoker`,
função `public.are_friends`, componente `MapView`, hooks
`use-activity-tracker` e `use-location-sharing`) e adiciona apenas o mínimo
necessário para distinguir "amigo parado compartilhando" de "amigo em
atividade ao vivo".

### Decisões registradas

Os pontos que estavam em aberto foram resolvidos e passam a valer como
decisões de requisito (referenciados ao longo do documento como **[DECISÃO]**):

- **[DECISÃO-A] Consentimento — RESOLVIDO**: a feature reaproveita o
  `location_sharing_mode` existente (`none | friends | public`) como base de
  visibilidade e consentimento, evitando criar um segundo modelo de
  privacidade. O Live_Activity_Consent passa a significar concretamente:
  `location_sharing_mode` diferente de `none` (ou seja, `friends` ou `public`).
  A visibilidade permanece condicional à amizade aceita quando o modo do
  publicador é `friends`, exatamente como a Public_User_Locations_View já
  define.
- **[DECISÃO-B] Limiar de recência "ao vivo" — RESOLVIDO**: o
  Live_Recency_Window é de **120 segundos (2 minutos)**, equilibrando
  atualidade com tolerância a variação de GPS/rede.
- **[DECISÃO-C] Cadência de publicação durante a atividade — RESOLVIDO**: a
  posição ao vivo é publicada a cada **~15 segundos** enquanto o rastreamento
  está ativo (throttle) — bem mais frequente que os 3 min do compartilhamento
  estático, sem publicar a cada ponto de GPS capturado.
- **[DECISÃO-D] Marcação de "em atividade" — RESOLVIDO**: o estado "ao vivo" é
  **derivado** da existência de uma User_Activity com status `in_progress` mais
  uma posição recente (dentro do Live_Recency_Window), sem flag redundante em
  `profiles`. A VIEW/consulta que alimenta a Live_Friends_List precisa expor o
  `activity_type` e o vínculo com a User_Activity `in_progress`. Se durante o
  design um campo auxiliar se mostrar necessário, isso será tratado lá; nos
  requisitos, a derivação é a abordagem fixada.
- **[DECISÃO-E] Encerramento — RESOLVIDO**: o amigo deixa de aparecer como
  "ao vivo" quando ocorrer qualquer uma das condições: a User_Activity sai de
  `in_progress` (finalizada ou descartada), OU o rastreamento é pausado e
  nenhuma nova posição é publicada, OU a posição ultrapassa o
  Live_Recency_Window, OU a permissão de localização é perdida.

---

## Glossary

- **OutLife**: aplicativo de aventuras ao ar livre (React + TanStack Router,
  Supabase como backend, Capacitor para empacotamento nativo).
- **Explore_Screen**: a tela Explorar (`src/routes/explorar.tsx`), que monta o
  `MapView` compacto e é onde a lista de amigos em atividade deve aparecer
  abaixo do mapa.
- **MapView**: componente de mapa Leaflet compacto (`src/components/MapView.tsx`)
  que renderiza destinos e marcadores de avatar dos amigos que compartilham
  localização; expõe `mapRef` (`L.Map`) com `setView`.
- **Activity_Tracker**: o rastreador de atividade
  (`src/hooks/use-activity-tracker.ts`), com status `idle | tracking | paused |
  saving`, que captura posições via Native_Location_Tracking_Module (Capacitor)
  ou Web Geolocation API.
- **User_Activity**: um registro de atividade em `public.user_activities`, com
  `activity_type` (`caminhada | pedalada | trilha | outro`) e status
  (`in_progress | completed`).
- **Location_Sharing**: o compartilhamento estático de localização
  (`src/hooks/use-location-sharing.ts`), que grava posição em `profiles` a cada
  3 min ou sob demanda, conforme `location_sharing_mode`.
- **Location_Sharing_Mode**: o modo de compartilhamento em
  `profiles.location_sharing_mode`, do tipo enum `none | friends | public`.
- **Shared_Location**: o tipo retornado por `fetchSharedUserLocations()`
  (SELECT na VIEW `public.public_user_locations`), com os campos `id`,
  `full_name`, `username`, `avatar_url`, `latitude`, `longitude`,
  `location_updated_at`, `location_sharing_mode`.
- **Public_User_Locations_View**: a VIEW `public.public_user_locations`
  (`security_invoker=on`) que só retorna linhas com latitude/longitude não
  nulas, `location_updated_at` dentro das últimas 24h, e visibilidade conforme
  modo `public`, ou `friends` com amizade aceita, ou o próprio usuário.
- **Friendship**: relação em `public.user_friends` com `status = 'accepted'`,
  avaliada pela função `public.are_friends(a, b)`.
- **Live_Activity_Publisher**: o mecanismo (a ser definido no design) que, com
  consentimento, publica a posição ao vivo do usuário durante o rastreamento,
  conectando o Activity_Tracker ao Location_Sharing.
- **Live_Activity_Friend**: um amigo visível ao usuário conforme a
  Public_User_Locations_View (modo `public`, ou modo `friends` com Friendship
  aceita) que está atualmente em atividade ao vivo — estado derivado da
  existência de uma User_Activity `in_progress` mais uma posição atualizada
  dentro do Live_Recency_Window.
- **Live_Recency_Window**: a janela de recência de **120 segundos (2 minutos)**
  desde a última atualização de posição dentro da qual o amigo é considerado
  "ao vivo" (**[DECISÃO-B]**).
- **Live_Publish_Interval**: a cadência de publicação da posição ao vivo
  durante o rastreamento, de **~15 segundos** (throttle), aplicada pelo
  Live_Activity_Publisher (**[DECISÃO-C]**).
- **Live_Friends_List**: a relação de Live_Activity_Friend exibida abaixo do
  MapView na Explore_Screen.
- **Live_Activity_Consent**: o consentimento que autoriza a publicação da
  posição ao vivo do usuário para amigos durante o rastreamento. Reaproveita o
  Location_Sharing_Mode: está concedido quando `location_sharing_mode` é
  diferente de `none` (ou seja, `friends` ou `public`) (**[DECISÃO-A]**).

---

## Requirements

### Requirement 1: Distinguir amigo em atividade ao vivo de amigo parado

**User Story:** Como usuário do OutLife, quero diferenciar amigos que estão
atualmente em uma atividade rastreada ao vivo dos amigos que apenas
compartilham a localização estática, para focar em quem está se movimentando
agora.

#### Acceptance Criteria

1. THE OutLife SHALL classificar como Live_Activity_Friend um amigo que possua
   uma User_Activity com status `in_progress` E cuja posição tenha sido
   atualizada dentro do Live_Recency_Window.
2. IF um amigo não possui User_Activity `in_progress` OU não possui posição
   atualizada dentro do Live_Recency_Window, THEN THE OutLife SHALL classificar
   esse amigo como compartilhamento estático e NÃO como Live_Activity_Friend,
   independentemente de o amigo estar compartilhando localização (a distinção
   entre estático e ao vivo é dada pelo estado de atividade mais a recência da
   posição, não pela presença ou ausência de compartilhamento).
3. WHERE uma User_Activity `in_progress` está associada a um Live_Activity_Friend,
   THE OutLife SHALL disponibilizar o `activity_type` dessa User_Activity para
   exibição na Live_Friends_List.
4. IF a última atualização de posição de um amigo em atividade ultrapassa o
   Live_Recency_Window de 120 segundos, THEN THE OutLife SHALL reclassificar
   imediatamente esse amigo como compartilhamento estático, deixando de
   classificá-lo como Live_Activity_Friend mesmo que a User_Activity permaneça
   `in_progress`.
5. THE OutLife SHALL derivar o sinal de "em atividade ao vivo" da existência de
   uma User_Activity `in_progress` mais uma posição atualizada dentro do
   Live_Recency_Window, sem depender de flag dedicada em `profiles`.

> Live_Recency_Window fixado em 120 segundos (**[DECISÃO-B]**) e marcação
> derivada da User_Activity `in_progress` (**[DECISÃO-D]**).

### Requirement 2: Publicar a posição ao vivo durante o rastreamento

**User Story:** Como usuário que está rastreando uma atividade, quero que
minha posição ao vivo fique disponível para meus amigos enquanto eu me
movimento, respeitando minha privacidade, para que eles possam me acompanhar.

#### Acceptance Criteria

1. WHILE o Activity_Tracker está no status `tracking` E o Live_Activity_Consent
   está concedido, THE Live_Activity_Publisher SHALL publicar a posição atual do
   usuário (latitude, longitude, `location_updated_at`) de forma visível aos
   amigos.
2. IF o Live_Activity_Consent não está concedido (`location_sharing_mode` igual
   a `none`), THEN THE Live_Activity_Publisher SHALL impedir qualquer tentativa
   de publicação da posição ao vivo, não iniciando a obtenção nem o envio da
   posição para amigos.
3. WHILE o Activity_Tracker está no status `tracking` E o Live_Activity_Consent
   está concedido, THE Live_Activity_Publisher SHALL publicar a posição ao vivo
   respeitando o Live_Publish_Interval de ~15 segundos.
4. WHEN o usuário obtém uma nova posição durante o rastreamento E a cadência de
   publicação foi atingida, THE Live_Activity_Publisher SHALL atualizar
   `location_updated_at` para o instante da nova posição.
5. IF a obtenção da posição durante o rastreamento falha, THEN THE
   Live_Activity_Publisher SHALL manter a última posição publicada sem
   sobrescrevê-la com dados inválidos.
6. THE Live_Activity_Publisher SHALL determinar a autorização de publicação a
   partir do Location_Sharing_Mode, considerando o consentimento concedido
   quando o modo é `friends` ou `public` e negado quando o modo é `none`.

> Consentimento reaproveita Location_Sharing_Mode (**[DECISÃO-A]**) e cadência
> fixada no Live_Publish_Interval de ~15 segundos (**[DECISÃO-C]**).

### Requirement 3: Exibir a lista de amigos em atividade abaixo do mapa

**User Story:** Como usuário na tela Explorar, quero ver logo abaixo do mapa
uma relação dos amigos que estão em atividade ao vivo, para descobrir com
quem posso me conectar naquele momento.

#### Acceptance Criteria

1. WHILE a Explore_Screen está visível, THE Live_Friends_List SHALL ser exibida
   abaixo do MapView.
2. WHEN existe ao menos um Live_Activity_Friend visível ao usuário, THE
   Live_Friends_List SHALL exibir, para cada Live_Activity_Friend, o avatar, o
   nome (`full_name` ou `username` como alternativa) e o `activity_type` da
   atividade em andamento.
3. WHEN existe ao menos um Live_Activity_Friend visível ao usuário, THE
   Live_Friends_List SHALL exibir, para cada Live_Activity_Friend, um indicador
   de recência derivado de `location_updated_at` (por exemplo, "ao vivo" quando
   dentro do Live_Recency_Window de 120 segundos, ou "há N minutos").
4. IF não existe nenhum Live_Activity_Friend visível ao usuário, THEN THE
   Live_Friends_List SHALL exibir um estado vazio com mensagem apropriada.
5. THE Live_Friends_List SHALL excluir o próprio usuário da relação de amigos
   exibida.
6. WHEN a posição ou o conjunto de Live_Activity_Friend muda no servidor, THE
   Live_Friends_List SHALL atualizar a relação exibida sem exigir recarga manual
   da Explore_Screen.

> Reaproveitamento sugerido: a chave i18n `search.activeNow` ("Amigos em
> atividade" / "Friends active now") já existe e pode servir de título da
> Live_Friends_List. Live_Recency_Window de 120 segundos aplicado ao critério 3
> (**[DECISÃO-B]**).

### Requirement 4: Centralizar o mapa na posição ao vivo ao tocar em um amigo

**User Story:** Como usuário, quero tocar em um amigo da lista e ver o mapa
centralizar na posição ao vivo dele com o avatar em destaque, para acompanhar
onde ele está.

#### Acceptance Criteria

1. WHEN o usuário toca em um Live_Activity_Friend na Live_Friends_List, THE
   MapView SHALL centralizar a visão (`setView`) na posição ao vivo desse amigo
   com um nível de zoom aproximado de rua.
2. WHEN o usuário toca em um Live_Activity_Friend na Live_Friends_List, THE
   MapView SHALL destacar o marcador desse amigo exibindo o avatar dele.
3. WHILE um Live_Activity_Friend está selecionado E permanece em atividade ao
   vivo, THE MapView SHALL atualizar a posição do marcador desse amigo conforme
   novas posições ficam disponíveis, sem intervenção do usuário.
4. IF o Live_Activity_Friend selecionado deixa de estar ao vivo por qualquer uma
   das condições de encerramento (a User_Activity saiu de `in_progress` —
   finalizada ou descartada; OU o rastreamento foi pausado e nenhuma nova
   posição foi publicada; OU a posição ultrapassou o Live_Recency_Window de 120
   segundos; OU a permissão de localização foi perdida), THEN THE MapView SHALL
   indicar ao usuário que a posição ao vivo não está mais disponível.
5. WHEN o usuário toca em um Live_Activity_Friend, THE Explore_Screen SHALL
   manter disponível o acesso ao perfil desse amigo (rota `/parceiro/$partnerId`),
   de forma consistente com o popup de marcador já existente no MapView.

> Condições de encerramento definidas no critério 4 (**[DECISÃO-E]**).

### Requirement 5: Respeitar privacidade e visibilidade

**User Story:** Como usuário do OutLife, quero que apenas as pessoas
autorizadas vejam minha posição ao vivo, para manter minha privacidade durante
uma atividade.

#### Acceptance Criteria

1. THE OutLife SHALL condicionar a visibilidade da posição ao vivo de um usuário
   ao modo de compartilhamento do publicador combinado com a Friendship,
   conforme a Public_User_Locations_View: visível quando o modo é `public`, ou
   quando o modo é `friends` E existe Friendship aceita entre publicador e
   observador, ou quando o observador é o próprio publicador.
2. IF o modo do publicador é `friends` E não existe Friendship aceita entre
   publicador e observador, THEN THE OutLife SHALL manter a posição ao vivo do
   publicador oculta para esse observador.
3. THE OutLife SHALL considerar como candidata a "ao vivo" apenas uma posição
   cuja `location_updated_at` esteja dentro do Live_Recency_Window de 120
   segundos.
4. THE OutLife SHALL preservar a regra existente da Public_User_Locations_View
   de ocultar posições com `location_updated_at` anterior a 24 horas.
5. WHEN o usuário revoga o Live_Activity_Consent alterando o
   `location_sharing_mode` para `none`, THE OutLife SHALL cessar a exposição da
   posição ao vivo desse usuário aos amigos.

> Visibilidade reaproveita Location_Sharing_Mode (**[DECISÃO-A]**) e
> Live_Recency_Window fixado em 120 segundos (**[DECISÃO-B]**).

### Requirement 6: Qualidade — consumo de bateria e rede durante a atividade

**User Story:** Como usuário rastreando uma atividade, quero que o
compartilhamento ao vivo não degrade excessivamente a bateria nem o consumo de
dados, para conseguir completar minha atividade.

#### Acceptance Criteria

1. WHILE o Activity_Tracker está no status `tracking` E o Live_Activity_Consent
   está concedido, THE Live_Activity_Publisher SHALL limitar a frequência de
   publicação ao Live_Publish_Interval de ~15 segundos, evitando publicar a cada
   ponto de GPS capturado.
2. WHILE o Activity_Tracker está no status `paused`, THE Live_Activity_Publisher
   SHALL suspender novas publicações de posição ao vivo, o que leva o amigo a
   deixar de ser Live_Activity_Friend assim que a última posição publicada
   ultrapassa o Live_Recency_Window.
3. WHEN a Explore_Screen consulta a Live_Friends_List, THE OutLife SHALL reutilizar
   o mecanismo de atualização periódica já existente para `["shared-locations"]`
   em vez de introduzir polling adicional redundante.
4. IF a conectividade de rede está indisponível durante o rastreamento, THEN
   THE Live_Activity_Publisher SHALL adiar a publicação sem interromper a captura
   local de pontos pelo Activity_Tracker.

> Cadência fixada no Live_Publish_Interval de ~15 segundos (**[DECISÃO-C]**).

### Requirement 7: Persistência de dados no Supabase

**User Story:** Como mantenedor do OutLife, quero que qualquer nova estrutura
de dados necessária siga o padrão de migração do repositório, para que a
funcionalidade opere corretamente em produção sem quebrar o que já existe.

#### Acceptance Criteria

1. WHERE a feature exige novas colunas, funções ou alteração da
   Public_User_Locations_View, THE OutLife SHALL introduzir essas mudanças em um
   novo arquivo de migração timestampado em `supabase/migrations/`.
2. THE OutLife SHALL escrever a migração de forma idempotente (por exemplo,
   `ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP ... IF EXISTS`).
3. THE OutLife SHALL preservar as migrações já aplicadas sem editá-las.
4. IF uma migração já aplicada é modificada, THEN THE OutLife SHALL detectar a
   alteração e bloquear o deploy, impedindo a aplicação de uma migração
   divergente da versão já aplicada.
5. WHERE a Public_User_Locations_View é alterada, THE OutLife SHALL manter a
   propriedade `security_invoker=on` e as regras de visibilidade existentes.
