# Requirements Document

## Introduction

O projeto Supabase atualmente usado pela aplicação OutLife (`soghvqpnyekmkdqprpka`) foi originalmente provisionado pela plataforma **Lovable** (lovable.dev) através do recurso "Lovable Cloud". Durante a execução do spec `email-transacional-dominio-proprio`, foi descoberto que esse provisionamento inclui uma Edge Function própria da Lovable que intercepta o envio de e-mails de autenticação, ignorando a configuração nativa de SMTP customizado do Supabase Auth — mesmo com o domínio próprio (`avidanaoesotrilhar.com.br`, via Resend) corretamente configurado e salvo no Supabase Dashboard.

O código-fonte da aplicação já está desacoplado da Lovable no repositório Git próprio do usuário (sem dependências `@lovable.dev/*`), mas o projeto Supabase que esse código utiliza ainda é o mesmo originalmente criado pela Lovable Cloud, e pode conter outras integrações ou provisionamentos escondidos além da Edge Function de e-mail (webhooks, triggers, policies de storage específicas). Existe também uma cópia do projeto ainda hospedada na própria plataforma Lovable, no local onde foi originalmente criado.

O projeto OutLife ainda **não está em produção** — é fase de construção, e os aproximadamente 10 usuários existentes no projeto Supabase atual são todos de teste, sem dados de valor de produção.

Em vez de tentar remover cirurgicamente a interceptação da Lovable dentro do projeto Supabase atual (abordagem arriscada, dado o risco de provisionamentos escondidos adicionais), a decisão tomada é criar um **novo projeto Supabase**, do zero, sob propriedade e controle exclusivos do usuário, sem qualquer vínculo com a Lovable Cloud. Este spec cobre a criação desse projeto novo, a aplicação do schema completo via as migrations SQL já existentes no repositório, a reconexão da aplicação (Vercel + ambiente local), a reconfiguração do SMTP customizado já validado, a validação de entrega de e-mail com o domínio próprio, a recriação dos usuários de teste, e a depreciação formal do projeto antigo e da cópia na Lovable.

Este spec possui dependências diretas com dois outros specs do mesmo repositório:

- **`email-transacional-dominio-proprio`**: documentou e executou a configuração de SMTP customizado (Resend/DNS) no projeto Supabase antigo, e identificou o bloqueio causado pela interceptação da Lovable. O Requirement 4 daquele spec (validação de entrega de e-mail) permanece bloqueado até que este spec seja concluído.
- **`outlife-production-plan`**: define o plano de liberação de produção do OutLife (Vercel + Supabase). Nenhuma fase de liberação de produção descrita naquele plano deve avançar enquanto a aplicação ainda depender do projeto Supabase provisionado pela Lovable Cloud.

## Glossary

- **OutLife_Application**: a aplicação web OutLife (React + TanStack Router/Start), cujo código-fonte reside no OutLife_Repository.
- **OutLife_Repository**: o repositório Git próprio do usuário contendo o código-fonte da OutLife_Application, incluindo a pasta `supabase/migrations/`.
- **Legacy_Supabase_Project**: o projeto Supabase `soghvqpnyekmkdqprpka`, originalmente provisionado pela Lovable Cloud, atualmente em uso pela OutLife_Application.
- **Lovable_Cloud**: o recurso de infraestrutura da plataforma Lovable (lovable.dev) responsável por provisionar o Legacy_Supabase_Project e por interceptar o envio de e-mails de autenticação através de Edge Function própria, conforme documentado em https://docs.lovable.dev/features/custom-emails.
- **Lovable_Platform_Copy**: a cópia do projeto OutLife que ainda existe na plataforma Lovable, no local onde o projeto foi originalmente criado.
- **New_Supabase_Project**: o novo projeto Supabase a ser criado do zero neste spec, de propriedade exclusiva do usuário, sem qualquer vínculo, Edge Function ou provisionamento originado da Lovable_Cloud.
- **Migration_Set**: o conjunto dos 15 arquivos SQL existentes em `supabase/migrations/` no OutLife_Repository, aplicados em ordem cronológica de timestamp de nome de arquivo.
- **Responsible_Technical**: a pessoa responsável por executar as etapas técnicas manuais desta migração (criação do projeto, aplicação das migrations, atualização de variáveis de ambiente, configuração de SMTP, validação de e-mail).
- **Vercel_Environment**: o conjunto de variáveis de ambiente configuradas no dashboard da Vercel para o projeto de deploy da OutLife_Application.
- **Local_Environment**: o arquivo `.env` usado no ambiente de desenvolvimento local da OutLife_Application.
- **SMTP_Configuration**: a configuração de SMTP customizado (Resend) no Supabase Auth, com os parâmetros definidos no spec `email-transacional-dominio-proprio` (host `smtp.resend.com`, porta `587`, usuário `resend`, remetente `naoresponda@avidanaoesotrilhar.com.br`, nome de exibição `OutLife`).
- **Sender_Domain**: o domínio `avidanaoesotrilhar.com.br`, já verificado no Resend conforme o spec `email-transacional-dominio-proprio`.
- **Confirmation_Email**: o e-mail de confirmação de cadastro enviado pelo Supabase Auth ao criar um novo usuário.
- **Authentication_Results**: os cabeçalhos de autenticação de e-mail (SPF, DKIM, DMARC) presentes no cabeçalho completo de um e-mail recebido, usados para verificar a autenticidade do remetente.
- **Test_User_Record**: um usuário de teste recriado manualmente no New_Supabase_Project para fins de desenvolvimento, testes funcionais e validação de e-mail.
- **Test_Signup_Record**: termo definido no spec `email-transacional-dominio-proprio`, referente a um cadastro de teste criado para validar a entrega e autenticação de e-mails transacionais.

## Requirements

### Requirement 1: Provisionamento de um novo projeto Supabase sob controle exclusivo do usuário

**User Story:** Como responsável técnico do projeto OutLife, quero um novo projeto Supabase criado do zero e de propriedade exclusiva do usuário, para eliminar qualquer vínculo, Edge Function ou provisionamento herdado da Lovable_Cloud.

#### Acceptance Criteria

1. WHEN Responsible_Technical cria o New_Supabase_Project, THE New_Supabase_Project SHALL ser criado em uma conta/organização Supabase na qual Responsible_Technical seja o único proprietário (Owner), sem nenhum membro, colaborador, método de cobrança ou vínculo de organização associado à conta ou organização da Lovable_Cloud.
2. WHEN o New_Supabase_Project é criado, THE Responsible_Technical SHALL verificar, através do Supabase Dashboard ou da CLI oficial do Supabase, que a lista de Edge Functions, de webhooks e de Auth Hooks do New_Supabase_Project está vazia imediatamente após a criação, confirmando a ausência de qualquer artefato herdado do Legacy_Supabase_Project.
3. IF o fluxo de criação do New_Supabase_Project for iniciado através de qualquer recurso da plataforma Lovable (Lovable Cloud, duplicação de projeto, importação de projeto), THEN Responsible_Technical SHALL abortar esse fluxo imediatamente, independentemente do progresso já realizado nesse fluxo, e criar o New_Supabase_Project diretamente pelo Supabase Dashboard ou pela CLI oficial do Supabase. IF a criação direta pelo Supabase Dashboard ou pela CLI oficial falhar após o abandono do fluxo da Lovable, THEN Responsible_Technical SHALL continuar tentando a criação direta exclusivamente por esses meios, sem retomar ou reiniciar o fluxo através da plataforma Lovable em nenhuma hipótese.
4. THE New_Supabase_Project SHALL usar a mesma versão major do PostgreSQL utilizada pelo Legacy_Supabase_Project.
5. THE New_Supabase_Project SHALL ter habilitadas as mesmas extensões (PostGIS, pgcrypto) habilitadas no Legacy_Supabase_Project.
6. IF a versão major do PostgreSQL ou qualquer uma das extensões (PostGIS, pgcrypto) utilizadas pelo Legacy_Supabase_Project não estiver disponível para o New_Supabase_Project no momento da criação, THEN Responsible_Technical SHALL registrar essa indisponibilidade e obter aprovação explícita antes de prosseguir com uma versão do PostgreSQL ou um conjunto de extensões diferente do utilizado pelo Legacy_Supabase_Project.
7. WHEN o New_Supabase_Project é criado com sucesso, THE Responsible_Technical SHALL registrar o Project_ID e a Project_URL do New_Supabase_Project em um registro acessível e recuperável pelos Requirements subsequentes desta migração.

### Requirement 2: Aplicação do schema completo via migrations SQL existentes

**User Story:** Como desenvolvedor do OutLife, quero aplicar o Migration_Set no New_Supabase_Project, para recriar o schema completo (tabelas, triggers, RLS policies, functions e buckets de storage) sem depender de uma cópia ou dump do projeto antigo.

#### Acceptance Criteria

1. WHEN Responsible_Technical aplica o Migration_Set no New_Supabase_Project, THE Responsible_Technical SHALL executar, uma única vez cada, os 15 arquivos SQL de `supabase/migrations/`, na ordem cronológica de seus timestamps de nome de arquivo, do primeiro ao último.
2. WHEN todos os arquivos do Migration_Set forem executados com sucesso, THE New_Supabase_Project SHALL conter as tabelas `profiles`, `destinations`, `services`, `reviews`, `user_activities`, `user_checklists`, `user_friends` e `community_posts`, sem nenhuma dessas tabelas ausente.
3. WHEN todos os arquivos do Migration_Set forem executados com sucesso, THE New_Supabase_Project SHALL conter os buckets de storage `review-photos` e `partner-gallery`, com as storage policies definidas no Migration_Set, sem nenhum bucket ou policy ausente.
4. WHEN todos os arquivos do Migration_Set forem executados com sucesso, THE New_Supabase_Project SHALL ter todas as RLS policies, triggers e functions (incluindo as RPCs `SECURITY DEFINER`, como as responsáveis por finalizar atividades e incrementar métricas/XP de reviews) definidas no Migration_Set, sem nenhum objeto ausente.
5. IF a execução de algum arquivo do Migration_Set falhar (erro de SQL, dependência ausente, extensão não habilitada), THEN Responsible_Technical SHALL interromper a execução dos arquivos subsequentes do Migration_Set, garantir que nenhuma alteração parcial do arquivo com falha permaneça persistida no New_Supabase_Project (rollback), corrigir a causa da falha, e retomar a execução a partir do arquivo que falhou.
6. WHEN a aplicação do Migration_Set for concluída, THE Responsible_Technical SHALL validar, por meio de consulta ao catálogo do PostgreSQL (`information_schema` ou equivalente), que a contagem de tabelas, triggers, RLS policies e functions no New_Supabase_Project apresenta diferença igual a zero em relação à contagem de instruções DDL correspondentes presentes nos arquivos do Migration_Set.
7. WHEN o Migration_Set é executado uma segunda vez no New_Supabase_Project após a aplicação inicial, THE segunda execução SHALL não gerar erro de SQL e SHALL resultar na mesma contagem de objetos (tabelas, triggers, RLS policies, functions) obtida na primeira execução, confirmando a idempotência do Migration_Set.

### Requirement 3: Reconexão da aplicação ao projeto Supabase novo

**User Story:** Como desenvolvedor do OutLife, quero atualizar as variáveis de ambiente na Vercel e no ambiente local, para que a OutLife_Application passe a operar exclusivamente contra o New_Supabase_Project.

#### Acceptance Criteria

1. WHEN Responsible_Technical atualiza o Vercel_Environment, THE Vercel_Environment SHALL conter as variáveis `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID` e `VITE_SUPABASE_PROJECT_ID` com valores idênticos aos fornecidos pelo dashboard do New_Supabase_Project, sem nenhum valor remanescente do projeto Supabase anterior.
2. WHEN Responsible_Technical atualiza o Local_Environment, THE Local_Environment SHALL conter as mesmas seis variáveis de ambiente listadas no Critério 1 com valores idênticos aos fornecidos pelo dashboard do New_Supabase_Project, sem nenhum valor remanescente do projeto Supabase anterior.
3. WHEN qualquer uma das seis variáveis do Vercel_Environment listadas no Critério 1 é atualizada, independentemente de quem realizou a atualização (Responsible_Technical ou qualquer outra pessoa com acesso ao dashboard da Vercel), THE OutLife_Application SHALL ser reimplantada (redeploy) na Vercel em até 10 minutos após a atualização, concluindo a implantação sem erros antes de as novas variáveis de ambiente serem consideradas em vigor.
4. WHEN a OutLife_Application em produção (Vercel) é acessada após o redeploy, THE OutLife_Application SHALL completar, sem mensagem de erro, os fluxos de cadastro de novo usuário (com criação de conta confirmada), login (com sessão autenticada estabelecida) e leitura de dados (destinos, perfis) retornando os dados sem erro, utilizando exclusivamente endpoints do New_Supabase_Project.
5. WHEN a OutLife_Application é executada em ambiente de desenvolvimento local com o Local_Environment atualizado, THE OutLife_Application SHALL completar, sem mensagem de erro, os fluxos de cadastro de novo usuário (com criação de conta confirmada), login (com sessão autenticada estabelecida) e leitura de dados (destinos, perfis) retornando os dados sem erro, utilizando exclusivamente endpoints do New_Supabase_Project.
6. THE arquivo `supabase/config.toml` no OutLife_Repository SHALL referenciar exclusivamente o Project_ID do New_Supabase_Project, sem nenhum caractere remanescente do Project_ID do projeto Supabase anterior.
7. IF algum dos fluxos de cadastro, login ou leitura de dados falhar em produção ou em ambiente local após a atualização das variáveis de ambiente, THEN THE OutLife_Application SHALL exibir uma mensagem de erro observável ao usuário e SHALL NOT persistir dados parciais ou inconsistentes referentes ao fluxo que falhou.
8. IF, no momento do redeploy, qualquer uma das seis variáveis de ambiente listadas no Critério 1 estiver ausente, vazia ou apontando para o Project_ID do projeto Supabase anterior, THEN o redeploy SHALL ser considerado falho e a OutLife_Application SHALL continuar operando com a última configuração de ambiente válida até que a variável seja corrigida.
9. WHILE a OutLife_Application estiver em execução com o Vercel_Environment ou o Local_Environment atualizado, THE OutLife_Application SHALL rejeitar qualquer tentativa de conexão direcionada ao Project_ID do Supabase anterior, tratando essa tentativa como falha de configuração.

### Requirement 4: Reconfiguração do SMTP customizado no projeto novo

**User Story:** Como responsável técnico, quero reaplicar no New_Supabase_Project a configuração de SMTP customizado (Resend) já validada no projeto antigo, para manter os e-mails de autenticação usando o domínio próprio sem repetir todo o trabalho de configuração de DNS.

#### Acceptance Criteria

1. WHEN Responsible_Technical configurar o SMTP_Configuration no New_Supabase_Project, THE Responsible_Technical SHALL definir host `smtp.resend.com`, porta `587`, usuário `resend`, senha igual à API key do Resend já utilizada no Legacy_Supabase_Project, remetente `naoresponda@avidanaoesotrilhar.com.br` e nome de exibição `OutLife`, sem alterar nenhum desses valores em relação ao Legacy_Supabase_Project.
2. THE Responsible_Technical SHALL habilitar o SMTP_Configuration no New_Supabase_Project mediante uma ação explícita e manual, distinta do salvamento dos campos de configuração, sendo essa a única forma de habilitação permitida.
3. IF a verificação do Sender_Domain e o cadastro dos registros DNS necessários já tiverem sido concluídos conforme o spec `email-transacional-dominio-proprio`, THEN THE Responsible_Technical SHALL reaproveitar esse trabalho e aplicar apenas a configuração do SMTP_Configuration no New_Supabase_Project, sem repetir a verificação do Sender_Domain ou o cadastro de registros DNS.
4. IF o salvamento ou a habilitação do SMTP_Configuration no New_Supabase_Project for rejeitado por host, porta, credenciais ou remetente inválidos, THEN THE Responsible_Technical SHALL corrigir, no campo apontado pela mensagem de erro exibida pelo New_Supabase_Project, o valor inválido antes de tentar habilitar o SMTP_Configuration novamente, mantendo inalterada qualquer configuração de SMTP válida aplicada anteriormente.
5. IF a verificação do Sender_Domain ou o cadastro dos registros DNS necessários ainda não tiverem sido concluídos, THEN THE Responsible_Technical SHALL concluir essa verificação e esse cadastro antes de habilitar o SMTP_Configuration no New_Supabase_Project.

### Requirement 5: Validação de entrega de e-mail com domínio próprio no projeto novo

**User Story:** Como responsável técnico, quero validar que o Confirmation_Email enviado pelo New_Supabase_Project usa o Sender_Domain, para confirmar que a interceptação da Lovable_Cloud não está mais presente.

#### Acceptance Criteria

1. WHEN Responsible_Technical cria um Test_User_Record através de cadastro no New_Supabase_Project, utilizando um endereço de e-mail de destinatário de teste hospedado em um provedor de e-mail externo e independente da infraestrutura do Sender_Domain e da Lovable_Cloud (por exemplo, Gmail, Outlook ou Yahoo), THE New_Supabase_Project SHALL enviar um Confirmation_Email com remetente do Sender_Domain (`avidanaoesotrilhar.com.br`) que chegue à caixa de entrada principal desse destinatário de teste (não à pasta de spam ou lixo eletrônico) em até 30 minutos a partir da criação do Test_User_Record.
2. THE Confirmation_Email enviado pelo New_Supabase_Project SHALL não conter, nem no endereço de remetente nem nos domínios referenciados pelos mecanismos SPF e DKIM presentes nos Authentication_Results, nenhuma ocorrência do domínio `lovable-app.email`.
3. WHEN Responsible_Technical inspeciona o cabeçalho completo (conteúdo integral do e-mail, não a visualização resumida do cliente de e-mail) do Confirmation_Email recebido, THE Authentication_Results SHALL indicar `spf=pass` e `dkim=pass` para o Sender_Domain.
4. WHERE DMARC estiver habilitado na zona de DNS do Sender_Domain, THE Authentication_Results SHALL também indicar `dmarc=pass`.
5. IF, após 3 tentativas consecutivas de validação com Test_User_Record distintos, o Confirmation_Email continuar não chegando à caixa de entrada principal em até 30 minutos ou os Authentication_Results continuarem não indicando `pass` para os itens aplicáveis, THEN Responsible_Technical SHALL suspender novas tentativas e escalar o problema para revisão manual da DNS_Zone do Sender_Domain e do SMTP_Configuration do New_Supabase_Project antes de qualquer nova tentativa.
6. IF o Confirmation_Email de um Test_User_Record não chegar à caixa de entrada principal em até 30 minutos, ou os Authentication_Results não indicarem `pass` para os itens aplicáveis (SPF, DKIM e, quando aplicável, DMARC), THEN Responsible_Technical SHALL investigar o SMTP_Configuration do New_Supabase_Project e repetir a validação com um novo Test_User_Record, respeitando o limite de tentativas definido no critério 5.

### Requirement 6: Recriação manual dos usuários de teste

**User Story:** Como desenvolvedor do OutLife, quero recriar manualmente os usuários de teste necessários no New_Supabase_Project, para continuar o desenvolvimento e os testes sem depender de migração de dados do projeto antigo.

#### Acceptance Criteria

1. THE Responsible_Technical SHALL recriar manualmente, no New_Supabase_Project, no mínimo 1 (um) Test_User_Record para cada tipo de perfil distinto exigido pelos casos de teste funcionais da OutLife_Application, de modo que todo tipo de perfil utilizado nesses testes tenha ao menos um Test_User_Record correspondente disponível.
2. THE Responsible_Technical SHALL NOT executar migração de dados de usuários do Legacy_Supabase_Project para o New_Supabase_Project, uma vez que os registros de usuário existentes no Legacy_Supabase_Project são exclusivamente Test_User_Record sem valor de produção.
3. WHEN um Test_User_Record é recriado no New_Supabase_Project, THE Test_User_Record SHALL ter um registro em `profiles` associado, contendo um nome não vazio e um tipo de perfil correspondente a um dos tipos de perfil válidos definidos pela OutLife_Application.
4. IF o registro em `profiles` associado a um Test_User_Record recriado não contiver um nome não vazio ou não contiver um tipo de perfil válido, THEN o Test_User_Record SHALL ser considerado incompleto e SHALL NOT ser utilizado nos testes funcionais até que o Responsible_Technical corrija os dados do registro.
5. WHEN um Test_User_Record é recriado no New_Supabase_Project, THE Test_User_Record SHALL permitir autenticação bem-sucedida na OutLife_Application utilizando as credenciais definidas durante a recriação.

### Requirement 7: Depreciação do projeto antigo e da cópia na Lovable

**User Story:** Como dono do projeto OutLife, quero registrar formalmente que o Legacy_Supabase_Project e a Lovable_Platform_Copy deixam de ser usados, para que o OutLife_Repository seja a única fonte de verdade do código e da infraestrutura de dados.

#### Acceptance Criteria

1. WHEN a migração para o New_Supabase_Project é validada como bem-sucedida (Requirements 2, 3, 4 e 5 concluídos), THE Responsible_Technical SHALL registrar, em documentação do projeto e em até 5 dias corridos após a validação, a depreciação do Legacy_Supabase_Project, incluindo a data da migração, o status REFERENCE_ONLY atribuído e os recursos afetados (banco de dados, Auth, Storage).
2. WHEN a migração para o New_Supabase_Project é validada como bem-sucedida, THE Lovable_Platform_Copy SHALL ser classificada como REFERENCE_ONLY (mantida apenas como referência histórica, sem uso operacional), de forma que nenhuma implantação (deploy) subsequente da OutLife_Application tenha a Lovable_Platform_Copy como origem.
3. WHEN a migração para o New_Supabase_Project é validada como bem-sucedida, THE OutLife_Repository SHALL ser registrado, na documentação do projeto, como a única fonte de verdade do código-fonte da OutLife_Application.
4. THE documentação de depreciação SHALL informar que o Legacy_Supabase_Project não deve ser excluído imediatamente após a migração, sendo mantido apenas como referência histórica (status REFERENCE_ONLY) até que o Responsible_Technical registre uma confirmação final, baseada em revisão técnica documentada, de que nenhum componente da OutLife_Application depende dele.

### Requirement 8: Ordem de execução em relação aos specs `email-transacional-dominio-proprio` e `outlife-production-plan`

**User Story:** Como responsável técnico, quero garantir que esta migração seja concluída antes de finalizar a validação de e-mail transacional e antes de qualquer liberação de produção, para evitar validações inválidas ou a exposição de usuários reais a uma infraestrutura ainda vinculada à Lovable_Cloud.

#### Acceptance Criteria

1. WHILE os Requirements 1 a 5 deste spec não estiverem com status "concluído" registrado no documento de tarefas correspondente, THE Requirement 4 do spec `email-transacional-dominio-proprio` (validação de entrega de e-mail) SHALL permanecer com status "bloqueado", impedindo o início de sua execução ou validação.
2. WHEN qualquer tarefa de liberação de produção descrita no spec `outlife-production-plan` for marcada como iniciada em seu documento de tarefas, THE responsável técnico SHALL confirmar que os Requirements 1 a 7 deste spec já estão com status "concluído" antes de dar continuidade a essa tarefa.
3. WHEN este spec estiver concluído, THE New_Supabase_Project SHALL ser o único projeto Supabase referenciado em todas as variáveis de ambiente e integrações do Vercel_Environment de produção, substituindo qualquer referência remanescente ao Lovable_Cloud ou a outros projetos Supabase.
4. IF uma tarefa de liberação de produção do spec `outlife-production-plan` for iniciada com um ou mais dos Requirements 1 a 7 deste spec ainda não concluídos, THEN THE responsável técnico SHALL interromper imediatamente essa tarefa de liberação de produção.
5. IF uma tarefa de liberação de produção for interrompida conforme o critério anterior, THEN THE responsável técnico SHALL manter a liberação de produção suspensa até que todos os Requirements 1 a 7 deste spec estejam com status "concluído".
