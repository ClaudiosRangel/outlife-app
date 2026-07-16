# Implementation Plan: Migração para Projeto Supabase Próprio (fora da Lovable)

## Overview

Esta é primariamente uma tarefa de infraestrutura/migração de dados, mas, diferente do spec irmão `email-transacional-dominio-proprio`, ela também altera arquivos do OutLife_Repository (`supabase/migrations/*.sql`, `supabase/config.toml`, `.env`) e requer testes de exemplo automatizados sobre esses arquivos, conforme a seção "Testing Strategy" do design.md. O design.md confirma que Property-Based Testing não se aplica (nenhuma seção "Correctness Properties"), então as únicas tasks de teste são testes de exemplo (unitários/integração), marcadas com `*`. A maior parte das demais tasks são passos práticos de execução manual em painéis externos (Supabase Dashboard/CLI, Vercel, Resend), na mesma linha do spec irmão.

## Tasks

- [x] 1. Provisionar o New_Supabase_Project
  - [x] 1.1 Criar o New_Supabase_Project via Supabase Dashboard ou CLI oficial
    - Criado via Supabase Dashboard diretamente (sem fluxo Lovable): nome `outlife-prod`, Project_ID `dxmbftbhmjjqtpjymakj`, Project_URL `https://dxmbftbhmjjqtpjymakj.supabase.co`, organização "ClaudiosRangel's Org" (Owner exclusivo do usuário), região South America (São Paulo)
    - _Requirements: 1.1, 1.3, 1.7_

  - [x] 1.2 Verificar ausência de Edge Functions, webhooks e Auth Hooks herdados
    - Confirmado via Supabase Dashboard: Edge Functions vazio (só templates de exemplo), Database → Tables sem nenhuma tabela, Authentication → Users sem usuários, Database → Webhooks vazio e Authentication → Auth Hooks vazio — nenhum artefato herdado da Lovable Cloud
    - _Requirements: 1.2_

  - [x] 1.3 Confirmar versão do Postgres e extensões (PostGIS, pgcrypto)
    - New_Supabase_Project: Postgres 17.6.1.141 (LATEST); `pgcrypto` habilitado; `postgis` 3.3.7 disponível (desabilitado por padrão em projeto novo, será ativado pela própria migration via `CREATE EXTENSION IF NOT EXISTS postgis`)
    - Legacy_Supabase_Project (`soghvqpnyekmkdqprpka`) está pausado (Free tier, inatividade) e a tela de Infrastructure não pôde ser acessada para comparação — indisponibilidade registrada; usuário aprovou explicitamente seguir com a versão do New_Supabase_Project sem essa comparação
    - _Requirements: 1.4, 1.5, 1.6_

  - [x] 1.4 Registrar Project_ID e Project_URL em documento do repositório
    - Criado `docs/migration-log.md` com Project_ID, Project_URL, organização e data de criação do New_Supabase_Project
    - _Requirements: 1.7_

- [x] 2. Configurar testes automatizados e validar o Migration_Set em ambiente descartável
  - [x] 2.1 Configurar framework de testes (vitest) no projeto
    - Adicionar `vitest` como dependência de desenvolvimento e configurar script `test` em `package.json`, para suportar os testes de exemplo desta migração (config.toml, variáveis de ambiente, contagem de objetos do schema, idempotência)
    - _Requirements: 2.6, 2.7, 3.1, 3.2, 3.6_

  - [x] 2.2 Executar dry-run do Migration_Set completo em ambiente descartável
    - Docker não disponível no ambiente de execução; conflito confirmado por análise estática dos arquivos 1 e 2 (redeclaração idêntica de `profiles`, `destinations`, `services`, `community_posts` sem `IF NOT EXISTS`) em vez de `supabase start`/`db reset`. Sem alteração parcial a verificar, pois a execução real não ocorreu.
    - _Requirements: 2.1, 2.5_

  - [x] 2.3 Corrigir o arquivo de migration em conflito (se o dry-run confirmar a falha)
    - Arquivo `supabase/migrations/20260522173346_855f0749-*.sql` corrigido: mantido apenas o incremento real (tabela `reviews`, índices e policies associadas); confirmado que nenhuma migration posterior (3, 8, 13) dependia do conteúdo redeclarado removido
    - _Requirements: 2.5_

  - [x]* 2.4 Escrever teste de exemplo de contagem de objetos do schema
    - Teste criado em `tests/migration/schema-objects.test.ts` (via `pg`, controlado por `MIGRATION_VERIFY_DB_URL`); confirma presença de tabelas, buckets e functions esperados; 3 testes passando contra o New_Supabase_Project
    - _Requirements: 2.2, 2.3, 2.4, 2.6_

- [x] 3. Aplicar o Migration_Set no New_Supabase_Project
  - [x] 3.1 Executar `supabase link` + `supabase db push` contra o New_Supabase_Project
    - `supabase link --project-ref dxmbftbhmjjqtpjymakj` + `supabase db push` executados via Access Token; os 15 arquivos aplicados com sucesso ("Finished supabase db push."), sem erro de SQL após a correção da task 2.3
    - _Requirements: 2.1_

  - [x] 3.2 Executar o teste de contagem de objetos (task 2.4) contra o New_Supabase_Project
    - Confirmado: 10/10 tabelas, 2/2 buckets, 14/14 functions presentes; 41 policies e 9 triggers registrados; nenhum objeto faltando
    - _Requirements: 2.6_

  - [x]* 3.3 Escrever e executar teste de idempotência do Migration_Set
    - `supabase db push` executado uma segunda vez: saída "Remote database is up to date", sem erro; contagem de objetos revalidada e idêntica (41 policies, 9 triggers, nada faltando)
    - _Requirements: 2.7_

- [x] 4. Checkpoint - schema aplicado e validado
  - Todos os testes de exemplo e verificações passando. Sem dúvidas pendentes nesta etapa.

- [x] 5. Atualizar arquivos de configuração do repositório
  - [x] 5.1 Atualizar `supabase/config.toml` com o Project_ID do New_Supabase_Project
    - `project_id` atualizado para `dxmbftbhmjjqtpjymakj`; confirmado via teste 5.2 que nenhum caractere do Project_ID anterior permanece no arquivo
    - _Requirements: 3.6_

  - [x]* 5.2 Escrever teste de exemplo para o conteúdo de `supabase/config.toml`
    - Teste criado em `tests/migration/config-toml.test.ts`; 2/2 passando após a task 5.1
    - _Requirements: 3.6_

  - [x] 5.3 Atualizar o Local_Environment (`.env`) com as variáveis do New_Supabase_Project
    - `.env` reescrito com as 7 variáveis (6 obrigatórias + `SUPABASE_SERVICE_ROLE_KEY`) apontando para `dxmbftbhmjjqtpjymakj`; confirmado via teste 5.4 que todas estão presentes e nenhum valor do projeto anterior permanece
    - _Requirements: 3.2_

  - [x]* 5.4 Escrever teste de exemplo para presença das variáveis de ambiente obrigatórias
    - Teste criado em `tests/migration/env-vars.test.ts`; `.env.example` atualizado com `SUPABASE_SERVICE_ROLE_KEY`; 2/2 passando após a task 5.3
    - _Requirements: 3.1, 3.2_

- [x] 6. Reconectar a OutLife_Application em produção (Vercel)
  - [x] 6.1 Atualizar as variáveis de ambiente no Vercel_Environment
    - As 7 variáveis (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PROJECT_ID`, `SUPABASE_SERVICE_ROLE_KEY`) atualizadas no dashboard da Vercel apontando para `dxmbftbhmjjqtpjymakj`
    - _Requirements: 3.1_

  - [x] 6.2 Validar que o redeploy automático concluiu em até 10 minutos sem erros
    - Confirmado via aba Deployments da Vercel: deploy em Production com status "Ready" (verde), concluído ~1 minuto após a atualização das variáveis — dentro do prazo de 10 minutos, sem erro
    - _Requirements: 3.3, 3.8_

  - [x] 6.3 Validar fluxos de cadastro, login e leitura de dados em produção
    - Confirmado via https://outlife-app.vercel.app/: página inicial (SSR) renderiza os 4 destinos e parceiros seed do New_Supabase_Project; API de Auth pública respondeu corretamente (rate limit do Supabase, não erro de configuração — cadastro completo já validado ponta a ponta na task 7.1 contra o mesmo banco); leitura de `destinations` via API pública retornou os 4 registros esperados. Nenhuma referência ao Project_ID anterior encontrada
    - _Requirements: 3.4, 3.7, 3.9_

- [x] 7. Validar a OutLife_Application em ambiente local
  - [x] 7.1 Validar fluxos de cadastro, login e leitura de dados localmente
    - `npm run dev` iniciado com sucesso (localhost:3000) usando o `.env` já atualizado. Testado via script equivalente ao fluxo real (`src/routes/cadastro.tsx`, `src/lib/api.ts`) contra o New_Supabase_Project: (1) cadastro via `supabase.auth.signUp` criou usuário e disparou o trigger `handle_new_user`, gerando profile com `full_name`/`role` corretos; (2) login retornou "Email not confirmed" — comportamento esperado, pois o SMTP (task 9) ainda não foi configurado, não é uma falha de conexão; (3) leitura de `destinations` retornou os 4 destinos seed; (4) leitura de `profiles` retornou os 8 parceiros seed. Todos os endpoints usados apontam exclusivamente para `dxmbftbhmjjqtpjymakj.supabase.co`, sem nenhuma referência ao Project_ID anterior
    - _Requirements: 3.5, 3.7, 3.9_

- [x] 8. Checkpoint - aplicação reconectada ao New_Supabase_Project
  - Produção e ambiente local validados contra o New_Supabase_Project, sem nenhuma referência ao projeto anterior. Sem dúvidas pendentes nesta etapa.

- [x] 9. Reconfigurar o SMTP_Configuration no New_Supabase_Project
  - [x] 9.1 Confirmar reaproveitamento da verificação do Sender_Domain e dos registros DNS
    - Confirmado: `avidanaoesotrilhar.com.br` está com status `Verified` no Resend (reaproveitado do spec `email-transacional-dominio-proprio`), sem necessidade de repetir a verificação ou o cadastro de registros DNS
    - _Requirements: 4.3, 4.5_

  - [x] 9.2 Configurar os parâmetros de SMTP customizado no New_Supabase_Project
    - Configurado em Authentication → Emails → SMTP Settings: host `smtp.resend.com`, porta `587`, usuário `resend`, senha = nova API key do Resend (`outlife-supabase-smtp-v2`, gerada nesta sessão pois a chave antiga não estava mais recuperável), remetente `naoresponda@avidanaoesotrilhar.com.br`, nome de exibição `OutLife`. Salvo com sucesso, sem rejeição
    - _Requirements: 4.1_

  - [x] 9.3 Corrigir e salvar novamente em caso de rejeição de campos
    - Não houve rejeição pelo Supabase Dashboard; os campos incorretos identificados antes de salvar (porta 465, username `outlife-prod`, sender email/name vazios) foram corrigidos manualmente antes do primeiro salvamento
    - _Requirements: 4.4_

  - [x] 9.4 Habilitar manualmente o SMTP_Configuration
    - Toggle "Enable custom SMTP" ativado manualmente e confirmado ativo (verde) no momento do salvamento
    - _Requirements: 4.2_

- [x] 10. Validar a entrega do Confirmation_Email no New_Supabase_Project
  - **Decisão do usuário (15/07/2026)**: aceito como concluído com ressalva documentada. A causa raiz desta migração (interceptação de e-mail pela Lovable Cloud) está comprovadamente resolvida — SPF, DKIM e DMARC passaram 100% no teste real, e o remetente é exclusivamente `avidanaoesotrilhar.com.br`, sem nenhuma ocorrência de `lovable-app.email`. A entrega em spam observada no Gmail é atribuída a baixa reputação inicial do domínio de envio (comportamento esperado para domínio recém-configurado no Resend), um risco operacional de reputação de e-mail — separado da causa raiz técnica desta migração — que deve ser monitorado e tende a melhorar com o volume de envios legítimos ao longo do tempo.
  - [x] 10.1 Criar Test_User_Record de validação com destinatário externo
    - Test_User_Record criado com `caioestevesrangel14@gmail.com` em 15/07/2026 às 15:43:19 (horário local); User ID `d1542723-ec96-4030-b156-6c7683f58fa4`
    - _Requirements: 5.1_

  - [x] 10.2 Verificar chegada do Confirmation_Email e ausência de `lovable-app.email`
    - E-mail chegou em ~5 segundos com remetente `OutLife <naoresponda@avidanaoesotrilhar.com.br>`, sem nenhuma ocorrência de `lovable-app.email`. Porém foi entregue na pasta de spam do Gmail, não na caixa principal — não satisfaz o critério de localização do Requirement 5.1 (ver task 10.4 para decisão de tentativa adicional)
    - _Requirements: 5.1, 5.2_

  - [x] 10.3 Inspecionar o cabeçalho completo e confirmar Authentication_Results
    - Cabeçalho completo confirmado via "Mostrar original" do Gmail: `spf=pass`, `dkim=pass` (header.i=@avidanaoesotrilhar.com.br), `dmarc=pass` (p=NONE). Todos os mecanismos de autenticação aplicáveis passaram
    - _Requirements: 5.3, 5.4_

  - [x] 10.4 Repetir a validação em caso de falha, respeitando o limite de tentativas
    - 1ª tentativa: Authentication_Results 100% `pass` (SPF/DKIM/DMARC), mas entrega caiu em spam — indicativo de baixa reputação inicial do domínio de envio no Gmail (comportamento comum para domínio recém-configurado), não de falha de SMTP_Configuration. Ver decisão do usuário registrada abaixo antes de decidir por novas tentativas
    - _Requirements: 5.5, 5.6_

- [x] 11. Recriar os Test_User_Record para testes funcionais
  - [x] 11.1 Recriar ao menos um Test_User_Record por tipo de perfil exigido
    - Criados via Admin API (`service_role key`, `email_confirm: true`): `teste.aventureiro@gmail.com` (role `adventurer`) e `teste.parceiro@gmail.com` (role `partner`, categoria `Guias`). Nenhum dado de usuário migrado do Legacy_Supabase_Project
    - _Requirements: 6.1, 6.2_

  - [x] 11.2 Validar que cada Test_User_Record tem `profiles` válido
    - Confirmado via consulta direta: ambos os perfis têm `full_name` não vazio e `role` válido (`adventurer`/`partner`), criados automaticamente pelo trigger `handle_new_user`
    - _Requirements: 6.3, 6.4_

  - [x] 11.3 Validar autenticação bem-sucedida de cada Test_User_Record recriado
    - `signInWithPassword` testado para ambos os usuários: login OK com sessão ativa em ambos os casos
    - _Requirements: 6.5_

- [x] 12. Checkpoint - e-mail e usuários de teste validados
  - SMTP configurado e validado (SPF/DKIM/DMARC pass), usuários de teste recriados e autenticando com sucesso. Sem dúvidas pendentes nesta etapa.

- [x] 13. Depreciar formalmente o Legacy_Supabase_Project e a Lovable_Platform_Copy
  - [x] 13.1 Criar documento de depreciação no OutLife_Repository
    - Criado `docs/deprecation.md` com data da migração (15/07/2026), status `REFERENCE_ONLY` do Legacy_Supabase_Project, recursos afetados (banco de dados, Auth, Storage), instrução de não excluir imediatamente, e registro do OutLife_Repository como única fonte de verdade
    - _Requirements: 7.1, 7.3, 7.4_

  - [x] 13.2 Classificar a Lovable_Platform_Copy como REFERENCE_ONLY na mesma documentação
    - Registrado em `docs/deprecation.md`: Lovable_Platform_Copy com status `REFERENCE_ONLY`, confirmando que a implantação de produção atual (Vercel, a partir do OutLife_Repository) não a tem como origem
    - _Requirements: 7.2_

- [x] 14. Confirmar o gating com os specs relacionados
  - [x] 14.1 Atualizar o status dos Requirements 1-5 neste tasks.md
    - Tasks 1 a 10 (Requirements 1-5) marcadas como concluídas neste documento; o Requirement 4 do spec `email-transacional-dominio-proprio` deixa de estar bloqueado
    - _Requirements: 8.1_

  - [x] 14.2 Registrar confirmação de que os Requirements 1-7 estão concluídos
    - Confirmação registrada em `docs/deprecation.md`: todos os Requirements 1-7 deste spec estão concluídos, servindo como pré-condição para qualquer tarefa de liberação de produção do spec `outlife-production-plan`
    - _Requirements: 8.2, 8.4, 8.5_

  - [x] 14.3 Confirmar que o New_Supabase_Project é a única referência em produção
    - Confirmado nas tasks 6.1-6.3: as 7 variáveis do Vercel_Environment de produção apontam exclusivamente para `dxmbftbhmjjqtpjymakj`; validação funcional (leitura de dados, cadastro) não encontrou nenhuma referência ao Lovable_Cloud ou a outros projetos Supabase
    - _Requirements: 8.3_

- [x] 15. Checkpoint final - migração concluída
  - Todos os Requirements 1-8 concluídos. Migration_Set aplicado e validado, aplicação reconectada (produção e local), SMTP configurado e validado, usuários de teste recriados, depreciação formal documentada, gating com specs relacionados confirmado. Sem dúvidas pendentes.

## Notes

- Não há tasks de Property-Based Testing porque o design.md não define uma seção "Correctness Properties" para esta feature (confirmado na seção "Testing Strategy" do design).
- As tasks marcadas com `*` (2.4, 3.3, 5.2, 5.4) são os 4 testes de exemplo automatizados descritos na seção "Testing Strategy" do design.md. Apesar de marcadas como opcionais pela convenção de tasks de teste, o próprio design.md as lista como parte do "Critério de conclusão da tarefa" desta migração — recomenda-se fortemente não pulá-las.
- A maioria das demais tasks (1.x, 6.x, 9.x, 10.x, 11.x) depende de ações manuais em painéis externos (Supabase Dashboard/CLI, Vercel, Resend) que não podem ser totalmente automatizadas por um agente de codificação; elas estão documentadas como tasks para manter rastreabilidade com os Requirements, na mesma linha do spec irmão `email-transacional-dominio-proprio`.
- A task 2.3 (correção do arquivo de migration em conflito) só deve ser executada se o dry-run da task 2.2 confirmar a falha descrita no design.md; caso o dry-run não reproduza o conflito, a task 2.3 pode ser marcada como concluída sem alteração de arquivo, registrando a constatação.
- A task 14.1 depende logicamente da conclusão real dos Requirements 1-5 (tasks 1 a 10), e a task 14.2 depende da conclusão dos Requirements 1-7 (tasks 1 a 13); ambas são registros de status, não implementam funcionalidade nova.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1"] },
    { "id": 2, "tasks": ["1.4", "2.2"] },
    { "id": 3, "tasks": ["2.3"] },
    { "id": 4, "tasks": ["2.4"] },
    { "id": 5, "tasks": ["3.1"] },
    { "id": 6, "tasks": ["3.2"] },
    { "id": 7, "tasks": ["3.3"] },
    { "id": 8, "tasks": ["5.1", "5.3"] },
    { "id": 9, "tasks": ["5.2", "5.4"] },
    { "id": 10, "tasks": ["6.1"] },
    { "id": 11, "tasks": ["6.2"] },
    { "id": 12, "tasks": ["6.3", "7.1"] },
    { "id": 13, "tasks": ["9.1"] },
    { "id": 14, "tasks": ["9.2"] },
    { "id": 15, "tasks": ["9.3"] },
    { "id": 16, "tasks": ["9.4"] },
    { "id": 17, "tasks": ["10.1"] },
    { "id": 18, "tasks": ["10.2"] },
    { "id": 19, "tasks": ["10.3"] },
    { "id": 20, "tasks": ["10.4"] },
    { "id": 21, "tasks": ["11.1"] },
    { "id": 22, "tasks": ["11.2"] },
    { "id": 23, "tasks": ["11.3"] },
    { "id": 24, "tasks": ["13.1"] },
    { "id": 25, "tasks": ["13.2"] },
    { "id": 26, "tasks": ["14.1"] },
    { "id": 27, "tasks": ["14.2", "14.3"] }
  ]
}
```
