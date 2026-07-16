# Log de Migração — Projeto Supabase Próprio

Registro da migração descrita no spec `migracao-supabase-proprio-lovable`
(saída da infraestrutura provisionada pela Lovable Cloud).

## New_Supabase_Project

| Campo | Valor |
|---|---|
| Nome do projeto | `outlife-prod` |
| Project_ID | `dxmbftbhmjjqtpjymakj` |
| Project_URL | `https://dxmbftbhmjjqtpjymakj.supabase.co` |
| Organização | ClaudiosRangel's Org (Owner exclusivo do usuário, sem vínculo com Lovable Cloud) |
| Região | South America (São Paulo) |
| Plano | Free (avaliar upgrade para Pro antes de produção real, conforme `outlife-production-plan`) |
| Data de criação | 26/07/2026 (registrado nesta sessão) |

## Legacy_Supabase_Project (referência, para comparação)

| Campo | Valor |
|---|---|
| Project_ID | `soghvqpnyekmkdqprpka` |
| Origem | Provisionado via Lovable Cloud |
| Status pós-migração | `REFERENCE_ONLY` (a ser formalizado na task 13.1) |

## Próximos passos

- [ ] Confirmar ausência de Edge Functions, Webhooks e Auth Hooks herdados (task 1.2)
- [ ] Confirmar versão do Postgres e extensões PostGIS/pgcrypto (task 1.3)
- [ ] Aplicar o Migration_Set via `supabase link` + `supabase db push` (task 3.1)

## Verificação do New_Supabase_Project (task 1.2 / 1.3)

- Edge Functions, Database → Webhooks e Authentication → Auth Hooks: vazios (nenhum artefato herdado da Lovable Cloud)
- Postgres version: `17.6.1.141` (LATEST)
- Extensão `pgcrypto`: habilitada
- Extensão `postgis` (3.3.7): disponível, desabilitada por padrão (será ativada pela migration 1 via `CREATE EXTENSION IF NOT EXISTS postgis`)

## Divergência registrada (Requirement 1.6)

O Legacy_Supabase_Project (`soghvqpnyekmkdqprpka`) está pausado por inatividade
(plano Free) e não foi possível acessar Settings → Infrastructure para
comparar a versão do Postgres com o New_Supabase_Project. O usuário aprovou
explicitamente (26/07/2026) seguir com a versão atual do New_Supabase_Project
(Postgres 17.6.1) sem essa comparação.

## Migration_Set aplicado (task 3.1 / 3.2 / 3.3)

- `supabase link` + `supabase db push` executados com sucesso contra o New_Supabase_Project (26/07/2026)
- Os 15 arquivos do Migration_Set aplicados em ordem cronológica, sem erro de SQL (correção da task 2.3 confirmada em produção real)
- Verificação de objetos: 10/10 tabelas, 2/2 buckets, 14/14 functions presentes; 41 RLS policies, 9 triggers
- Idempotência confirmada: segunda execução de `supabase db push` retornou "Remote database is up to date", com contagem de objetos idêntica

## Reconexão da aplicação (task 5.1 / 5.3)

- `supabase/config.toml`: `project_id` atualizado para `dxmbftbhmjjqtpjymakj`
- `.env` local: reescrito com as 7 variáveis apontando para o New_Supabase_Project (URL, publishable key, project ID, service role key)
- Testes de exemplo (`tests/migration/*.test.ts`): 7/7 passando

## Validação local (task 7.1)

- `npm run dev` iniciado com sucesso usando o `.env` atualizado (localhost:3000)
- Cadastro (`signUp`) testado contra o New_Supabase_Project: usuário criado, trigger `handle_new_user` gerou profile com `full_name` e `role` corretos
- Login retornou "Email not confirmed" — esperado, pois o SMTP customizado (task 9) ainda não foi configurado; não é falha de conexão com o banco
- Leitura de `destinations` (4 registros seed) e `profiles` (8 parceiros seed) confirmada sem erro
- Nenhum endpoint referenciou o Project_ID anterior (`soghvqpnyekmkdqprpka`)

## Reconexão em produção (task 6)

- Variáveis de ambiente atualizadas no Vercel_Environment (dashboard da Vercel)
- Redeploy automático concluído em ~1 minuto, status "Ready" (Production)
- Validado via https://outlife-app.vercel.app/: página inicial (SSR) renderiza destinos e parceiros seed do New_Supabase_Project; API de Auth pública respondendo; leitura de `destinations` confirmada
- Nenhuma referência ao Project_ID anterior (`soghvqpnyekmkdqprpka`) encontrada em produção

## SMTP_Configuration reaplicado (task 9)

- Sender_Domain (`avidanaoesotrilhar.com.br`) confirmado `Verified` no Resend, reaproveitado sem repetir verificação DNS
- Nova API key do Resend gerada (`outlife-supabase-smtp-v2`), pois a chave antiga não estava mais recuperável
- SMTP customizado configurado e salvo com sucesso no New_Supabase_Project: host `smtp.resend.com`, porta `587`, usuário `resend`, remetente `naoresponda@avidanaoesotrilhar.com.br`, nome `OutLife`
- Toggle "Enable custom SMTP" habilitado manualmente

## SMTP e validação de e-mail (task 9-10)

- SMTP customizado configurado no New_Supabase_Project: host `smtp.resend.com`, porta `587`, usuário `resend`, remetente `naoresponda@avidanaoesotrilhar.com.br`, nome `OutLife`
- Nova API key do Resend gerada (`outlife-supabase-smtp-v2`), pois a antiga não estava recuperável
- Test_User_Record de validação (`caioestevesrangel14@gmail.com`) criado em 15/07/2026 15:43:19; Confirmation_Email chegou em ~5s
- Authentication_Results: `spf=pass`, `dkim=pass`, `dmarc=pass` — 100% aprovado
- E-mail caiu na pasta de spam do Gmail (não na caixa principal) — atribuído à baixa reputação inicial do domínio recém-configurado no Resend, não a falha de SMTP_Configuration ou à causa raiz da migração (interceptação Lovable). Decisão do usuário: aceitar como risco de reputação a ser monitorado, migração considerada bem-sucedida tecnicamente

## Usuários de teste recriados (task 11)

- `teste.aventureiro@gmail.com` (role `adventurer`) — criado via Admin API, e-mail pré-confirmado
- `teste.parceiro@gmail.com` (role `partner`, categoria `Guias`) — criado via Admin API, e-mail pré-confirmado
- Ambos com profile válido (nome + role) e login funcional confirmado
