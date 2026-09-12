# Requirements Document

## Introduction

Este documento reúne os requisitos das 8 frentes de evolução do app OutVitar
(React 19 + TS + Vite + TanStack Router + Supabase + Capacitor/Android),
todas construídas **estendendo** a base existente (Área administrativa `/admin`
com hub de cards e RLS via `public.is_admin`, tabelas `user_activities`,
`destinations`, `community_posts`/`post_comments`/`post_likes`, `reviews`,
`partner_leads`, `app_content`, funções em `src/lib/api.ts`, gerador de banners
em `src/lib/banner-generator.ts`, deep link de atividade em
`src/routes/a.$activityId.tsx`). Nenhuma migração reescreve a base: toda
alteração de banco é idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`,
`DROP ... IF EXISTS`), em arquivo novo timestampado, aplicada em produção via
`scripts/run-one-migration.mjs`.

As frentes:

1. Admin — Trilhas e Destinos importados de APIs públicas (OSM/Overpass, ICMBio/CNUC)
2. Rank — Conquistas por Destino validadas por GPS
3. Sugestões de amizade
4. Admin — Cadastro de tipos de atividade (ícone + forma de métrica)
5. Parceiros — Trial de 1 ano (hoje por cliques/~15 dias)
6. Bug — Link de banner/atividade `/a/:id` retorna 404 no app nativo
7. Banners de compartilhamento estilo Strava, marca OutVitar (foto, mapa, vídeo)
8. Comunidade — Respostas e curtidas em comentários (threads, curtir, excluir)

## Glossary

- **App**: aplicativo OutVitar (front web + shell nativo Android via Capacitor).
- **Admin_User**: usuário cujo `public.is_admin(auth.uid())` retorna verdadeiro.
- **Regular_User**: usuário autenticado que não é Admin_User.
- **Admin_Area**: área administrativa em `/admin`, hub de cards restrito a Admin_User.
- **Imported_Trail**: registro de trilha/destino importado de uma External_Source.
- **External_Source**: origem de dados públicos — `osm` (OpenStreetMap via Overpass, licença ODbL) ou `icmbio` (ICMBio/CNUC — unidades de conservação/parques do Brasil).
- **OSM_Attribution**: texto de atribuição obrigatório "© OpenStreetMap contributors" para dados de origem `osm`.
- **Trail_Visibility**: estado booleano de um Imported_Trail que define se ele é exibido aos Regular_User (visível) ou oculto.
- **Import_Region**: recorte geográfico (bounding box ou nome/identificador de região) usado para importar Imported_Trail em lote.
- **Destination**: registro da tabela `destinations` (status pending/approved/rejected).
- **User_Activity**: registro da tabela `user_activities` (GPS, status completed/in_progress, `activity_type`).
- **Activity_Type**: tipo de atividade. Hoje enum fixo (caminhada|pedalada|trilha|outro); passa a ser alimentado pelo Activity_Type_Catalog.
- **Activity_Type_Catalog**: cadastro administrado por Admin_User de tipos de atividade, cada um com Activity_Icon e Metric_Form.
- **Activity_Icon**: imagem/ícone escolhido de um Icon_Model_Set para representar um Activity_Type.
- **Icon_Model_Set**: conjunto fixo de modelos de ícones das principais atividades conhecidas (corrida, caminhada, trilha, pedalada/ciclismo, natação, remo, escalada, etc.).
- **Metric_Form**: definição de quais métricas um Activity_Type exibe e como são calculadas (ex.: corrida → pace min/km; pedalada → velocidade km/h + ganho de elevação; natação → pace /100m).
- **Destination_Achievement**: conquista relacionada a Destination, concedida quando um Regular_User conclui atividades em uma quantidade de Destination distintos validada por GPS.
- **GPS_Proximity**: critério de que a posição registrada de uma User_Activity está dentro ou próxima (dentro de um raio definido) das coordenadas de um Destination.
- **Friend_Suggestion**: sugestão de amizade para o Regular_User logado, derivada de amigos-de-amigos, proximidade geográfica e/ou similaridade de atividades.
- **Friendship**: relação em `public.user_friends` (status pending/accepted/blocked/following).
- **Partner**: usuário com `profiles.role = 'partner'`.
- **Partner_Trial**: período de teste gratuito do Partner.
- **Trial_Duration**: duração do Partner_Trial. Valor atual baseado em cliques (`PARTNER_TRIAL_CLICK_THRESHOLD = 15`); passa a ser 1 ano a partir de uma data de início.
- **Activity_Deep_Link**: URL curta `/a/:activityId` que abre a User_Activity no App nativo, ou uma página de preview no navegador.
- **Native_Shell**: app empacotado via Capacitor rodando no Android.
- **Share_Banner_Image**: imagem de compartilhamento gerada client-side por `src/lib/banner-generator.ts`.
- **Banner_Variant**: uma das três composições do Share_Banner_Image — Photo_Banner (sobre foto), Map_Banner (sobre mapa com trajeto) e Video_Banner (sobre vídeo).
- **Banner_Brand_Label**: rótulo de marca fixo "OUTVITAR" exibido no Share_Banner_Image, no lugar de "STRAVA".
- **Default_Description**: texto padrão do App usado no Share_Banner_Image quando o usuário não escreveu descrição.
- **Post_Comment**: comentário de um Community_Post (tabela `post_comments`).
- **Comment_Reply**: Post_Comment que responde a outro Post_Comment (thread), identificado por um comentário-pai.
- **Comment_Like**: curtida de um Regular_User em um Post_Comment ou Comment_Reply.

## Requirements

### Requirement 1: Admin — Menu de Trilhas e Destinos importados

**User Story:** Como Admin_User, quero um menu na Admin_Area que liste trilhas e destinos importados de fontes públicas e me permita liberar ou ocultar cada um para os usuários, para curar o conteúdo geográfico do App.

#### Acceptance Criteria

1. WHERE o usuário autenticado é Admin_User, THE Admin_Area SHALL exibir um card de acesso ao menu de Imported_Trail.
2. IF um Regular_User acessar a rota do menu de Imported_Trail, THEN THE App SHALL registrar a violação de acesso, exibir uma mensagem de acesso negado e redirecionar para a tela inicial.
7. WHERE o usuário autenticado é Admin_User, THE App SHALL conceder acesso ao menu de Imported_Trail sem redirecioná-lo para a tela inicial.
3. WHEN o Admin_User abre o menu de Imported_Trail, THE App SHALL listar os Imported_Trail existentes com nome, External_Source e Trail_Visibility atual.
4. WHEN o Admin_User aciona o controle de Trail_Visibility de um Imported_Trail, THE App SHALL alternar a Trail_Visibility desse Imported_Trail e persistir o novo estado.
5. WHILE a Trail_Visibility de um Imported_Trail está oculta, THE App SHALL omitir esse Imported_Trail das listagens exibidas aos Regular_User.
6. THE App SHALL restringir a alteração de Trail_Visibility ao Admin_User por meio de RLS baseada em `public.is_admin`.

### Requirement 2: Admin — Importação de trilhas/destinos por região

**User Story:** Como Admin_User, quero importar trilhas e destinos de uma External_Source recortados por região, para popular o catálogo sem cadastrar manualmente cada item.

#### Acceptance Criteria

1. WHEN o Admin_User informa uma Import_Region e uma External_Source e confirma a importação, THE App SHALL buscar os registros dessa External_Source dentro da Import_Region e persistir cada resultado como um Imported_Trail.
2. WHEN um resultado importado corresponde a um Imported_Trail já existente da mesma External_Source com o mesmo identificador de origem, THE App SHALL atualizar o Imported_Trail existente em vez de criar um duplicado.
3. WHERE a External_Source de um Imported_Trail é `osm`, THE App SHALL armazenar e exibir a OSM_Attribution "© OpenStreetMap contributors" junto ao Imported_Trail.
4. WHEN um Imported_Trail é criado pela importação, THE App SHALL definir a Trail_Visibility inicial como oculta.
5. IF a busca na External_Source falhar ou retornar erro, THEN THE App SHALL exibir uma mensagem de falha ao Admin_User.
6. IF a busca na External_Source falhar ou retornar erro, THEN THE App SHALL preservar os Imported_Trail já existentes sem alteração, independentemente de a mensagem de falha ser exibida com sucesso.
7. WHERE a External_Source é `osm`, THE App SHALL registrar a licença ODbL associada ao Imported_Trail.

### Requirement 3: Rank — Conquistas por Destino validadas por GPS

**User Story:** Como Regular_User, quero receber conquistas por concluir atividades em destinos, validadas pela minha posição GPS, para reconhecer minha exploração real de lugares.

#### Acceptance Criteria

1. WHEN uma User_Activity com status `completed` é registrada com GPS_Proximity a um Destination, THE App SHALL contabilizar esse Destination como visitado pelo Regular_User.
2. IF a posição registrada de uma User_Activity não satisfaz GPS_Proximity a nenhum Destination, THEN THE App SHALL não contabilizar Destination visitado por essa User_Activity.
3. WHEN a contagem de Destination distintos visitados por GPS_Proximity de um Regular_User atinge o limite de uma Destination_Achievement, THE App SHALL conceder essa Destination_Achievement ao Regular_User.
4. THE App SHALL conceder no máximo uma vez cada Destination_Achievement por Regular_User.
5. WHERE um Regular_User possui uma Destination_Achievement, THE App SHALL exibir essa Destination_Achievement na tela de gamificação do Regular_User.
6. THE App SHALL restringir a concessão de Destination_Achievement a funções `SECURITY DEFINER` do banco, sem permitir escrita direta do cliente na tabela de conquistas.

### Requirement 4: Sugestões de amizade

**User Story:** Como Regular_User logado, quero ver sugestões de amizade, para encontrar pessoas com quem me conectar no App.

#### Acceptance Criteria

1. WHEN o Regular_User logado abre a tela de amizades, THE App SHALL exibir uma lista de Friend_Suggestion.
2. THE App SHALL excluir da Friend_Suggestion o próprio Regular_User logado e os usuários com quem ele já possui Friendship em qualquer status.
3. WHERE existem amigos-de-amigos do Regular_User logado, THE App SHALL incluí-los como Friend_Suggestion.
4. WHERE o Regular_User logado e outro usuário concluíram User_Activity de Activity_Type em comum, THE App SHALL incluir esse outro usuário como Friend_Suggestion.
5. WHEN o Regular_User logado aciona seguir/adicionar em uma Friend_Suggestion, THE App SHALL criar a Friendship correspondente e remover esse usuário das Friend_Suggestion exibidas.
6. THE App SHALL restringir os dados de cada Friend_Suggestion a campos públicos (nome, username, avatar) por meio de função `SECURITY DEFINER`.
7. WHERE uma Friend_Suggestion não possui nome público ou avatar, THE App SHALL exibir a Friend_Suggestion com informação de placeholder para os campos ausentes.

### Requirement 5: Admin — Cadastro de tipos de atividade

**User Story:** Como Admin_User, quero cadastrar tipos de atividade com um ícone e uma forma de métrica, para que o rastreamento ofereça os tipos que eu definir com o cálculo correto de cada um.

#### Acceptance Criteria

1. WHERE o usuário autenticado é Admin_User, THE Admin_Area SHALL exibir um card de acesso ao Activity_Type_Catalog.
2. WHEN o Admin_User cria um Activity_Type no Activity_Type_Catalog, THE App SHALL exigir um nome, um Activity_Icon escolhido do Icon_Model_Set e um Metric_Form.
3. THE App SHALL oferecer no Icon_Model_Set modelos para corrida, caminhada, trilha, pedalada/ciclismo, natação, remo e escalada.
4. THE App SHALL permitir associar a cada Activity_Type um Metric_Form dentre pace por quilômetro, velocidade em km/h com ganho de elevação, e pace por 100 metros.
5. WHEN o Regular_User inicia o rastreamento de atividade, THE App SHALL apresentar os Activity_Type cadastrados no Activity_Type_Catalog como opções disponíveis.
6. WHEN uma User_Activity é concluída, THE App SHALL calcular as métricas exibidas conforme o Metric_Form do Activity_Type selecionado.
7. IF o Admin_User tenta salvar um Activity_Type sem nome, sem Activity_Icon ou sem Metric_Form, THEN THE App SHALL rejeitar o salvamento e exibir uma mensagem indicando o campo faltante.
8. THE App SHALL restringir a criação, edição e exclusão de Activity_Type ao Admin_User por meio de RLS baseada em `public.is_admin`.

### Requirement 6: Parceiros — Trial de 1 ano

**User Story:** Como Partner, quero que meu período de teste dure 1 ano, para avaliar o App com folga em vez de perder acesso após poucos cliques.

#### Acceptance Criteria

1. WHEN um Partner_Trial é iniciado, THE App SHALL definir a Trial_Duration como 1 ano a partir da data de início do Partner_Trial.
2. WHILE a data atual está dentro da Trial_Duration de 1 ano, THE App SHALL manter o Partner_Trial ativo independentemente do número de cliques de contato.
3. WHEN a data atual ultrapassa o fim da Trial_Duration de 1 ano, THE App SHALL marcar o Partner_Trial como expirado.
4. THE App SHALL exibir ao Partner os dias restantes do Partner_Trial com base na Trial_Duration de 1 ano.

### Requirement 7: Bug — Link de banner/atividade abre a atividade correta no nativo

**User Story:** Como Regular_User, quero que ao abrir um link compartilhado de atividade `/a/:id` no App nativo eu veja a atividade correta, para não receber um erro 404.

#### Acceptance Criteria

1. WHEN o Native_Shell abre um Activity_Deep_Link `/a/:activityId` de uma User_Activity existente com status `completed`, THE App SHALL exibir a tela da User_Activity correspondente sem retornar 404.
2. IF o Activity_Deep_Link referencia um `activityId` inexistente ou de User_Activity não `completed`, THEN THE App SHALL exibir uma mensagem de atividade não encontrada em vez de um erro 404.
3. WHEN o Native_Shell processa um Activity_Deep_Link, THE App SHALL resolver o roteamento interno para a rota da atividade sem depender de um servidor web externo.
5. IF o roteamento interno de um Activity_Deep_Link falhar para uma User_Activity `completed` existente, THEN THE App SHALL recorrer ao roteamento por servidor externo como alternativa.
4. THE App SHALL preservar o comportamento de preview no navegador (usuário sem o App instalado) já existente para o Activity_Deep_Link.

### Requirement 8: Banners de compartilhamento estilo Strava (marca OutVitar)

**User Story:** Como Regular_User, quero banners de compartilhamento com o visual estilo Strava e a marca OutVitar, com o ícone da minha atividade, minha descrição e as métricas certas, para compartilhar minhas atividades de forma atraente.

#### Acceptance Criteria

1. WHEN um Share_Banner_Image de User_Activity é gerado, THE App SHALL incluir o Activity_Icon correspondente ao Activity_Type da User_Activity.
2. WHEN um Share_Banner_Image de User_Activity é gerado, THE App SHALL exibir o Banner_Brand_Label "OUTVITAR".
3. WHERE a User_Activity possui descrição escrita pelo usuário, THE App SHALL incluir essa descrição no Share_Banner_Image.
4. WHERE a User_Activity não possui descrição escrita pelo usuário, THE App SHALL incluir a Default_Description no Share_Banner_Image.
5. WHEN um Share_Banner_Image de User_Activity é gerado, THE App SHALL exibir as métricas conforme o Metric_Form do Activity_Type, dentre distância em km, tempo, pace, velocidade média e ganho de elevação.
6. WHERE o Regular_User escolhe o Photo_Banner, THE App SHALL compor o Share_Banner_Image sobre a foto do usuário.
7. WHERE o Regular_User escolhe o Map_Banner, THE App SHALL compor o Share_Banner_Image sobre o mapa com o desenho do trajeto da User_Activity.
8. WHERE o Regular_User escolhe o Video_Banner, THE App SHALL compor o Share_Banner_Image sobre o vídeo da User_Activity.
9. IF a geração de um Banner_Variant falhar por erro de renderização ou exceder o tempo limite, THEN THE App SHALL propagar o erro e permitir nova tentativa, sem compartilhar uma imagem incompleta.

### Requirement 9: Comunidade — Respostas e curtidas em comentários

**User Story:** Como Regular_User, quero responder e curtir comentários das postagens e excluir os meus, estilo Instagram/Facebook, para interagir melhor na comunidade.

#### Acceptance Criteria

1. WHEN o Regular_User responde a um Post_Comment, THE App SHALL criar um Comment_Reply vinculado ao Post_Comment-pai e ao mesmo Community_Post.
2. WHEN o App exibe os comentários de um Community_Post, THE App SHALL apresentar cada Comment_Reply agrupado sob o seu Post_Comment-pai.
3. WHEN o Regular_User curte um Post_Comment ou um Comment_Reply, THE App SHALL registrar um Comment_Like desse Regular_User e refletir a contagem de curtidas.
4. WHEN o Regular_User curte novamente um Post_Comment ou Comment_Reply que já havia curtido, THE App SHALL remover o Comment_Like e decrementar a contagem, mantendo a contagem idempotente por usuário.
5. WHEN o Regular_User exclui um Post_Comment ou Comment_Reply de sua autoria, THE App SHALL remover esse registro e seus Comment_Reply e Comment_Like dependentes.
6. WHERE o usuário autenticado é Admin_User, THE App SHALL permitir excluir qualquer Post_Comment ou Comment_Reply.
7. IF um Regular_User tenta excluir um Post_Comment ou Comment_Reply que não é de sua autoria e não é Admin_User, THEN THE App SHALL negar a exclusão por meio de RLS e de uma verificação de autorização no nível da aplicação como camada adicional.
8. THE App SHALL manter a contagem de comentários de cada Community_Post consistente ao criar e excluir Post_Comment e Comment_Reply.
