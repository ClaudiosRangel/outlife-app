# Requirements Document

## Introduction

A OutLife_Application é um marketplace outdoor colaborativo (React 19 + TanStack Router/Start, backend Supabase) em produção na Vercel (`https://outlife-app.vercel.app/`). Uma auditoria completa do código-fonte identificou um conjunto de funcionalidades cujo backend (tabelas, RLS, funções em `src/lib/api.ts`) já existe e funciona, mas que não estão conectadas a nenhuma tela; elementos de interface que aparentam ser funcionais mas são puramente decorativos ou usam dados fixos (mock); e telas inteiras que precisam ser criadas para que essas funcionalidades de backend se tornem utilizáveis.

Este spec formaliza o trabalho de completar essas funcionalidades, cobrindo:

1. Conectar funcionalidades de backend já existentes (salvar destino, favoritar parceiro, amizades, gestão de serviços do parceiro, sugestão de destino) a uma interface real.
2. Corrigir o link quebrado dos cards de destino em `/explorar`, que hoje leva ao marketplace em vez de a uma tela de detalhe do destino — tela essa que precisa ser criada.
3. Substituir por persistência real os elementos de comunidade que hoje só existem em estado local do navegador (curtir, seguir, comentar), incluindo a criação de um sistema de comentários do zero (tabela, RPC e UI), respeitando o trigger de banco que já bloqueia alteração direta dos contadores de `community_posts`.
4. Criar as telas que hoje não existem: detalhe de destino, gestão de serviços do parceiro, amigos, notificações, configurações de perfil.
5. Substituir o fluxo de aprovação Cadastur, hoje 100% simulado (`setTimeout` que sempre aprova), por um fluxo real com um novo papel `admin` e uma tela de moderação dentro do próprio app.
6. Remover ou documentar explicitamente outros elementos decorativos menores (filtros de exploração, sino de notificação, gráfico do painel do parceiro, contadores de seguidores/seguindo, previsão do tempo da próxima aventura).

Funcionalidades já 100% funcionais (checklist, cadastro/login/logout, avaliação de parceiro, rastreamento de atividade, upload de foto, rate limiting, achievements de leitura) não são reabertas por este spec e servem apenas como referência de padrão de qualidade a ser seguido.

## Glossary

- **OutLife_Application**: a aplicação web OutLife (React 19 + TanStack Router/Start), cujo código-fonte reside no OutLife_Repository.
- **OutLife_Repository**: o repositório Git do usuário contendo o código-fonte da OutLife_Application.
- **Production_Supabase_Project**: o projeto Supabase em uso pela OutLife_Application em produção.
- **Destination_Detail_Screen**: a nova tela de detalhe de um destino turístico (rota `/destino/$destinationId`), exibindo descrição completa, avaliações e ações de salvar/avaliar.
- **Saved_Destination_Action**: a ação do usuário de salvar ou remover um destino da sua lista de destinos salvos, através das funções `saveDestination`/`unsaveDestination` já existentes.
- **Favorite_Partner_Action**: a ação do usuário de favoritar ou desfavoritar um parceiro, através das funções `favoritePartner`/`unfavoritePartner` já existentes.
- **Friendship**: um relacionamento de amizade entre dois usuários da OutLife_Application, persistido na tabela `user_friends`, com estado `pending` (solicitado) ou `accepted` (aceito).
- **Friends_Screen**: a nova tela para buscar pessoas, enviar e aceitar solicitações de Friendship, e visualizar a lista de amigos aceitos.
- **Partner_Service**: um serviço oferecido por um parceiro, persistido na tabela `services`, associado a um destino, com título, descrição, preço e imagens.
- **Partner_Service_Management_Screen**: a seção do painel do parceiro (`/parceiro/painel`) para criar, editar e remover Partner_Service.
- **Pending_Destination_Suggestion**: um destino criado por um usuário autenticado com status `pending`, através da função `createPendingDestination` já existente, aguardando aprovação para se tornar um destino `approved` visível publicamente.
- **Community_Post**: uma publicação da comunidade, persistida na tabela `community_posts`, com contadores `likes` e `comments_count` protegidos por um trigger de banco (`prevent_post_counter_tampering`) que impede alteração direta desses contadores via `UPDATE`.
- **Post_Like**: o estado de "curtido" de um Community_Post por um usuário autenticado específico, que deve ser persistido de forma que sobreviva a um recarregamento de página.
- **Toggle_Post_Like_Function**: uma nova função de banco de dados (RPC), dedicada a alternar um Post_Like de forma atômica e incrementar/decrementar o contador `likes` de um Community_Post, contornando a restrição do trigger `prevent_post_counter_tampering` de forma segura (a própria função, executando como definidora, é o único caminho autorizado a alterar o contador).
- **Post_Follow**: o estado de "seguindo" o autor de um Community_Post por um usuário autenticado específico, que deve ser persistido de forma que sobreviva a um recarregamento de página.
- **Post_Comment**: um comentário associado a um Community_Post, feito por um usuário autenticado, com texto e referência ao autor — uma entidade nova, sem tabela ou função de banco existente até este spec.
- **Notification**: um evento relevante para um usuário (ex: nova solicitação de Friendship recebida) que deve ser listado na Notifications_Screen — uma entidade nova, sem tabela existente até este spec.
- **Notifications_Screen**: a nova tela acessível pelo sino de notificação na página inicial, listando as Notification do usuário autenticado.
- **Profile_Settings_Screen**: a nova tela acessível pelo ícone de engrenagem em `/perfil`, permitindo troca de foto de perfil e edição de dados pessoais do usuário autenticado.
- **Cadastur_Verification_Request**: uma solicitação de verificação Cadastur submetida por um parceiro através da tela de compliance, persistida com status `pending`, `approved` ou `rejected` — uma entidade nova, sem tabela existente até este spec.
- **Admin_Role**: um novo papel de usuário (`admin`), distinto de `adventurer` e `partner`, autorizado a revisar e decidir Cadastur_Verification_Request.
- **Admin_Compliance_Screen**: a nova tela, acessível exclusivamente a usuários com Admin_Role, para listar Cadastur_Verification_Request pendentes e aprová-las ou rejeitá-las.

## Requirements

### Requirement 1: Tela de detalhe de destino e correção do link em Explorar

**User Story:** Como usuário da OutLife_Application, quero abrir um destino a partir da tela de exploração e ver suas informações completas, avaliações e poder salvá-lo, para decidir se quero visitá-lo sem precisar navegar até o marketplace de parceiros.

#### Acceptance Criteria

1. THE OutLife_Application SHALL expor a Destination_Detail_Screen na rota `/destino/$destinationId`, exibindo nome, descrição, imagem principal, dificuldade, distância, duração, elevação e tipo do destino correspondente.
2. WHEN um usuário abre a Destination_Detail_Screen para um destino com status `approved`, THE Destination_Detail_Screen SHALL exibir a lista de avaliações desse destino obtida através de `fetchReviewsByDestination`, incluindo uma mensagem de lista vazia quando não houver nenhuma avaliação.
3. WHEN a Destination_Detail_Screen é aberta para um `destinationId` de um destino com status `approved`, THE Destination_Detail_Screen SHALL exibir o conteúdo completo desse destino independentemente de quem for o usuário autenticado.
4. WHEN a Destination_Detail_Screen é aberta por seu próprio criador para um `destinationId` de um Pending_Destination_Suggestion (status diferente de `approved`), THE Destination_Detail_Screen SHALL exibir o conteúdo completo desse destino, com indicação visual do status pendente.
5. IF a Destination_Detail_Screen é aberta para um `destinationId` inexistente, ou para um destino com status diferente de `approved` quando o usuário autenticado não for o criador desse destino, THEN THE OutLife_Application SHALL exibir uma mensagem de destino não encontrado, sem expor dados do registro.
6. WHEN um card de destino é selecionado na tela `/explorar`, THE OutLife_Application SHALL navegar para a Destination_Detail_Screen do destino selecionado, em vez de navegar para `/marketplace`.
7. WHEN um usuário autenticado seleciona a ação de avaliar na Destination_Detail_Screen e submete uma nota e comentário válidos, THE OutLife_Application SHALL persistir a avaliação através da função `submitReview` já existente, com `targetType` igual a `destination`.

### Requirement 2: Salvar destino e favoritar parceiro

**User Story:** Como usuário da OutLife_Application, quero salvar destinos e favoritar parceiros diretamente pela interface, para acessá-los depois na aba correspondente do meu perfil sem precisar procurá-los de novo.

#### Acceptance Criteria

1. THE Destination_Detail_Screen SHALL exibir um controle de Saved_Destination_Action, indicando visualmente se o destino já está salvo pelo usuário autenticado.
2. WHEN um usuário autenticado ativa o controle de Saved_Destination_Action em um destino ainda não salvo, THE OutLife_Application SHALL chamar `saveDestination` e SHALL atualizar o controle para o estado "salvo" após a confirmação da chamada.
3. WHEN um usuário autenticado ativa o controle de Saved_Destination_Action em um destino já salvo, THE OutLife_Application SHALL chamar `unsaveDestination` e SHALL atualizar o controle para o estado "não salvo" após a confirmação da chamada.
4. THE rota `/parceiro/$partnerId` SHALL exibir um controle de Favorite_Partner_Action no topo da galeria, indicando visualmente se o parceiro já está favoritado pelo usuário autenticado.
5. WHEN um usuário autenticado ativa o controle de Favorite_Partner_Action em um parceiro ainda não favoritado, THE OutLife_Application SHALL chamar `favoritePartner` e SHALL atualizar o controle para o estado "favoritado" após a confirmação da chamada.
6. WHEN um usuário autenticado ativa o controle de Favorite_Partner_Action em um parceiro já favoritado, THE OutLife_Application SHALL chamar `unfavoritePartner` e SHALL atualizar o controle para o estado "não favoritado" após a confirmação da chamada.
7. IF um usuário não autenticado ativa o controle de Saved_Destination_Action ou de Favorite_Partner_Action, THEN THE OutLife_Application SHALL solicitar que o usuário faça login, sem chamar `saveDestination`, `unsaveDestination`, `favoritePartner` ou `unfavoritePartner`.
8. WHEN os dados exibidos nas abas "Salvos" e "Favoritos" de `/perfil` são atualizados por uma Saved_Destination_Action ou Favorite_Partner_Action realizada em qualquer tela, THE OutLife_Application SHALL refletir essa mudança na próxima vez que essas abas forem exibidas.

### Requirement 3: Tela de amigos

**User Story:** Como usuário da OutLife_Application, quero buscar outras pessoas, enviar e aceitar solicitações de amizade, e ver minha lista de amigos, para poder usar o modo de compartilhamento de localização "amigos" que já existe no meu perfil.

#### Acceptance Criteria

1. THE OutLife_Application SHALL expor a Friends_Screen, acessível a partir de `/perfil`, listando os Friendship com estado `accepted` do usuário autenticado, obtidos através de `fetchFriends`.
2. THE Friends_Screen SHALL permitir buscar outros usuários da OutLife_Application por nome ou nome de usuário.
3. WHEN um usuário autenticado envia uma solicitação de Friendship para outro usuário a partir da Friends_Screen, THE OutLife_Application SHALL chamar `sendFriendRequest` e SHALL exibir essa solicitação com estado `pending` até que seja aceita.
4. WHEN um usuário autenticado aceita uma solicitação de Friendship pendente que recebeu, THE OutLife_Application SHALL chamar `acceptFriendRequest` e SHALL mover essa Friendship para a lista de amigos aceitos exibida na Friends_Screen.
5. WHEN um usuário autenticado remove um amigo já aceito, THE OutLife_Application SHALL chamar `removeFriend` e SHALL remover essa Friendship da lista de amigos exibida na Friends_Screen.
6. IF um usuário autenticado tentar enviar uma solicitação de Friendship para si mesmo ou para um usuário com quem já existe um Friendship (pendente ou aceito), THEN THE Friends_Screen SHALL impedir o envio e exibir uma mensagem explicando o motivo, sem chamar `sendFriendRequest`.
7. WHEN o modo de compartilhamento de localização "amigos" está ativo no perfil de um usuário autenticado, THE OutLife_Application SHALL disponibilizar essa localização a todos os usuários com Friendship em estado `accepted` com esse usuário, exclusivamente a eles, consistente com a função `are_friends` já existente no Production_Supabase_Project.

### Requirement 4: Gestão de serviços do parceiro

**User Story:** Como parceiro da OutLife_Application, quero criar, editar e remover os serviços que ofereço, para manter minha oferta atualizada sem depender de alteração manual no banco de dados.

#### Acceptance Criteria

1. THE painel do parceiro (`/parceiro/painel`) SHALL exibir a Partner_Service_Management_Screen, listando os Partner_Service do usuário autenticado obtidos através de `fetchMyServices`.
2. WHEN um parceiro autenticado submete um formulário de criação de Partner_Service com destino, título, descrição e preço válidos, THE OutLife_Application SHALL chamar `createService` e SHALL exibir o novo Partner_Service na Partner_Service_Management_Screen após a confirmação.
3. THE OutLife_Application SHALL remover um Partner_Service exclusivamente através de uma ação explícita do parceiro autenticado na Partner_Service_Management_Screen, chamando `deleteService` e removendo esse Partner_Service da lista exibida após a confirmação, sem removê-lo em resposta a nenhum outro evento do sistema.
4. IF o formulário de criação de Partner_Service for submetido sem um destino selecionado, sem título preenchido, com descrição vazia ou com preço ausente ou inválido, THEN THE Partner_Service_Management_Screen SHALL impedir a submissão e indicar todos os campos pendentes ou inválidos, sem chamar `createService`.
5. WHEN um Partner_Service é criado ou removido na Partner_Service_Management_Screen, THE rota pública `/parceiro/$partnerId` SHALL refletir essa mudança na lista de serviços exibida através de `fetchServicesByPartner` na próxima vez que essa rota for carregada.

### Requirement 5: Sugestão de novo destino

**User Story:** Como usuário da OutLife_Application, quero sugerir um novo destino que ainda não está cadastrado, para contribuir com a base de destinos da plataforma.

#### Acceptance Criteria

1. THE OutLife_Application SHALL expor um formulário de sugestão de destino, acessível a um usuário autenticado, coletando nome, descrição e localização geográfica do destino sugerido.
2. WHEN um usuário autenticado submete o formulário de sugestão de destino com nome e localização geográfica válidos e a chamada a `createPendingDestination` é concluída com sucesso, THE OutLife_Application SHALL confirmar ao usuário que a sugestão foi enviada para análise.
3. THE Pending_Destination_Suggestion criada por um usuário autenticado SHALL permanecer visível para esse usuário (com indicação de status pendente) mesmo antes de ser aprovada, consistente com a política de RLS já existente para destinos com `created_by` igual ao próprio usuário.
4. IF o formulário de sugestão de destino for submetido sem nome, sem localização geográfica válida, ou com qualquer outro campo em estado inválido segundo as regras de validação do formulário, THEN THE OutLife_Application SHALL impedir a submissão até que todos os campos estejam válidos, indicando os campos pendentes ou inválidos, sem chamar `createPendingDestination`.
5. IF a chamada a `createPendingDestination` falhar após a submissão do formulário, THEN THE OutLife_Application SHALL exibir uma mensagem de erro ao usuário, sem confirmar o envio da sugestão.

### Requirement 6: Persistência de curtidas em publicações da comunidade

**User Story:** Como usuário da OutLife_Application, quero que minhas curtidas em publicações da comunidade sejam salvas de verdade, para que elas continuem aparecendo depois que eu recarregar a página ou voltar mais tarde.

#### Acceptance Criteria

1. THE Production_Supabase_Project SHALL expor a Toggle_Post_Like_Function como uma RPC que, para um Community_Post e um usuário autenticado, alterna o Post_Like desse usuário e ajusta o contador `likes` do Community_Post de forma atômica.
2. WHEN um usuário autenticado ativa o controle de curtida em um Community_Post que ainda não curtiu, THE OutLife_Application SHALL chamar a Toggle_Post_Like_Function e SHALL exibir esse Community_Post como curtido, com o contador `likes` incrementado, após a confirmação da chamada.
3. WHEN um usuário autenticado ativa o controle de curtida em um Community_Post que já curtiu, THE OutLife_Application SHALL chamar a Toggle_Post_Like_Function e SHALL exibir esse Community_Post como não curtido, com o contador `likes` decrementado, após a confirmação da chamada.
4. WHEN a tela de comunidade é recarregada, THE OutLife_Application SHALL exibir o estado de Post_Like de cada Community_Post consistente com o que foi persistido pela Toggle_Post_Like_Function, em vez de reiniciar para o estado não curtido.
5. IF um usuário não autenticado ativa o controle de curtida em um Community_Post, THEN THE OutLife_Application SHALL solicitar que o usuário faça login, sem chamar a Toggle_Post_Like_Function.

### Requirement 7: Persistência de seguir autores da comunidade

**User Story:** Como usuário da OutLife_Application, quero que seguir um autor de publicação na comunidade seja salvo de verdade, para continuar seguindo essa pessoa depois de recarregar a página.

#### Acceptance Criteria

1. THE Production_Supabase_Project SHALL persistir o Post_Follow de um usuário autenticado em relação ao autor de um Community_Post, reaproveitando a Friendship existente ou uma estrutura equivalente já coberta por este spec, sem duplicar o conceito de amizade do Requirement 3.
2. WHEN um usuário autenticado ativa o controle de seguir no cabeçalho de um Community_Post de um autor que ainda não segue, THE OutLife_Application SHALL persistir esse Post_Follow e SHALL exibir o controle no estado "seguindo" após a confirmação.
3. WHEN um usuário autenticado ativa o controle de seguir no cabeçalho de um Community_Post de um autor que já segue, THE OutLife_Application SHALL remover esse Post_Follow e SHALL exibir o controle no estado "seguir" após a confirmação.
4. WHEN a tela de comunidade é recarregada, THE OutLife_Application SHALL exibir o estado do controle de seguir de cada Community_Post consistente com o Post_Follow persistido, em vez de reiniciar para o estado "seguir".
5. IF um usuário não autenticado ativa o controle de seguir em um Community_Post, THEN THE OutLife_Application SHALL solicitar que o usuário faça login, sem persistir nenhum Post_Follow.

### Requirement 8: Sistema de comentários em publicações da comunidade

**User Story:** Como usuário da OutLife_Application, quero comentar em publicações da comunidade e ver comentários reais de outras pessoas, para participar de conversas genuínas em vez de ver sempre os mesmos dois nomes fixos.

#### Acceptance Criteria

1. THE Production_Supabase_Project SHALL ter uma tabela dedicada a Post_Comment, associando cada registro a um Community_Post e a um usuário autenticado autor do comentário, protegida por políticas de RLS restringindo a criação de um Post_Comment ao próprio usuário autenticado.
2. WHEN um Community_Post é expandido na tela de comunidade, THE OutLife_Application SHALL exibir os Post_Comment reais associados a esse Community_Post, obtidos do Production_Supabase_Project, em vez da lista fixa de dois nomes atualmente exibida.
3. WHEN um usuário autenticado submete um comentário não vazio em um Community_Post, THE OutLife_Application SHALL persistir esse Post_Comment no Production_Supabase_Project e SHALL exibi-lo na lista de comentários desse Community_Post após a confirmação.
4. WHEN um Post_Comment é criado com sucesso para um Community_Post, THE Production_Supabase_Project SHALL incrementar o contador `comments_count` desse Community_Post de forma atômica, através de um mecanismo autorizado a contornar o trigger `prevent_post_counter_tampering` (consistente com o padrão da Toggle_Post_Like_Function do Requirement 6), sem permitir que esse incremento seja feito por um `UPDATE` direto do cliente.
5. IF um usuário não autenticado tenta submeter um comentário, THEN THE OutLife_Application SHALL solicitar que o usuário faça login, sem persistir nenhum Post_Comment.
6. IF o texto de um comentário submetido estiver vazio ou contiver apenas espaços em branco, THEN THE OutLife_Application SHALL impedir a submissão, sem persistir nenhum Post_Comment.

### Requirement 9: Notificações

**User Story:** Como usuário da OutLife_Application, quero ver notificações de eventos relevantes para mim, para saber quando algo importante aconteceu (como uma nova solicitação de amizade) sem precisar verificar manualmente cada tela.

#### Acceptance Criteria

1. THE Production_Supabase_Project SHALL ter uma tabela dedicada a Notification, associando cada registro a um usuário destinatário autenticado, um tipo de evento e um estado de lida/não lida.
2. WHEN um usuário autenticado envia uma solicitação de Friendship para outro usuário (Requirement 3), THE Production_Supabase_Project SHALL criar uma Notification para o usuário destinatário da solicitação.
3. THE OutLife_Application SHALL expor a Notifications_Screen, acessível através do sino de notificação em `/`, listando as Notification do usuário autenticado em ordem cronológica decrescente.
4. WHEN o sino de notificação em `/` é selecionado, THE OutLife_Application SHALL navegar para a Notifications_Screen.
5. IF um usuário autenticado tiver ao menos uma Notification não lida, THEN THE sino de notificação em `/` SHALL exibir um indicador visual de notificação pendente.
6. IF um usuário autenticado não tiver nenhuma Notification não lida, THEN THE sino de notificação em `/` SHALL ser exibido em seu estado neutro, sem o indicador visual de notificação pendente.
7. WHEN um usuário autenticado abre a Notifications_Screen, THE OutLife_Application SHALL marcar como lidas as Notification exibidas nessa sessão de visualização.
8. WHEN as Notification exibidas na Notifications_Screen são marcadas como lidas, THE OutLife_Application SHALL remover o indicador visual do sino de notificação em `/` imediatamente, sem esperar um novo carregamento da página inicial.

### Requirement 10: Configurações de perfil

**User Story:** Como usuário da OutLife_Application, quero acessar uma tela de configurações a partir do meu perfil, para trocar minha foto e editar meus dados pessoais sem depender de nenhum fluxo externo ao app.

#### Acceptance Criteria

1. THE OutLife_Application SHALL expor a Profile_Settings_Screen, acessível através do ícone de engrenagem em `/perfil`.
2. WHEN o ícone de engrenagem em `/perfil` é selecionado, THE OutLife_Application SHALL navegar para a Profile_Settings_Screen.
3. THE Profile_Settings_Screen SHALL permitir que um usuário autenticado envie uma nova foto de perfil, seguindo o mesmo padrão de validação e otimização de imagem já usado pelo upload de galeria do parceiro.
4. WHEN um usuário autenticado envia uma nova foto de perfil válida na Profile_Settings_Screen, THE OutLife_Application SHALL atualizar `avatar_url` do perfil desse usuário e SHALL exibir a nova foto em `/perfil` após a confirmação.
5. THE Profile_Settings_Screen SHALL permitir que um usuário autenticado edite nome completo, nome de usuário e localização do seu próprio perfil, através da função `updateMyProfile` já existente.
6. IF um usuário autenticado tentar definir um nome de usuário já utilizado por outro perfil, THEN THE Profile_Settings_Screen SHALL impedir a submissão e exibir uma mensagem indicando que o nome de usuário já está em uso.

### Requirement 11: Fluxo real de verificação Cadastur com moderação por administrador

**User Story:** Como responsável pelo produto, quero que a verificação Cadastur de um parceiro passe por uma análise real registrada no banco de dados, e não por uma simulação automática que sempre aprova, para que o selo de verificação tenha credibilidade.

#### Acceptance Criteria

1. THE Production_Supabase_Project SHALL ter uma tabela dedicada a Cadastur_Verification_Request, associando cada registro a um parceiro autenticado, os dados submetidos no formulário de compliance, o documento anexado e um status (`pending`, `approved` ou `rejected`).
2. WHEN um parceiro autenticado submete o formulário de compliance com todos os campos e o documento válidos, THE OutLife_Application SHALL persistir uma Cadastur_Verification_Request com status `pending`, em vez de iniciar a simulação de aprovação automática atualmente existente.
3. THE Production_Supabase_Project SHALL suportar o Admin_Role como um valor válido do papel de usuário, distinto de `adventurer` e `partner`.
4. THE OutLife_Application SHALL expor a Admin_Compliance_Screen, acessível exclusivamente a um usuário autenticado com Admin_Role, listando as Cadastur_Verification_Request com status `pending`.
5. WHEN um usuário com Admin_Role aprova uma Cadastur_Verification_Request na Admin_Compliance_Screen, THE Production_Supabase_Project SHALL atualizar o status dessa solicitação para `approved` e SHALL marcar o perfil do parceiro correspondente como verificado (`is_verified = true`).
6. WHEN um usuário com Admin_Role rejeita uma Cadastur_Verification_Request na Admin_Compliance_Screen, THE Production_Supabase_Project SHALL atualizar o status dessa solicitação para `rejected`, sem alterar `is_verified` do perfil do parceiro correspondente.
7. WHEN o status de uma Cadastur_Verification_Request de um parceiro autenticado é atualizado para `approved` ou `rejected`, THE tela de compliance desse parceiro SHALL exibir esse status atualizado na próxima vez que for carregada, em vez do selo de "verificado" exibido incondicionalmente pela simulação atual.
8. IF um usuário autenticado sem Admin_Role tentar acessar a Admin_Compliance_Screen ou chamar as operações de aprovação/rejeição de Cadastur_Verification_Request, THEN THE OutLife_Application SHALL negar o acesso, consistente com uma política de RLS restringindo essas operações a usuários com Admin_Role.
9. IF um parceiro autenticado já tiver uma Cadastur_Verification_Request com status `pending` associada a ele, THEN THE OutLife_Application SHALL impedir a submissão de uma nova solicitação enquanto a existente não for `approved` ou `rejected`.

### Requirement 12: Remoção ou documentação de elementos decorativos remanescentes

**User Story:** Como usuário da OutLife_Application, quero que os controles visíveis na interface façam o que parecem fazer, para não perder tempo tentando usar um filtro ou botão que não tem efeito nenhum.

#### Acceptance Criteria

1. WHEN um usuário seleciona um dos chips de filtro de dificuldade ou o ícone de filtro em `/explorar`, THE OutLife_Application SHALL aplicar o filtro correspondente à lista de destinos exibida, restringindo-a aos destinos que atendem ao critério selecionado.
2. THE gráfico "últimos 7 dias" no painel do parceiro (`/parceiro/painel`) SHALL exibir dados derivados de `profile_views` e `contact_clicks` reais do parceiro autenticado, em vez do array fixo atualmente retornado por `fetchPartnerChart`.
3. WHEN o botão de "seguidores" ou o botão de "seguindo" em `/perfil` é selecionado, THE OutLife_Application SHALL exibir exclusivamente a lista real de usuários correspondente a esse botão, em vez de apenas um aviso com a contagem numérica, substituindo qualquer lista anteriormente exibida pelo outro botão.
4. WHERE a previsão do tempo da "próxima aventura" em `/perfil` não tiver uma fonte de dado real integrada neste spec, THE OutLife_Application SHALL ocultar a seção de previsão do tempo em vez de exibir um espaço vazio proveniente do array fixo atualmente retornado.
5. WHEN o botão de compartilhar em um Community_Post ou no topo da galeria de `/parceiro/$partnerId` é selecionado, THE OutLife_Application SHALL abrir um mecanismo de compartilhamento nativo do navegador ou copiar o link correspondente para a área de transferência, com confirmação visível ao usuário.

## Fora de Escopo (registro de decisão)

Os itens abaixo foram identificados durante a auditoria, mas ficam explicitamente fora do escopo deste spec:

- **Lista real de "seguidores"/"seguindo" como conceito de rede social geral**: o Requirement 12.3 exige que os botões abram uma lista real, mas a modelagem completa de um grafo de "seguidores" (distinto de Friendship) não é criada por este spec — a lista exibida deve reutilizar a Friendship do Requirement 3 como fonte de dado, documentando essa equivalência na implementação.
- **Integração de previsão do tempo real** (API de clima de terceiros): registrada apenas como possível melhoria futura; o Requirement 12.4 apenas trata o estado atual (array vazio) de forma não enganosa.
- Itens da Fase de Escala do spec `outlife-production-plan` (push notifications de push nativo, gateway de pagamento, app mobile nativo) permanecem fora de escopo.
