# Requirements Document

## Introduction

A OutLife_Application é um marketplace outdoor colaborativo (React 19 + TanStack Router/Start, SSR via Vite/Nitro) que conecta aventureiros, guias, pousadas e empresas do ecossistema de turismo de aventura no Brasil. O backend é o Supabase (PostgreSQL + PostGIS + Auth + Storage + RLS), sem servidor de aplicação intermediário.

Este spec formaliza o plano de colocar a OutLife_Application em produção real, cobrindo o restante da Fundação_De_Infraestrutura, a preparação e validação do banco de dados (Fase Banco_E_Dados), a substituição de dados simulados por dados reais (Fase Features_Reais) e os requisitos de qualidade, observabilidade e SEO necessários antes de expor o produto a usuários reais (Fase Producao_E_Qualidade). A Fase_De_Escala (CDN dedicado, push notifications, gateway de pagamento, app mobile nativo) é registrada apenas como intenção futura e não gera Acceptance Criteria formais neste spec.

### Relação com specs anteriores (pré-condições já satisfeitas)

Este spec depende de dois trabalhos já concluídos no repositório, que **não são reabertos aqui**:

1. **Fundação_De_Infraestrutura (Fase 1 do plano original) — concluída.** Confirmado no histórico de commits (`chore: remove Lovable/Cloudflare dependencies, prepare for Vercel deploy`, `docs: add README with setup and deploy instructions`, `fix: use vercel preset for Nitro, remove custom server.ts`) e no código atual: não há mais dependências `@lovable.dev/*` nem `@cloudflare/vite-plugin`/`wrangler.jsonc` no projeto ativo (`vite.config.ts` usa `nitro({ preset: "vercel" })`), o repositório está conectado ao GitHub (`ClaudiosRangel/outlife-app`) e a implantação de produção na Vercel está funcional (`https://outlife-app.vercel.app/`, validada na task 6 do spec `migracao-supabase-proprio-lovable`).
2. **Migração para projeto Supabase próprio (spec `migracao-supabase-proprio-lovable`) — concluída.** Todos os Requirements 1-8 daquele spec estão marcados como concluídos (ver `docs/deprecation.md` e `docs/migration-log.md`): o New_Supabase_Project (`dxmbftbhmjjqtpjymakj`) está provisionado sob propriedade exclusiva do usuário, sem vínculo com a Lovable_Cloud; o Migration_Set (15 arquivos SQL) foi aplicado e validado como idempotente; a aplicação está reconectada em produção e local; o SMTP customizado (Resend, domínio `avidanaoesotrilhar.com.br`) está configurado e validado (SPF/DKIM/DMARC 100% pass); usuários de teste foram recriados; e o projeto Supabase legado (`soghvqpnyekmkdqprpka`) e a cópia na Lovable estão formalmente depreciados como `REFERENCE_ONLY`.

Uma pendência residual identificada durante este levantamento **não foi coberta** pelos dois trabalhos anteriores (que trataram apenas backend/dados, não o front-end estático): as tags `og:image` e `twitter:image` em `src/routes/__root.tsx` ainda referenciam uma URL de imagem de preview hospedada em `*.lovable.app`. Essa pendência é tratada como requirement formal na Fase Producao_E_Qualidade deste spec (Requirement 8).

Também foi confirmado durante este levantamento que os tiles de mapa (Leaflet + OpenStreetMap) citados no plano original da Fase Features_Reais já estão implementados e funcionais (`src/components/MapView.tsx`, `src/components/ActivityMap.tsx`) — não geram requirement novo.

### Decisão de arquitetura confirmada (mantida do plano original)

A decisão de manter o Supabase como backend (em vez de migrar para Neon) e hospedar o front-end na Vercel permanece válida e não é reaberta como requirement de decisão — está registrada aqui apenas como contexto:

- **Banco de dados**: Supabase (PostgreSQL + PostGIS + Auth + Storage + RLS), pois o modelo "client → Supabase" sem backend intermediário depende de Auth e Storage integrados, que o Neon não oferece nativamente.
- **Hospedagem**: Vercel (SSR via Nitro), com integração nativa ao Supabase.
- **Reavaliação futura**: migrar para Neon voltaria a ser considerado apenas se um backend próprio (ex: rotas de servidor dedicadas) for criado para lógica complexa, ou se o custo de storage do Supabase crescer desproporcionalmente.

## Glossary

- **OutLife_Application**: a aplicação web OutLife (React 19 + TanStack Router/Start, SSR), cujo código-fonte reside no OutLife_Repository.
- **OutLife_Repository**: o repositório Git próprio do usuário (`ClaudiosRangel/outlife-app`) contendo o código-fonte da OutLife_Application.
- **Production_Supabase_Project**: o projeto Supabase `dxmbftbhmjjqtpjymakj`, resultado do spec `migracao-supabase-proprio-lovable`, atualmente em uso pela OutLife_Application.
- **Vercel_Production_Deployment**: a implantação de produção da OutLife_Application na Vercel (`https://outlife-app.vercel.app/`), com integração automática de redeploy a partir do OutLife_Repository.
- **Seed_Dataset**: o conjunto de registros de referência (destinos turísticos brasileiros e parceiros demo) necessário para a OutLife_Application ser navegável e demonstrável sem dados de usuários reais. Corresponde aos 4 destinos e 8 parceiros atualmente presentes no Production_Supabase_Project.
- **Seed_Script**: um script versionado no OutLife_Repository, executável de forma idempotente, responsável por (re)criar o Seed_Dataset em qualquer instância do Production_Supabase_Project (ou de um projeto Supabase equivalente).
- **Mocked_Data_Function**: uma função de acesso a dados em `src/lib/api.ts` que hoje retorna um array ou objeto fixo, hardcoded no código-fonte, em vez de consultar o Production_Supabase_Project. Compreende `fetchUserTrails`, `fetchSavedDestinations`, `fetchFavoritePartners`, `fetchUserAchievements`, `fetchNextAdventure` e `fetchPartnerChart`.
- **Achievement_Rule**: uma regra de negócio que define as condições sob as quais um Achievement_Record é concedido a um usuário (ex: distância total percorrida, número de avaliações publicadas).
- **Achievement_Record**: um registro persistido no Production_Supabase_Project associando um usuário a um Achievement_Rule que ele já cumpriu.
- **Google_Places_Integration**: a integração com a Google Places API, hoje representada por stubs assíncronos em `src/services/external-api.ts` (`fetchDestinationsFromGoogle`, `fetchPlacesPhotos`) que retornam arrays vazios.
- **Google_Places_Credential**: a chave de API do Google Maps Platform necessária para autenticar chamadas à Google Places API, que deve ser protegida do lado servidor (nunca exposta no bundle do cliente).
- **PWA_Manifest**: o arquivo `manifest.json` (ou equivalente) que descreve a OutLife_Application como aplicativo instalável (nome, ícones, cores de tema, modo de exibição).
- **Error_Monitoring_Service**: o serviço de monitoramento de erros de produção a ser integrado à OutLife_Application (Sentry, conforme o plano original).
- **Analytics_Service**: o serviço de analytics de uso escolhido para a OutLife_Application, definido neste spec como Vercel Analytics.
- **E2E_Test_Suite**: a suíte de testes end-to-end automatizados dos fluxos principais da OutLife_Application, a ser configurada com a ferramenta padrão de mercado (Playwright), complementar aos testes unitários já existentes (Vitest).
- **Social_Preview_Image**: a imagem referenciada pelas meta tags `og:image` e `twitter:image` em `src/routes/__root.tsx`, exibida em prévias de compartilhamento social (WhatsApp, Twitter/X, etc.).
- **Rate_Limiting_Policy**: uma política de limitação de taxa de chamadas aplicada às RPCs do Production_Supabase_Project expostas ao cliente (ex: `finish_user_activity`, `increment_partner_profile_view`, `increment_partner_contact_click`), para mitigar abuso.
- **Production_Readiness_Gate**: o conjunto de condições que devem estar satisfeitas antes de a OutLife_Application ser considerada apta a receber usuários reais em volume (incluindo, entre outras, o upgrade do Production_Supabase_Project para o plano Pro).

## Requirements

### Requirement 1: Seed de dados versionado e reprodutível

**User Story:** Como desenvolvedor do OutLife, quero um Seed_Script versionado no repositório, para que o Seed_Dataset (destinos brasileiros reais e parceiros demo) possa ser recriado de forma confiável em qualquer instância do Production_Supabase_Project, sem depender de inserções manuais não documentadas.

#### Acceptance Criteria

1. THE OutLife_Repository SHALL conter um Seed_Script versionado que, quando executado contra o Production_Supabase_Project, insere o Seed_Dataset atualmente presente (os destinos e parceiros já cadastrados).
2. WHEN o Seed_Script é executado uma segunda vez contra um Production_Supabase_Project que já contém o Seed_Dataset, THE Seed_Script SHALL não duplicar nenhum registro do Seed_Dataset e SHALL não retornar erro de execução.
3. THE Seed_Script SHALL popular exclusivamente destinos com localização geográfica real no Brasil (latitude e longitude válidas dentro do território brasileiro) e parceiros com uma categoria válida definida pela OutLife_Application.
4. THE Production_Supabase_Project SHALL manter os buckets de storage `review-photos` e `partner-gallery` acessíveis independentemente de o Seed_Script já ter sido executado ou não, sem exigir criação manual adicional desses buckets.

### Requirement 2: Validação do fluxo funcional completo contra o Production_Supabase_Project

**User Story:** Como desenvolvedor do OutLife, quero validar de forma automatizada o fluxo principal do usuário (cadastro, login, exploração, avaliação), para detectar regressões antes de liberar a aplicação para usuários reais.

#### Acceptance Criteria

1. WHEN um novo usuário se cadastra na OutLife_Application, THE OutLife_Application SHALL criar a conta no Production_Supabase_Project e o perfil correspondente em `profiles` SHALL conter um nome não vazio e um papel (`role`) válido.
2. WHEN um usuário autenticado explora destinos, THE OutLife_Application SHALL exibir exclusivamente destinos com status `approved` do Production_Supabase_Project, sem exibir destinos com status `pending` de outros usuários.
3. WHEN um usuário autenticado submete uma avaliação (rating) para um destino ou parceiro, THE Production_Supabase_Project SHALL persistir a avaliação e SHALL conceder o XP correspondente às regras já implementadas (10, 30 ou 50 pontos conforme a presença de comentário e foto).
4. IF a submissão de uma avaliação incluir uma nota fora do intervalo de 1 a 5, THEN THE OutLife_Application SHALL rejeitar a submissão sem persistir nenhum registro em `reviews`.

### Requirement 3: Preparação do Production_Supabase_Project para volume de produção

**User Story:** Como responsável técnico do projeto, quero que o Production_Supabase_Project esteja preparado tecnicamente para o upgrade de plano, para que a transição para volume real de usuários não exija retrabalho de última hora.

#### Acceptance Criteria

1. THE OutLife_Repository SHALL conter, em documentação do projeto, um registro explícito do Production_Readiness_Gate indicando que o upgrade do Production_Supabase_Project para o plano Pro é uma etapa obrigatória antes do lançamento para usuários reais, incluindo o custo mensal estimado dessa etapa.
2. WHERE o upgrade do Production_Supabase_Project para o plano Pro ainda não tiver sido realizado, THE Production_Readiness_Gate SHALL permanecer registrado como pendente na documentação do projeto, sem bloquear o desenvolvimento das demais fases deste spec nem a implantação em produção das funcionalidades que já estiverem prontas.
3. WHEN o upgrade do Production_Supabase_Project para o plano Pro é concluído, THE documentação do Production_Readiness_Gate SHALL registrar essa condição específica como satisfeita imediatamente, independentemente do status das demais condições listadas no Critério 5.
4. IF a documentação do Production_Readiness_Gate for editada para marcá-lo como concluído antes de o upgrade do Production_Supabase_Project para o plano Pro ter sido efetivamente realizado, THEN essa marcação SHALL ser considerada inválida e o Production_Readiness_Gate SHALL permanecer registrado como pendente.
5. THE documentação do Production_Readiness_Gate SHALL listar as demais condições necessárias para o lançamento (Requirements 4 a 9 deste spec) além do upgrade de plano.

### Requirement 4: Substituição de Mocked_Data_Function por dados reais do usuário

**User Story:** Como usuário da OutLife_Application, quero que minhas trilhas, destinos salvos, parceiros favoritos e próxima aventura reflitam minha atividade real, para que o aplicativo mostre informações confiáveis em vez de dados de exemplo fixos.

#### Acceptance Criteria

1. WHEN `fetchUserTrails` é chamada para um usuário autenticado, THE OutLife_Application SHALL retornar as trilhas derivadas dos registros de `user_activities` concluídos (`status = 'completed'`) associados a esse usuário no Production_Supabase_Project, incluindo um array vazio quando esse usuário não tiver nenhuma atividade concluída registrada, em vez do array fixo atualmente retornado.
2. WHEN `fetchSavedDestinations` é chamada para um usuário autenticado, THE OutLife_Application SHALL retornar os destinos efetivamente salvos por esse usuário no Production_Supabase_Project, em vez do array fixo atualmente retornado.
3. WHEN `fetchFavoritePartners` é chamada para um usuário autenticado, THE OutLife_Application SHALL retornar os parceiros efetivamente marcados como favoritos por esse usuário no Production_Supabase_Project, em vez do array fixo atualmente retornado.
4. WHEN `fetchNextAdventure` é chamada para um usuário autenticado, THE OutLife_Application SHALL retornar a próxima atividade agendada real desse usuário no Production_Supabase_Project (ou `null` quando não houver nenhuma agendada), em vez do objeto fixo atualmente retornado.
5. IF um usuário não autenticado chamar qualquer uma das funções listadas nos Critérios 1 a 4, THEN THE OutLife_Application SHALL retornar um array vazio ou `null`, sem consultar dados de outro usuário e sem retornar erro não tratado.

### Requirement 5: Sistema de Achievement_Rule e Achievement_Record reais

**User Story:** Como usuário da OutLife_Application, quero desbloquear conquistas (achievements) com base na minha atividade real, para que a gamificação existente reflita meu progresso de fato, em vez de uma lista fixa de exemplos.

#### Acceptance Criteria

1. THE Production_Supabase_Project SHALL ter uma tabela dedicada a Achievement_Record, associando cada registro a um usuário e a um Achievement_Rule identificável.
2. WHEN um usuário autenticado cumpre as condições de um Achievement_Rule (com base em sua atividade real registrada no Production_Supabase_Project), THE Production_Supabase_Project SHALL criar um Achievement_Record correspondente para esse usuário, sem duplicar o mesmo Achievement_Rule mais de uma vez para o mesmo usuário.
6. IF as condições de um Achievement_Rule forem cumpridas por uma atividade associada a um usuário não autenticado no momento da avaliação, THEN THE Production_Supabase_Project SHALL não criar nenhum Achievement_Record para essa atividade.
3. WHEN `fetchUserAchievements` é chamada para um usuário autenticado, THE OutLife_Application SHALL retornar exclusivamente os Achievement_Record reais desse usuário, em vez da lista fixa de 8 conquistas atualmente retornada.
4. IF um usuário autenticado existente não tiver nenhum Achievement_Record, THEN THE OutLife_Application SHALL retornar um array vazio para esse usuário, sem erro.
5. IF a consulta a Achievement_Record falhar por qualquer motivo (erro de conexão, usuário inexistente, timeout de banco de dados, falha de permissão ou consulta malformada no Production_Supabase_Project), THEN THE OutLife_Application SHALL propagar o erro para tratamento pelo chamador, em vez de retornar um array vazio que mascare a falha.

### Requirement 6: Integração real com a Google Places API

**User Story:** Como usuário da OutLife_Application, quero que a busca de destinos e fotos utilize dados reais do Google Places quando disponíveis, para enriquecer a base de destinos além do Seed_Dataset cadastrado manualmente.

#### Acceptance Criteria

1. THE Google_Places_Credential SHALL ser armazenada exclusivamente em variável de ambiente do lado servidor, sem ser incluída em nenhum arquivo ou bundle enviado ao cliente (navegador).
2. WHEN `fetchDestinationsFromGoogle` é chamada com parâmetros de busca válidos, THE Google_Places_Integration SHALL retornar destinos reais obtidos da Google Places API através de uma função server-side (Edge Function ou server function) autenticada com o Google_Places_Credential, em vez do array vazio atualmente retornado pelo stub.
3. WHEN `fetchPlacesPhotos` é chamada com um `placeId` válido, THE Google_Places_Integration SHALL retornar as fotos reais desse local obtidas da Google Places API através de uma função server-side autenticada com o Google_Places_Credential, incluindo as atribuições exigidas pelo Google Places, em vez do array vazio atualmente retornado pelo stub.
4. IF o Google_Places_Credential não estiver configurado ou não puder ser resolvido pela função server-side, THEN THE Google_Places_Integration SHALL retornar um array vazio para a função chamada, sem executar nenhuma chamada à Google Places API.
5. IF a chamada à Google Places API falhar (erro de rede, limite de cota excedido, credencial inválida), THEN THE Google_Places_Integration SHALL retornar um array vazio para a função chamada e SHALL tentar registrar o erro para diagnóstico como melhor esforço, sem que uma falha nesse registro impeça o retorno do array vazio nem propague uma exceção não tratada para a interface do usuário.

### Requirement 7: PWA instalável

**User Story:** Como usuário da OutLife_Application, quero poder instalar o aplicativo no meu celular a partir do navegador, para acessá-lo como um aplicativo nativo sem depender de loja de aplicativos.

#### Acceptance Criteria

1. THE OutLife_Application SHALL expor um PWA_Manifest válido, referenciado pelo HTML da aplicação, contendo nome, ícones em pelo menos dois tamanhos e cor de tema.
2. WHEN a OutLife_Application é acessada por um navegador compatível com PWA (Chrome, Edge ou equivalente) em um dispositivo móvel, THE navegador SHALL identificar a OutLife_Application como instalável, com base no PWA_Manifest e na presença de um service worker registrado.

### Requirement 8: SEO e remoção de dependência residual da Lovable na Social_Preview_Image

**User Story:** Como responsável pelo produto, quero que a OutLife_Application tenha metadados de SEO corretos e uma Social_Preview_Image hospedada em infraestrutura própria, para melhorar a indexação em buscadores e eliminar a última referência visível à plataforma Lovable.

#### Acceptance Criteria

1. THE OutLife_Application SHALL expor um arquivo `sitemap.xml` acessível publicamente, listando as rotas públicas navegáveis sem autenticação (página inicial, exploração, marketplace).
2. THE meta tags `og:image` e `twitter:image` em `src/routes/__root.tsx` SHALL referenciar exclusivamente uma Social_Preview_Image hospedada no OutLife_Repository ou em um domínio de propriedade do usuário, sem nenhuma ocorrência do domínio `lovable.app` ou de qualquer subdomínio associado à Lovable.
3. THE páginas navegáveis sem autenticação da OutLife_Application SHALL definir um título (`<title>`) e uma meta descrição (`description`) específicos da página, distintos do título e descrição genéricos usados atualmente em toda a aplicação.

### Requirement 9: Monitoramento de erros e analytics de uso em produção

**User Story:** Como responsável técnico do projeto, quero monitorar erros de produção e o uso real da aplicação, para identificar e corrigir problemas antes que afetem um volume maior de usuários.

#### Acceptance Criteria

1. WHEN um erro não tratado ocorre em produção (Vercel_Production_Deployment) durante a renderização ou execução de uma rota da OutLife_Application, THE Error_Monitoring_Service SHALL registrar esse erro com a stack trace e a rota em que ocorreu.
2. WHEN um usuário efetivamente visualiza o conteúdo de uma rota navegável da OutLife_Application, THE Analytics_Service (Vercel Analytics) SHALL registrar essa visualização de página, sem registrar visualizações para rotas que não chegaram a ser renderizadas para o usuário.
3. IF a integração do Error_Monitoring_Service falhar ao inicializar, THEN a falha SHALL ser registrada em log e SHALL não impedir o carregamento normal da OutLife_Application para o usuário.
4. IF a integração do Analytics_Service falhar ao inicializar, THEN THE OutLife_Application SHALL continuar carregando normalmente para o usuário, aceitando a perda das visualizações de página não registradas até que o Analytics_Service seja restabelecido, sem exigir um mecanismo alternativo de rastreamento.

### Requirement 10: Suíte de testes E2E dos fluxos principais

**User Story:** Como desenvolvedor do OutLife, quero uma E2E_Test_Suite automatizada dos fluxos principais, para detectar regressões de ponta a ponta antes de cada implantação em produção.

#### Acceptance Criteria

1. THE OutLife_Repository SHALL conter uma E2E_Test_Suite configurada com a ferramenta padrão de mercado para testes end-to-end em aplicações web (Playwright), executável através de um comando de projeto dedicado, distinto do comando de testes unitários (Vitest) já existente.
2. THE E2E_Test_Suite SHALL cobrir, no mínimo, os fluxos de cadastro de novo usuário, login e submissão de uma avaliação, executados contra uma instância de teste da OutLife_Application.
3. WHEN qualquer teste da E2E_Test_Suite falha, THE execução SHALL indicar claramente qual fluxo e qual asserção falharam, permitindo diagnóstico sem necessidade de execução manual adicional.

### Requirement 11: Otimização de imagens

**User Story:** Como usuário da OutLife_Application, quero que as imagens carreguem rapidamente mesmo em conexões móveis mais lentas, para ter uma experiência fluida ao navegar pela aplicação.

#### Acceptance Criteria

1. WHEN uma imagem de review ou de galeria de parceiro é enviada através de `uploadReviewPhoto` ou `uploadPartnerGalleryImage`, THE OutLife_Application SHALL redimensionar ou comprimir a imagem antes ou durante o armazenamento, de forma que o arquivo final armazenado no Production_Supabase_Project não exceda o limite de tamanho já validado nessas funções (5 MB) com qualidade visual preservada.
2. THE imagens de destinos e parceiros exibidas nas rotas navegáveis da OutLife_Application SHALL ser carregadas com carregamento adiado (lazy loading) para imagens fora da área visível inicial da tela.

### Requirement 12: Rate_Limiting_Policy nas RPCs expostas ao cliente

**User Story:** Como responsável técnico do projeto, quero limitar a taxa de chamadas às RPCs do Production_Supabase_Project expostas diretamente ao cliente, para reduzir o risco de abuso antes de a aplicação receber tráfego real.

#### Acceptance Criteria

1. THE Production_Supabase_Project SHALL aplicar uma Rate_Limiting_Policy às RPCs `finish_user_activity`, `increment_partner_profile_view` e `increment_partner_contact_click`, limitando o número de chamadas aceitas por usuário autenticado dentro de uma janela de tempo definida.
2. IF um usuário exceder o limite definido pela Rate_Limiting_Policy para uma dessas RPCs, THEN a chamada excedente SHALL ser rejeitada pelo Production_Supabase_Project e a OutLife_Application SHALL exibir uma mensagem informando que o limite foi atingido, sem persistir o efeito da chamada rejeitada.

## Fase de Escala (registro de intenção futura — fora do escopo de Acceptance Criteria deste spec)

Os itens abaixo, herdados do plano original, permanecem como direção estratégica para depois da estabilização das Fases Banco_E_Dados, Features_Reais e Producao_E_Qualidade. Não geram Requirements EARS neste documento; poderão originar um spec dedicado quando priorizados:

- CDN dedicado para imagens (Cloudflare R2 ou equivalente), além do que a Vercel já oferece por padrão.
- Read replicas do Production_Supabase_Project, se a distribuição geográfica de usuários justificar.
- Push notifications (OneSignal ou Firebase Cloud Messaging).
- Gateway de pagamento para parceiros (Stripe ou Pix via Mercado Pago).
- Aplicativo mobile nativo (React Native/Expo) reaproveitando a lógica de negócio existente.
- Cache mais agressivo com React Query (ajuste fino de `staleTime`/`gcTime`) conforme padrões de uso reais forem observados.

## Estimativa de Custos Mensais (contexto, não normativo)

| Faixa de usuários | Vercel | Supabase | Outros | Total estimado |
|---|---|---|---|---|
| 0-10k | Pro ($20/mês) | Pro ($25/mês) | Domínio ~R$40/ano | ~$45/mês |
| 10k-100k | Pro + usage | Pro + add-ons ($25-75/mês) | CDN ~$5-15/mês | ~$60-110/mês |
| 100k-1M | Enterprise/Team ($150-400/mês) | Team ($599/mês) | CDN/Storage + Monitoring ~$50-100/mês | ~$800-1100/mês |

Esta tabela é mantida como referência de planejamento financeiro e não corresponde a um Acceptance Criteria testável.
