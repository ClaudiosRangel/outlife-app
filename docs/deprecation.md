# Depreciação — Legacy_Supabase_Project e Lovable_Platform_Copy

## Contexto

Como parte da migração descrita no spec `migracao-supabase-proprio-lovable`
(`.kiro/specs/migracao-supabase-proprio-lovable/`), o backend da OutLife_Application
foi migrado de um projeto Supabase originalmente provisionado pela plataforma
Lovable (lovable.dev, via "Lovable Cloud") para um projeto Supabase novo, criado
diretamente pelo Supabase Dashboard/CLI, sob propriedade exclusiva do usuário.

## Legacy_Supabase_Project

| Campo | Valor |
|---|---|
| Project_ID | `soghvqpnyekmkdqprpka` |
| Origem | Provisionado pela Lovable Cloud |
| Data da migração | 15/07/2026 |
| Status | `REFERENCE_ONLY` |
| Recursos afetados | Banco de dados (Postgres/PostGIS), Auth, Storage |

**Motivo da depreciação**: o Legacy_Supabase_Project continha uma Edge Function
própria da Lovable que interceptava o envio de e-mails de autenticação,
ignorando a configuração nativa de SMTP customizado do Supabase Auth — mesmo
com o domínio próprio corretamente configurado. Em vez de tentar remover
cirurgicamente essa interceptação (risco de outros provisionamentos
escondidos), foi criado um projeto novo do zero.

**Instrução de retenção**: o Legacy_Supabase_Project **não deve ser excluído
imediatamente**. Deve ser mantido apenas como referência histórica até que uma
revisão técnica documentada confirme que nenhum componente da OutLife_Application
depende dele.

## Lovable_Platform_Copy

| Campo | Valor |
|---|---|
| Origem | Cópia do projeto OutLife hospedada na plataforma Lovable, no local onde foi originalmente criado |
| Status | `REFERENCE_ONLY` |

**Confirmação**: nenhuma implantação (deploy) subsequente da OutLife_Application
tem a Lovable_Platform_Copy como origem. A implantação de produção atual é feita
via Vercel, a partir do OutLife_Repository (Git próprio do usuário).

## Fonte de verdade

O **OutLife_Repository** (repositório Git próprio do usuário) é registrado como
a única fonte de verdade do código-fonte da OutLife_Application, incluindo o
Migration_Set (`supabase/migrations/`) e a configuração do projeto Supabase
(`supabase/config.toml`).

## Confirmação de conclusão dos Requirements

Todos os Requirements 1-7 do spec `migracao-supabase-proprio-lovable` estão
concluídos:

- **Requirement 1** (provisionamento do New_Supabase_Project): concluído
- **Requirement 2** (aplicação do Migration_Set): concluído, validado e idempotente
- **Requirement 3** (reconexão da aplicação): concluído, validado em produção e local
- **Requirement 4** (SMTP customizado): concluído
- **Requirement 5** (validação de entrega de e-mail): concluído, com ressalva de
  reputação de domínio documentada em `docs/migration-log.md` (SPF/DKIM/DMARC
  100% aprovados; entrega em spam atribuída à baixa reputação inicial do
  domínio, não à causa raiz técnica da migração)
- **Requirement 6** (recriação de usuários de teste): concluído
- **Requirement 7** (depreciação formal): concluído neste documento

Esta confirmação serve como pré-condição para qualquer tarefa de liberação de
produção do spec `outlife-production-plan`, conforme Requirement 8 do spec
`migracao-supabase-proprio-lovable`.
