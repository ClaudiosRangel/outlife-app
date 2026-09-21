# Implementation Plan: Conta, Privacidade e Termos de Uso

## Overview

Três frentes (A documentos+rotas públicas, B aceite obrigatório, C exclusão de
conta) + fechamento. Cada frente é build+commit. Migrations idempotentes
aplicadas em produção 2×.

## Task Dependency Graph

- Tarefa 1 (documentos/rotas) — independente.
- Tarefa 2 (aceite) — depende de 1.1 (versões/LEGAL_DOC_VERSION).
- Tarefa 3 (exclusão) — independente das demais.
- Tarefa 4 (verificação/APK) — depende de 1, 2 e 3.

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "3"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["4"] }
  ]
}
```

## Tasks

- [x] 1. Conteúdo legal + rotas públicas (Frente A)
  - [x] 1.1 Criar `src/lib/legal-content.ts` com `TERMS_VERSION`,
    `PRIVACY_VERSION`, `LEGAL_DOC_VERSION` e o conteúdo (seções PT + EN) dos
    Termos de Uso e da Política de Privacidade, cobrindo marketplace, UGC,
    localização, LGPD, retenção e isenções (Requisitos 1.1, 1.2, 1.3, 1.4).
  - [x] 1.2 Criar rotas públicas `/termos` e `/privacidade` (fora do gate),
    renderizando o conteúdo do idioma ativo (Requisitos 5.5, 6.1). Registrar
    no `routeTree.gen.ts`.
  - [x] 1.3 Teste `legal-content.test.ts`: versões ISO válidas, paridade de
    seções PT/EN, headings/bodies não-vazios (Requisito 1.4).

- [ ] 2. Aceite obrigatório (Frente B)
  - [ ] 2.1 Migration `20260915100000_legal-acceptance.sql`: tabela
    `legal_acceptances` (+RLS dono), coluna `profiles.accepted_legal_version`,
    RPC `accept_legal_terms`. Aplicar em produção 2× + `NOTIFY pgrst`. Refletir
    no consolidado (Requisitos 2.2, 2.4).
  - [ ] 2.2 API `acceptLegalTerms()` + expor `accepted_legal_version` no
    `fetchMyProfile` (Requisito 2.2).
  - [ ] 2.3 `src/lib/legal-gate.ts` com `shouldShowLegalGate(...)` puro +
    testes (rota pública não mostra; versão divergente mostra; deslogado não
    mostra) (Requisitos 2.1, 2.4).
  - [ ] 2.4 Componente `<LegalGate>` (modal bloqueante) montado no `__root.tsx`:
    resumo + links `/termos` e `/privacidade` + Aceitar/Sair (Requisitos 2.1,
    2.3, 2.5).
  - [ ] 2.5 i18n bloco `legal.*` (PT + EN).

- [ ] 3. Exclusão de conta (Frente C)
  - [ ] 3.1 Migration `20260915110000_delete-account.sql`: RPC
    `delete_my_account()` SECURITY DEFINER (SET NULL em answered_by; delete das
    tabelas por user_id sem cascade; delete profiles → cascade; delete
    auth.users). Grants só a `authenticated`. Aplicar 2× + `NOTIFY pgrst` +
    consolidado (Requisitos 3.3, 3.4, 3.5, 4.1, 4.2, 4.3).
  - [ ] 3.2 API `deleteMyAccount()` (Requisito 3.3).
  - [ ] 3.3 UI em `configuracoes.tsx`: seção "Zona de perigo" + modal de
    confirmação (digitar EXCLUIR) → deleteMyAccount → signOut → /login
    (Requisitos 3.1, 3.2, 3.3, 3.5).
  - [ ] 3.4 i18n `settings.deleteAccount.*` (PT + EN).

- [ ] 4. Verificação e fechamento
  - [ ] 4.1 `tsc` limpo (só 6 erros de use-local-push); rodar testes novos.
  - [ ] 4.2 Build APK (build:native → cap sync → assembleDebug) e confirmar.
  - [ ] 4.3 Commit+push na main; atualizar ROADMAP + PUBLICACAO-LOJAS (marcar
    itens de termos/exclusão/URLs como atendidos).

## Notes

- Portabilidade/exportação (Requisito 5) fica como fase 2 (desejável), não
  bloqueia o lançamento — anotar no roadmap se não for feito agora.
- Textos jurídicos são minuta sujeita a validação por advogado.
