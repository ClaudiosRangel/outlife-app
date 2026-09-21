# Design Document

Design — Conta, Privacidade e Termos de Uso

## Overview

Três entregáveis independentes que compõem a conformidade pré-lançamento:

1. **Documentos legais** (Termos de Uso + Política de Privacidade), PT e EN,
   versionados, servidos em rotas públicas (`/termos`, `/privacidade`).
2. **Aceite obrigatório** da versão vigente, registrado por usuário, com gate
   bloqueante no app até o aceite.
3. **Exclusão de conta** in-app, via RPC segura que remove/anonimiza os dados
   conforme a política de retenção.

Implementação em frentes pequenas, cada uma com build+commit. Migrations
idempotentes aplicadas em produção (2×) e refletidas no consolidado.

## Architecture

Três frentes independentes (A: documentos+rotas públicas; B: aceite; C:
exclusão). Frontend React/TanStack Router; backend Supabase (Postgres + RLS +
RPCs SECURITY DEFINER). O gate de aceite é um componente montado no `__root`
que lê o estado do `profiles`. A exclusão é uma RPC transacional. Detalhe de
cada frente abaixo.

## Frente A — Documentos legais + rotas públicas

### Conteúdo (fonte única)
Os textos ficam em constantes TS versionadas em `src/lib/legal-content.ts`:

```ts
export const TERMS_VERSION = "2026-09-15"; // data de vigência = versão
export const PRIVACY_VERSION = "2026-09-15";
export const LEGAL_DOC_VERSION = "2026-09-15"; // versão do "pacote" p/ aceite
```

Estrutura do conteúdo (array de seções `{ heading, body }`) por idioma, para
renderizar tanto no app quanto ser reaproveitado. Cobertura conforme
Requisito 1 (marketplace, UGC, localização, LGPD, retenção). Cabeçalho de cada
documento deixa explícito: "minuta sujeita a validação jurídica".

### Rotas
- `/termos` e `/privacidade`: rotas **públicas** (fora do gate de auth),
  renderizam o conteúdo do idioma ativo, com seletor de versão/data no topo.
  Servem de URL pública para as fichas das lojas (Requisito 6).
- Reaproveitam layout simples (scroll + headings), sem dependência de login.

## Frente B — Aceite obrigatório

### Dados (migration `20260915100000_legal-acceptance.sql`)
Tabela nova `legal_acceptances` (histórico auditável — nunca sobrescreve):

```sql
create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  doc_version text not null,
  accepted_at timestamptz not null default now(),
  app_platform text,          -- 'web' | 'native'
  user_agent text
);
create index if not exists idx_legal_acceptances_user on public.legal_acceptances(user_id);
```
RLS: o dono lê (`user_id = auth.uid()`) e insere o próprio aceite. Sem update/
delete pelo usuário (auditabilidade).

Coluna denormalizada em `profiles` para gate rápido sem join:
```sql
alter table public.profiles add column if not exists accepted_legal_version text;
```
Atualizada no mesmo passo do insert (via RPC ou update do cliente).

### RPC de aceite
`accept_legal_terms(_doc_version text, _platform text, _user_agent text)`
(SECURITY DEFINER): insere em `legal_acceptances` e seta
`profiles.accepted_legal_version = _doc_version` para `auth.uid()`. Idempotente
por versão (novo insert por versão nova é aceitável — histórico).

### Gate no app
- `fetchMyLegalStatus()` já vem do `profiles.accepted_legal_version` (o
  `fetchMyProfile` pode ser estendido para trazer o campo).
- Componente `<LegalGate>` montado no `__root.tsx` (dentro do provider de
  auth): se `user` existe E `accepted_legal_version !== LEGAL_DOC_VERSION`,
  renderiza modal bloqueante com resumo + links `/termos` e `/privacidade` +
  botões "Aceitar" e "Sair". Enquanto não aceito, o conteúdo do app fica
  atrás do modal. Rotas públicas (`/termos`, `/privacidade`, `/login`,
  `/cadastro`) não disparam o gate.
- Aceitar → chama `acceptLegalTerms()` → invalida `["my-profile"]` → modal some.
- Recusar/Sair → `supabase.auth.signOut()`.

## Frente C — Exclusão de conta

### Ordem de remoção (baseada no schema real)
A maioria das tabelas de usuário tem FK → `profiles.id ON DELETE CASCADE`
(achievement_records, comment_likes, community_posts, direct_messages,
event_participants, event_questions[author], events, favorite_partners,
native_push_tokens, notifications, partner_leads, post_comments, post_likes,
profile_contacts, reviews, saved_destinations, services, user_destination_visits,
user_feedback, web_push_subscriptions, cadastur_verification_requests[partner]).
→ **deletar `profiles` dispara esses cascades**.

Casos que NÃO têm cascade e precisam de tratamento explícito ANTES:
- `destinations.created_by`, `admin_suggestions.created_by/done_by`,
  `app_content.updated_by`, `cadastur.reviewed_by`, `event_questions.answered_by`
  → **SET NULL** (curadoria/histórico preservado, anonimizado). A maioria já é
  SET NULL automático; `event_questions.answered_by` é NO ACTION → setar NULL
  manual.
- Tabelas por `user_id` SEM FK para profiles: `user_activities`,
  `user_checklists`, `user_achievement_stats`, `user_level_stats`,
  `user_roles`, `rpc_rate_limit_log` → **deletar manualmente** por `user_id`.
- `profiles.id` **não** tem FK para `auth.users` → deletar profile não remove
  o login. É preciso deletar de `auth.users` explicitamente.

### RPC `delete_my_account()` (SECURITY DEFINER)
Executa como dono (`auth.uid()`), numa transação:
1. `update event_questions set answered_by=null where answered_by=uid`.
2. `delete from user_activities/user_checklists/user_achievement_stats/
   user_level_stats/user_roles/rpc_rate_limit_log where user_id=uid`.
3. `delete from public.profiles where id=uid` → dispara todos os cascades.
4. `delete from auth.users where id=uid` (a função tem privilégio; roda no BD).

Retorna `void`/`boolean`. `revoke ... from anon/authenticated` + `grant execute`
só a `authenticated`. A função checa `auth.uid() is not null`.

> Alternativa considerada: excluir só via Admin API (service role) no cliente.
> Rejeitada por exigir expor lógica de limpeza no cliente e mais round-trips;
> a RPC transacional é mais segura e atômica. O `auth.users` delete dentro da
> função SECURITY DEFINER (owner = postgres) tem privilégio suficiente.

### UI
Em `configuracoes.tsx`, seção "Zona de perigo": botão "Excluir minha conta" →
modal de confirmação exigindo digitar `EXCLUIR` (e aviso de irreversibilidade e
retenção). Confirma → `deleteMyAccount()` → `supabase.auth.signOut()` →
`navigate('/login')` + toast.

### Retenção (documentada na Política)
- Identificação (nome, e-mail, avatar, contatos, endereço): removidos na
  exclusão; expurgo completo de backups em até 30 dias.
- Conteúdo de curadoria compartilhada (destinos aprovados, respostas de FAQ de
  evento): **anonimizado** (autor → null), preservado por integridade.
- Obrigações legais (se houver transação financeira futura): retenção mínima
  legal, segregada — quando o módulo de pagamentos existir (loja virtual).

## Components and Interfaces

- `<LegalGate>` (React): modal bloqueante montado no `__root.tsx`.
- Rotas públicas `/termos` e `/privacidade` (componentes de leitura).
- Seção "Zona de perigo" em `configuracoes.tsx` (modal de exclusão).
- `src/lib/legal-gate.ts`: `shouldShowLegalGate(...)` (função pura).
- `src/lib/legal-content.ts`: conteúdo + versões.

## Data Models

- Tabela `legal_acceptances` (histórico de aceites — ver Frente B).
- Coluna `profiles.accepted_legal_version` (gate rápido).
- RPCs: `accept_legal_terms(...)`, `delete_my_account()`.

## Error Handling

- RPC de aceite/exclusão: erros propagados como `Error` para toast no cliente.
- Exclusão: transação — se qualquer passo falhar, rollback e nada é removido.
- Gate: se `fetchMyProfile` falhar, não bloquear indevidamente (fail-open só
  para leitura; o aceite em si exige sucesso da RPC).

## Correctness Properties

- **Property 1 (gate condicional):** o gate só aparece para usuário
  autenticado, com versão aceita diferente da vigente e fora de rota pública.
- **Property 2 (exclusão atômica):** ou remove tudo do titular (cascade +
  limpezas) e o login, ou nada (rollback em falha).
- **Property 3 (anonimização irreversível):** conteúdo de curadoria preservado
  tem autor → null, sem permitir reidentificar o titular.
- **Property 4 (aceite aditivo):** o histórico de aceite nunca é sobrescrito;
  só o dono lê/insere o seu registro.

## Testing Strategy

- Unit/fast-check em `legal-content.test.ts` e `legal-gate.test.ts`.
- Verificação manual do fluxo de exclusão em conta de teste (não em conta real).

## API (`src/lib/api.ts`)
- `fetchMyLegalStatus()` — retorna `{ acceptedVersion }` (ou incluir campo no
  `fetchMyProfile`).
- `acceptLegalTerms()` — RPC `accept_legal_terms`.
- `deleteMyAccount()` — RPC `delete_my_account`.

## i18n
Bloco `legal.*` (título, resumo do gate, botões aceitar/sair, headings) e
`settings.deleteAccount.*` (botão, modal, confirmação). PT + EN. Os textos
LONGOS dos documentos ficam em `legal-content.ts` (não no translation.json,
por tamanho), com PT e EN.

## Testes
- `legal-content.test.ts` (fast-check/unit): versões são strings ISO válidas;
  toda seção tem heading e body não-vazios; PT e EN têm o mesmo número de
  seções (paridade).
- Lógica pura de gate `shouldShowLegalGate(user, acceptedVersion, currentVersion, pathname)`
  em `src/lib/legal-gate.ts` com testes (não mostra em rota pública; mostra
  quando versão diverge; não mostra deslogado).

## Verificação
- `tsc` limpo (só os 6 erros de use-local-push). Colunas novas → `as never`.
- Migration idempotente testada 2× em produção + `NOTIFY pgrst`.
- Build APK ao final.
