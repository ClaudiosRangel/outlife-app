# Requirements Document

## Introduction

A OutLife_Application é um marketplace outdoor colaborativo (React 19 + TanStack Router/Start, backend Supabase), hoje publicado como PWA na Vercel (`https://outlife-app.vercel.app/`). Este spec formaliza a evolução para um modelo **híbrido inspirado na arquitetura do Instagram**: o núcleo web/React existente é reaproveitado por completo (nenhuma tela de CRUD é reescrita — Comunidade, Marketplace, Perfil, Configurações, Notificações, Amigos, etc.), envolto por um shell nativo mínimo via Capacitor (Android + iOS), com um módulo nativo dedicado exclusivamente ao rastreamento de atividade GPS em segundo plano — a única funcionalidade que exige garantias reais do sistema operacional que a Web Geolocation API não pode oferecer (execução em segundo plano confiável, sobrevivência a bloqueio de tela/troca de app, recuperação após interrupção do sistema).

A decisão arquitetural híbrida já foi confirmada com o usuário e é ponto de partida para os requisitos abaixo, não uma opção em aberto. Este spec cobre:

1. O shell nativo Capacitor e a consequência técnica de precisar de dois alvos de build a partir da mesma base de código (SPA-only para o app nativo, SSR para a Vercel).
2. O módulo nativo de rastreamento de atividade em segundo plano, com captura de pace/velocidade média, persistência periódica de pontos GPS e recuperação de atividade após interrupção do sistema (bateria, crash, encerramento pelo SO).
3. O salvamento confiável da atividade rastreada, sem risco de perda silenciosa em cenários de falha de rede ou encerramento do app.
4. A persistência de um snapshot do mapa percorrido no resumo da atividade.
5. A geração e o compartilhamento de um "banner" de imagem (mapa + métricas, ou foto + categoria + descrição) para WhatsApp, Instagram e Facebook, tanto para atividades quanto para publicações da comunidade.
6. Duas novas categorias de publicação na Comunidade (Pedalada e Caminhada), com abas de filtro e exibição visual da categoria no card do post.
7. Notificações push reais na central de notificações nativa do dispositivo, combinando Web Push (PWA) e push nativo (FCM/APNs, via shell Capacitor).

Contas de desenvolvedor em loja, assinatura de app e o processo operacional de build/release ficam registrados como pré-requisito operacional no Fora de Escopo — são passos administrativos do usuário, não tarefas de codificação.

## Glossary

- **OutLife_Application**: a aplicação OutLife (React 19 + TanStack Router/Start), cujo código-fonte reside no OutLife_Repository, distribuída tanto pela versão web/PWA (Vercel) quanto pelo Outlife_Native_Shell.
- **OutLife_Repository**: o repositório Git do usuário contendo o código-fonte da OutLife_Application.
- **Production_Supabase_Project**: o projeto Supabase em uso pela OutLife_Application em produção.
- **Outlife_Web_Core**: o conjunto de telas, rotas e lógica React/TanStack já existentes na OutLife_Application (Comunidade, Marketplace, Perfil, Configurações, Notificações, Amigos, rastreamento de atividade, etc.), reaproveitado sem reescrita tanto na versão web quanto na versão nativa.
- **Outlife_Native_Shell**: o invólucro nativo criado com Capacitor (Android e iOS) que empacota o Outlife_Web_Core dentro de um WebView nativo, expondo plugins nativos como o Native_Location_Tracking_Module.
- **SSR_Build_Target**: o alvo de build atual da OutLife_Application, com renderização no servidor (SSR) e server functions do TanStack Start, implantado na Vercel e servido a quem acessa via navegador ou instala como PWA.
- **SPA_Build_Target**: um novo alvo de build da OutLife_Application, gerando uma aplicação estática (sem SSR e sem server functions em tempo de execução), exclusivamente para ser empacotado dentro do Outlife_Native_Shell.
- **Native_Location_Tracking_Module**: o módulo nativo dedicado ao rastreamento de localização em segundo plano dentro do Outlife_Native_Shell, implementado como Foreground Service no Android e Background Location Mode no iOS.
- **User_Activity**: um registro de atividade rastreada por GPS, persistido na tabela `user_activities`, com status `in_progress` ou `completed`.
- **Activity_Type**: um classificador do tipo de esforço físico de uma User_Activity, com valores `caminhada`, `pedalada`, `trilha` ou `outro` — subconjunto do vocabulário usado por Community_Post_Category para os valores em comum.
- **Location_Persistence_Checkpoint**: o momento em que os pontos de localização capturados durante uma User_Activity em andamento são persistidos localmente no dispositivo, ocorrendo a cada 10 segundos ou a cada 50 metros percorridos, o que ocorrer primeiro.
- **Average_Pace**: o tempo médio necessário para percorrer um quilômetro em uma User_Activity, expresso no formato minutos:segundos por quilômetro (mm:ss/km), calculado a partir da distância e do tempo decorrido.
- **Average_Speed**: a velocidade média de uma User_Activity, expressa em quilômetros por hora (km/h) com 1 casa decimal, calculada a partir da distância e do tempo decorrido.
- **Activity_Sync_Queue**: a fila local (IndexedDB) de User_Activity finalizadas que ainda não foram sincronizadas com o Production_Supabase_Project, reaproveitando o mecanismo já existente em `activity-storage.ts`.
- **Activity_Detail_Screen**: a tela de resumo/detalhe de uma User_Activity (rota `/atividade/$activityId`), exibindo mapa, métricas, descrição e foto.
- **Activity_Map_Snapshot**: uma imagem estática do mapa percorrido por uma User_Activity, gerada e persistida no momento em que essa User_Activity é finalizada.
- **Share_Banner_Image**: uma imagem gerada para compartilhamento externo, combinando mapa e métricas (para uma User_Activity) ou foto, categoria e descrição (para um Community_Post).
- **Banner_Generator**: o mecanismo que compõe um Share_Banner_Image por renderização client-side (canvas), sem depender de um serviço remoto.
- **Community_Post**: uma publicação da comunidade, persistida na tabela `community_posts`.
- **Community_Post_Category**: o tipo de uma Community_Post, com valores `trilha`, `camping`, `relato`, `outro`, `pedalada` e `caminhada`.
- **Notification**: um evento relevante para um usuário, persistido na tabela `notifications` e listado na Notifications_Screen (spec `outlife-completar-funcionalidades`).
- **Notifications_Screen**: a tela que lista as Notification do usuário autenticado (rota `/notificacoes`).
- **Push_Notification**: uma notificação exibida na central de notificações nativa do dispositivo (fora da OutLife_Application), disparada a partir do mesmo evento que cria uma Notification in-app.
- **Native_Push_Token**: o identificador de registro de um dispositivo para receber Push_Notification através da API nativa de push do sistema operacional (FCM no Android, APNs no iOS), obtido exclusivamente quando a OutLife_Application é executada dentro do Outlife_Native_Shell.
- **Web_Push_Subscription**: o identificador de registro de um navegador para receber Push_Notification através do padrão Web Push, obtido quando a OutLife_Application é acessada por um navegador com suporte a Web Push, esteja ou não instalada como PWA na tela inicial do dispositivo.
- **Google_Places_Credential**: a chave de API do Google Places (`GOOGLE_PLACES_API_KEY`), usada exclusivamente pelo servidor e nunca exposta ao cliente.

## Requirements

### Requirement 1: Shell Nativo Híbrido e Dois Alvos de Build

**User Story:** Como responsável pelo produto, quero empacotar o Outlife_Web_Core existente dentro de um shell nativo Capacitor, para distribuir a OutLife_Application como app nativo em Android e iOS sem reescrever nenhuma tela já existente.

#### Acceptance Criteria

1. THE Outlife_Native_Shell SHALL empacotar o Outlife_Web_Core reutilizando os mesmos componentes, rotas e implementações de tela já existentes para Comunidade, Marketplace, Perfil, Configurações, Notificações e Amigos, sem criar implementações paralelas ou duplicadas dessas telas especificamente para o shell nativo.
2. THE OutLife_Repository SHALL expor um SPA_Build_Target que gera uma build estática do Outlife_Web_Core, sem SSR e sem execução de server functions do TanStack Start em tempo de execução, distinto do SSR_Build_Target existente.
3. WHEN o SPA_Build_Target é gerado, THE Outlife_Native_Shell SHALL empacotar exclusivamente o resultado do SPA_Build_Target no WebView nativo, tanto no Android quanto no iOS, considerando o empacotamento bem-sucedido somente quando o build é concluído sem erros e o aplicativo nativo consegue iniciar e exibir as telas empacotadas.
4. IF o empacotamento do SPA_Build_Target no WebView nativo não for concluído com sucesso em ambas as plataformas (Android e iOS) simultaneamente, THEN THE OutLife_Application SHALL impedir a publicação do Outlife_Native_Shell, mantendo esse bloqueio até que o empacotamento seja concluído com sucesso nas duas plataformas.
5. WHEN o SSR_Build_Target é implantado na Vercel, THE OutLife_Application SHALL continuar servindo a versão web/PWA com SSR, preservando as mesmas rotas, funcionalidades e capacidade de instalação como PWA para quem acessa via navegador ou PWA instalada, sem regressão observável em relação ao comportamento anterior ao empacotamento do SPA_Build_Target.
6. IF uma funcionalidade do Outlife_Web_Core depender de uma TanStack Start server function que exige um servidor em tempo de execução, THEN THE SPA_Build_Target SHALL substituir essa dependência por uma chamada HTTP a um endpoint remoto que retorne o mesmo resultado funcional da server function original.
7. IF a chamada HTTP ao endpoint remoto equivalente falhar (erro de rede ou resposta de erro do servidor), THEN THE Outlife_Native_Shell SHALL exibir ao usuário uma indicação de erro observável e preservar o estado da tela anterior à tentativa, em vez de falhar silenciosamente ou encerrar o aplicativo.

### Requirement 2: Módulo Nativo de Rastreamento de Atividade em Segundo Plano

**User Story:** Como usuário rastreando uma atividade outdoor, quero que a OutLife_Application continue capturando minha localização mesmo com a tela bloqueada ou trocando de aplicativo, para não perder trecho percorrido — hoje um risco real com a Web Geolocation API.

#### Acceptance Criteria

1. WHERE a OutLife_Application está em execução dentro do Outlife_Native_Shell, WHEN o usuário inicia o rastreamento de uma User_Activity, THE Native_Location_Tracking_Module SHALL capturar a localização do usuário através da API nativa de localização em segundo plano do sistema operacional (Foreground Service no Android, Background Location Mode no iOS), em vez da Web Geolocation API, com uma frequência de captura de no mínimo 1 ponto a cada 5 segundos ou a cada 10 metros percorridos (o que ocorrer primeiro).
2. WHILE uma User_Activity está com status `in_progress` dentro do Outlife_Native_Shell, THE Native_Location_Tracking_Module SHALL continuar capturando pontos de localização, na mesma frequência definida no Critério 1, quando a tela do dispositivo é bloqueada.
3. WHILE uma User_Activity está com status `in_progress` dentro do Outlife_Native_Shell, THE Native_Location_Tracking_Module SHALL continuar capturando pontos de localização, na mesma frequência definida no Critério 1, quando o usuário troca para outro aplicativo sem finalizar o rastreamento.
4. WHILE o Native_Location_Tracking_Module está capturando pontos de localização em segundo plano para uma User_Activity com status `in_progress`, THE Outlife_Native_Shell SHALL exibir uma notificação persistente na central de notificações do sistema operacional, indicando que o rastreamento está ativo, consistente com o requisito de Foreground Service do Android.
5. WHERE a OutLife_Application está em execução no navegador ou como PWA fora do Outlife_Native_Shell, THE OutLife_Application SHALL continuar utilizando a Web Geolocation API já existente para o rastreamento, incluindo com a tela do dispositivo bloqueada, sem exigir o Native_Location_Tracking_Module e sem as garantias de segundo plano descritas nos Critérios 2 e 3 (limitação conhecida e aceita da Web Geolocation API fora do Outlife_Native_Shell).
6. IF a permissão de localização em segundo plano é negada pelo usuário dentro do Outlife_Native_Shell, THEN THE OutLife_Application SHALL informar essa restrição antes de iniciar o rastreamento e SHALL impedir o início do rastreamento até que a permissão seja concedida, consistente com o tratamento de permissão negada já existente na Web Geolocation API.
7. IF a permissão de localização em segundo plano concedida dentro do Outlife_Native_Shell for revogada pelo usuário enquanto uma User_Activity está com status `in_progress`, THEN THE Native_Location_Tracking_Module SHALL interromper a captura de novos pontos de localização e THE OutLife_Application SHALL informar ao usuário que o rastreamento foi interrompido por revogação de permissão, preservando os pontos já persistidos dessa User_Activity.

### Requirement 3: Persistência Periódica de Pontos GPS e Recuperação Após Interrupção

**User Story:** Como usuário rastreando uma atividade, quero que meu percurso seja salvo continuamente durante o rastreamento, para recuperar a atividade com o mínimo de perda possível caso o celular desligue, reinicie ou trave antes de eu finalizá-la manualmente.

#### Acceptance Criteria

1. WHILE uma User_Activity está com status `in_progress`, THE OutLife_Application SHALL persistir localmente os pontos de localização capturados exatamente em cada Location_Persistence_Checkpoint, disparado somente quando ao menos 10 segundos tiverem transcorrido ou ao menos 50 metros tiverem sido percorridos desde o Location_Persistence_Checkpoint anterior (o que ocorrer primeiro), sem persistir de forma contínua a cada ponto capturado.
2. IF a persistência local de um Location_Persistence_Checkpoint falhar (por exemplo, armazenamento insuficiente ou erro de escrita), THEN THE OutLife_Application SHALL reter em memória os pontos ainda não persistidos, continuar o rastreamento da User_Activity sem interrupção, e tentar persistir esses pontos novamente no próximo Location_Persistence_Checkpoint.
3. IF o dispositivo é desligado, reiniciado, ou a OutLife_Application é encerrada pelo sistema operacional durante o rastreamento de uma User_Activity, THEN THE OutLife_Application SHALL, ao ser reaberta, recuperar essa User_Activity com todos os pontos de localização persistidos até o último Location_Persistence_Checkpoint anterior à interrupção.
4. IF os dados persistidos de uma User_Activity interrompida estiverem corrompidos ou não puderem ser lidos ao reabrir a OutLife_Application, THEN THE OutLife_Application SHALL exibir ao usuário uma indicação de que a atividade não pôde ser recuperada e SHALL permitir apenas descartar essa User_Activity, sem exibir distância, duração ou trajeto derivados dos dados corrompidos.
5. WHEN uma User_Activity é recuperada com sucesso após uma interrupção do tipo descrito no Critério 3, THE OutLife_Application SHALL oferecer ao usuário a opção de retomar o rastreamento a partir do último ponto persistido ou de descartar a User_Activity, consistente com o fluxo de atividade órfã já existente, mantendo a User_Activity com status pendente e os pontos persistidos preservados até que o usuário faça essa escolha.
6. THE OutLife_Application SHALL exibir a User_Activity recuperada com a distância e a duração calculadas a partir exclusivamente dos pontos persistidos até a interrupção, sem exibir uma distância ou duração maior do que a efetivamente capturada.

### Requirement 4: Tipo de Atividade e Métricas de Pace/Velocidade Média

**User Story:** Como usuário rastreando uma atividade, quero informar se estou caminhando, pedalando ou fazendo trilha, e ver meu tempo médio (pace ou velocidade) durante e depois do rastreamento, para acompanhar meu desempenho como em apps de referência.

#### Acceptance Criteria

1. THE OutLife_Application SHALL permitir que o usuário selecione um Activity_Type (Caminhada, Pedalada, Trilha ou Outro) antes de iniciar o rastreamento de uma User_Activity.
2. IF o usuário tentar iniciar o rastreamento de uma User_Activity sem ter selecionado um Activity_Type, THEN THE OutLife_Application SHALL impedir o início do rastreamento e exibir uma mensagem indicando que a seleção do Activity_Type é obrigatória.
3. THE Production_Supabase_Project SHALL persistir o Activity_Type selecionado como parte da User_Activity.
4. WHILE uma User_Activity com Activity_Type igual a Caminhada ou Pedalada está com status `in_progress`, THE OutLife_Application SHALL exibir o Average_Pace, atualizado a cada 1 segundo, calculado a partir da distância e do tempo decorrido dessa User_Activity.
5. WHILE uma User_Activity com qualquer Activity_Type está com status `in_progress`, THE OutLife_Application SHALL exibir o Average_Speed, atualizado a cada 1 segundo, calculado a partir da distância e do tempo decorrido dessa User_Activity.
6. WHEN uma User_Activity com status `completed` é exibida na Activity_Detail_Screen, THE Activity_Detail_Screen SHALL exibir o Average_Speed final e, quando o Activity_Type for Caminhada ou Pedalada, também o Average_Pace final, ambos calculados a partir da distância e da duração totais persistidas dessa User_Activity.
7. IF o tempo decorrido de uma User_Activity em rastreamento for igual a zero, ou a distância percorrida não puder ser determinada, THEN THE OutLife_Application SHALL exibir o Average_Pace e o Average_Speed como indisponíveis, por meio de um indicador textual ou visual distinto de um valor numérico, em vez de realizar uma divisão por zero ou exibir um valor calculado a partir de dados inválidos.

### Requirement 5: Salvamento Confiável da Atividade (Sem Perda Silenciosa)

**User Story:** Como usuário que acabou de finalizar uma atividade rastreada, quero ter certeza de que meus dados foram salvos ou serão salvos automaticamente depois, para nunca perder o percurso registrado por causa de uma falha de rede ou do app sendo encerrado.

#### Acceptance Criteria

1. IF a finalização de uma User_Activity falhar por qualquer motivo (indisponibilidade de rede, erro do servidor, ausência de resposta do servidor por mais de 15 segundos, ou o Outlife_Native_Shell ser encerrado durante a chamada), THEN THE OutLife_Application SHALL enfileirar essa User_Activity na Activity_Sync_Queue local, em vez de descartar os dados rastreados.
2. WHEN a OutLife_Application é reaberta com conectividade de rede disponível e a Activity_Sync_Queue não estiver vazia, THE OutLife_Application SHALL tentar sincronizar cada User_Activity enfileirada com o Production_Supabase_Project, com um tempo limite de 15 segundos por tentativa de sincronização.
3. IF a tentativa de sincronização de uma User_Activity enfileirada falhar (incluindo por exceder o tempo limite definido no Critério 2), THEN THE OutLife_Application SHALL manter essa User_Activity na Activity_Sync_Queue para nova tentativa, sem removê-la e independentemente do número de tentativas anteriores.
4. WHEN uma User_Activity enfileirada é sincronizada com sucesso, THE OutLife_Application SHALL remover essa User_Activity da Activity_Sync_Queue.
5. IF o Outlife_Native_Shell for encerrado pelo sistema operacional enquanto uma User_Activity estiver em processo de finalização, THEN THE OutLife_Application SHALL preservar os dados dessa User_Activity já salvos localmente até o momento do encerramento, sem tentar concluir a persistência dessa User_Activity em segundo plano após o encerramento do Outlife_Native_Shell.
6. WHILE a Activity_Sync_Queue contém ao menos uma User_Activity pendente de sincronização, THE OutLife_Application SHALL exibir ao usuário uma indicação visual desse estado pendente.
7. WHEN a OutLife_Application for reaberta após o Outlife_Native_Shell ter sido encerrado durante a finalização de uma User_Activity, THE OutLife_Application SHALL concluir a persistência dessa User_Activity a partir dos dados salvos localmente até o momento do encerramento, sem exigir que o usuário rastreie a atividade novamente.
8. WHEN a conectividade de rede é restabelecida enquanto a OutLife_Application está em execução em primeiro plano e a Activity_Sync_Queue não estiver vazia, THE OutLife_Application SHALL tentar sincronizar cada User_Activity enfileirada com o Production_Supabase_Project, seguindo o mesmo comportamento de tentativa e tempo limite definido no Critério 2.
9. IF o registro de uma User_Activity na Activity_Sync_Queue falhar devido à indisponibilidade de armazenamento local, THEN THE OutLife_Application SHALL tentar novamente essa operação de enfileiramento até 3 vezes e, caso todas as tentativas falhem, exibir ao usuário uma mensagem de erro indicando que os dados da atividade podem não ter sido salvos.

### Requirement 6: Snapshot do Mapa Persistido no Resumo da Atividade

**User Story:** Como usuário revendo uma atividade já finalizada, quero ver uma imagem do mapa percorrido junto com as métricas, descrição e foto, para ter o resumo completo sem depender de recarregar o trajeto no mapa interativo.

#### Acceptance Criteria

1. WHEN uma User_Activity é finalizada com um trajeto válido (mínimo 2 pontos de localização registrados), THE OutLife_Application SHALL gerar um Activity_Map_Snapshot desse trajeto e persisti-lo associado a essa User_Activity.
2. WHEN a Activity_Detail_Screen de uma User_Activity com Activity_Map_Snapshot persistido é aberta, THE Activity_Detail_Screen SHALL exibir esse Activity_Map_Snapshot junto com as métricas, a descrição e a foto já existentes dessa User_Activity.
3. IF a geração do Activity_Map_Snapshot falhar ao finalizar uma User_Activity, THEN THE OutLife_Application SHALL persistir a User_Activity com suas métricas, descrição e foto (quando existentes), sem o Activity_Map_Snapshot, sem impedir o salvamento da atividade.
4. IF uma User_Activity for aberta na Activity_Detail_Screen sem um Activity_Map_Snapshot disponível (trajeto com menos de 2 pontos, falha na geração, ou arquivo persistido que não pôde ser carregado), THEN THE Activity_Detail_Screen SHALL exibir as métricas, a descrição e a foto já existentes dessa User_Activity sem a imagem do mapa, sem exibir mensagem de erro ao usuário.

### Requirement 7: Banner de Compartilhamento de Atividade

**User Story:** Como usuário que finalizou uma atividade, quero compartilhar um banner com o mapa e o resumo das métricas no WhatsApp, Instagram ou Facebook, para mostrar minha conquista sem precisar montar essa imagem manualmente.

#### Acceptance Criteria

1. THE Activity_Detail_Screen SHALL exibir uma ação para compartilhar a User_Activity exibida como um Share_Banner_Image.
2. WHEN a ação de compartilhar é selecionada na Activity_Detail_Screen, THE Banner_Generator SHALL iniciar, por renderização client-side, a composição de uma imagem combinando o Activity_Map_Snapshot, a distância, a duração e o Average_Pace ou Average_Speed dessa User_Activity, completando a geração em até 5 segundos.
3. IF a User_Activity não possuir um Activity_Map_Snapshot registrado (por exemplo, atividade sem dados de localização), THEN THE Banner_Generator SHALL compor o Share_Banner_Image utilizando apenas a distância, a duração e o Average_Pace ou Average_Speed disponíveis, omitindo o mapa da imagem.
4. WHILE o Banner_Generator estiver compondo o Share_Banner_Image, THE Activity_Detail_Screen SHALL exibir ao usuário uma indicação visual de que a geração está em andamento.
5. WHEN o Share_Banner_Image de uma User_Activity é gerado com sucesso, THE OutLife_Application SHALL invocar o mecanismo de compartilhamento já existente (`shareContent`) com essa imagem, permitindo o envio para WhatsApp, Instagram ou Facebook quando disponíveis no dispositivo.
6. IF o mecanismo de compartilhamento nativo não estiver disponível no dispositivo, THEN THE OutLife_Application SHALL oferecer ao usuário a opção de salvar ou copiar o Share_Banner_Image gerado, consistente com o comportamento de fallback já existente em `shareContent`.
7. IF a geração do Share_Banner_Image de uma User_Activity falhar — por erro de renderização ou por exceder o tempo máximo de 5 segundos definido no Critério 2 —, THEN THE OutLife_Application SHALL exibir uma mensagem de erro ao usuário e permitir que ele tente gerar o Share_Banner_Image novamente, sem abrir o mecanismo de compartilhamento com uma imagem incompleta ou corrompida.

### Requirement 8: Novas Categorias de Publicação na Comunidade (Pedalada e Caminhada)

**User Story:** Como usuário da Comunidade, quero publicar e filtrar relatos específicos de pedalada e caminhada, para encontrar e compartilhar conteúdo relevante para essas atividades, hoje só cobertas parcialmente pelas categorias existentes.

#### Acceptance Criteria

1. THE Production_Supabase_Project SHALL aceitar `pedalada` e `caminhada` como valores válidos de Community_Post_Category, além dos valores já existentes (`trilha`, `camping`, `relato`, `outro`).
2. THE formulário de criação de publicação na tela de Comunidade SHALL exibir Pedalada e Caminhada como opções selecionáveis de Community_Post_Category, posicionadas após as opções já existentes (Trilha, Camping, Relato, Outro), na ordem Pedalada seguida de Caminhada, com o mesmo comportamento de seleção única aplicado às demais opções.
3. THE menu de abas de filtro da tela de Comunidade SHALL exibir uma aba Pedalada e uma aba Caminhada, posicionadas após as abas de filtro já existentes, na ordem Pedalada seguida de Caminhada, com a mesma aparência (estilo, tamanho e espaçamento) e o mesmo comportamento de seleção única já aplicado às abas existentes.
4. WHEN a aba Pedalada é selecionada na tela de Comunidade, THE OutLife_Application SHALL exibir exclusivamente os Community_Post com Community_Post_Category igual a `pedalada`.
5. WHEN a aba Caminhada é selecionada na tela de Comunidade, THE OutLife_Application SHALL exibir exclusivamente os Community_Post com Community_Post_Category igual a `caminhada`.
6. IF a aba Pedalada ou a aba Caminhada for selecionada e não existir nenhum Community_Post com Community_Post_Category correspondente, THEN THE OutLife_Application SHALL exibir uma mensagem indicando que não há publicações nessa categoria, sem exibir publicações de outras categorias.

### Requirement 9: Exibição Visual da Categoria no Card de Publicação

**User Story:** Como usuário navegando pela Comunidade, quero ver o tipo de cada publicação diretamente no card, para identificar rapidamente se é uma trilha, camping, pedalada, caminhada, relato ou outro tipo de conteúdo, sem depender apenas do filtro de abas.

#### Acceptance Criteria

1. WHEN a tela de Comunidade renderiza o card de um Community_Post, THE OutLife_Application SHALL exibir o rótulo do Community_Post_Category dessa publicação em uma posição fixa e consistente no card, visível imediatamente, sem exigir toque, clique ou rolagem do usuário para ser visualizado.
2. THE OutLife_Application SHALL exibir, para cada Community_Post_Category exibido nos cards da tela de Comunidade, o mesmo rótulo traduzido já utilizado no seletor de categoria do formulário de criação de publicação.
3. IF um Community_Post não possuir um Community_Post_Category definido ou possuir um valor de categoria não reconhecido pelo sistema, THEN THE OutLife_Application SHALL exibir no card um rótulo padrão indicando categoria não especificada, sem deixar o espaço em branco ou exibir mensagem de erro.

### Requirement 10: Banner de Compartilhamento de Publicação da Comunidade

**User Story:** Como usuário da Comunidade, quero compartilhar uma publicação como um banner de imagem no WhatsApp, Instagram ou Facebook, para divulgar o conteúdo fora do app com a mesma facilidade já disponível para atividades.

#### Acceptance Criteria

1. THE card de cada Community_Post exibido na tela de Comunidade SHALL exibir uma ação para compartilhar essa publicação como um Share_Banner_Image, reaproveitando o botão de compartilhar já existente no card.
2. WHEN a ação de compartilhar é selecionada em um Community_Post, THE Banner_Generator SHALL compor, por renderização client-side, uma imagem combinando a foto da publicação, o rótulo do Community_Post_Category e o texto dessa publicação, truncado em 200 caracteres com reticências quando o texto exceder esse limite.
3. WHEN o Share_Banner_Image de um Community_Post é gerado com sucesso, THE OutLife_Application SHALL invocar o mecanismo de compartilhamento já existente (`shareContent`) com essa imagem, permitindo o envio para WhatsApp, Instagram ou Facebook quando disponíveis no dispositivo, independentemente de qualquer falha em funcionalidades não relacionadas à geração da imagem ou ao mecanismo de compartilhamento (por exemplo, uma falha no registro de estatísticas de compartilhamento) ocorrida durante a mesma operação.
4. IF a geração do Share_Banner_Image de um Community_Post falhar — por erro de renderização ou por exceder um tempo máximo de 10 segundos —, THEN THE OutLife_Application SHALL exibir uma mensagem de erro ao usuário e permitir que ele tente gerar o Share_Banner_Image novamente, sem abrir o mecanismo de compartilhamento com uma imagem incompleta ou corrompida.
5. IF um Community_Post não tiver foto associada, THEN THE Banner_Generator SHALL compor o Share_Banner_Image utilizando uma imagem de fundo padrão, sem impedir a geração do banner.

### Requirement 11: Notificações Push Nativas e Web Push

**User Story:** Como usuário da OutLife_Application, quero receber notificações na central de notificações do meu celular mesmo com o app fechado, para saber de eventos importantes (solicitação de amizade, curtida, etc.) sem precisar abrir o app para verificar.

#### Acceptance Criteria

1. WHERE a OutLife_Application está em execução dentro do Outlife_Native_Shell, WHEN o usuário autenticado concede permissão de notificações do sistema operacional durante o login ou ao abrir a OutLife_Application, THE OutLife_Application SHALL registrar um Native_Push_Token desse usuário através da API nativa de push do sistema operacional (FCM no Android, APNs no iOS), associado exclusivamente a essa conta de usuário e a esse dispositivo.
2. WHEN o usuário autenticado acessa a OutLife_Application fora do Outlife_Native_Shell através de um navegador que suporte a API de Web Push e concede a permissão de notificações solicitada, THE OutLife_Application SHALL registrar uma Web_Push_Subscription desse usuário para esse navegador e dispositivo, esteja a OutLife_Application instalada como PWA na tela inicial ou não, exceto pela limitação descrita no Critério 7.
3. WHEN um evento que atualmente cria uma Notification in-app ocorre e o usuário destinatário possui ao menos um Native_Push_Token ou Web_Push_Subscription ativo (conforme definido no Critério 8), THE Production_Supabase_Project SHALL também disparar uma Push_Notification para cada Native_Push_Token e cada Web_Push_Subscription ativos desse usuário, e a falha no envio para um token ou subscription específico SHALL NOT impedir o disparo de Push_Notification para os demais tokens ou subscriptions ativos desse usuário, nem a criação da Notification in-app correspondente.
4. WHEN uma Push_Notification é disparada para um usuário com a OutLife_Application fechada (cold start) ou em segundo plano nesse dispositivo, THE sistema operacional do dispositivo SHALL exibir essa Push_Notification na central de notificações nativa, fora da OutLife_Application.
5. WHEN uma Push_Notification exibida na central de notificações nativa é selecionada, THE OutLife_Application SHALL abrir, independentemente de estar completamente fechada (cold start) ou em segundo plano no momento da seleção, e navegar para a Notifications_Screen.
6. IF um usuário autenticado não tiver nenhum Native_Push_Token ou Web_Push_Subscription ativo, THEN THE Production_Supabase_Project SHALL continuar criando a Notification in-app normalmente e SHALL não disparar nenhuma tentativa de Push_Notification para esse usuário, sem impedir a criação da Notification por falta de canal de push.
7. WHERE um usuário acessa a OutLife_Application pelo navegador do iOS sem tê-la instalado como PWA na tela inicial, THE OutLife_Application SHALL impedir ativamente o registro de uma Web_Push_Subscription para esse usuário nesse navegador e SHALL continuar exibindo Notification exclusivamente dentro da Notifications_Screen, informando essa limitação da plataforma ao usuário.
8. IF um usuário revoga a permissão de notificações do sistema operacional, desinstala a OutLife_Application, ou realiza logout no Outlife_Native_Shell ou nesse navegador, THEN THE OutLife_Application SHALL invalidar o Native_Push_Token ou a Web_Push_Subscription associado a esse dispositivo e usuário, de modo que esse token ou subscription deixe de ser considerado ativo para fins dos Critérios 3 e 6.

### Requirement 12: Proxy Remoto para Busca de Destinos no Google Places no Build Nativo

**User Story:** Como responsável pelo produto, quero que a busca de destinos e fotos via Google Places continue funcionando na versão nativa do app, para não perder essa funcionalidade só porque o SPA_Build_Target não executa server functions.

#### Acceptance Criteria

1. WHEN a OutLife_Application em execução no SPA_Build_Target invoca a busca de destinos ou fotos via Google Places, THE OutLife_Application SHALL chamar, via HTTP, um endpoint remoto exposto pelo SSR_Build_Target — em vez de invocar diretamente uma TanStack Start server function local — enviando os mesmos parâmetros de busca aceitos hoje pela server function local e recebendo de volta uma estrutura de resultado (lista de destinos ou lista de fotos) equivalente à que essa server function local produziria.
2. THE endpoint HTTP remoto do Critério 1 SHALL preservar a proteção da Google_Places_Credential, sem expô-la ao cliente, consistente com a proteção já existente em `places.server.ts`.
3. THE endpoint HTTP remoto do Critério 1 SHALL aceitar chamadas originadas do Outlife_Native_Shell mesmo quando a origem de rede dessa chamada for distinta da origem do SSR_Build_Target.
4. IF uma chamada ao endpoint HTTP remoto do Critério 1 não estiver associada a uma sessão autenticada válida de um usuário da OutLife_Application, THEN THE endpoint HTTP remoto SHALL rejeitar essa chamada sem executar a busca no Google Places.
5. IF a chamada ao endpoint HTTP remoto do Critério 1 não retornar resposta dentro de 10 segundos, ou retornar com falha, a partir do Outlife_Native_Shell, THEN THE OutLife_Application SHALL tratar essa busca de destinos externos como indisponível para essa chamada — retornando um resultado vazio para essa busca, sem exibir mensagem de erro bloqueante ao usuário — sem aplicar nenhum novo mecanismo de busca alternativo, e sem interromper as demais funcionalidades do app.

## Fora de Escopo (registro de decisão)

- **Reabertura da decisão arquitetural híbrida**: o modelo Capacitor + módulo nativo dedicado de GPS + dois alvos de build é um ponto de partida confirmado com o usuário, não uma opção avaliada por este spec.
- **Reescrita de telas de CRUD existentes**: Comunidade, Marketplace, Perfil, Configurações, Notificações e Amigos permanecem 100% reaproveitadas do Outlife_Web_Core, sem reescrita nativa.
- **Contas de desenvolvedor em loja, assinatura de app e processo de build/release**: a criação de contas no Google Play Console e no Apple Developer Program, a assinatura de certificados/keystores, e o processo operacional de submissão às lojas são pré-requisitos operacionais do usuário, registrados aqui apenas como dependência — não são tarefas de codificação deste spec.
- **Pagamento e gateway de pagamento nativo**: permanece fora de escopo, já registrado como tal no spec `outlife-production-plan`.
- **Lista real de "seguidores"/"seguindo" e demais itens já registrados como Fora de Escopo** no spec `outlife-completar-funcionalidades` continuam fora de escopo aqui.
