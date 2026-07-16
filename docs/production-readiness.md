# Production_Readiness_Gate — OutLife_Application

## Contexto

Este documento registra o **Production_Readiness_Gate**: o conjunto de
condições que devem estar satisfeitas antes de a OutLife_Application ser
considerada apta a receber usuários reais em volume, conforme definido no
spec `outlife-production-plan` (`.kiro/specs/outlife-production-plan/`,
Requirement 3).

O Production_Readiness_Gate é um mecanismo de **documentação e processo**,
não um mecanismo de código. Nenhuma verificação automatizada bloqueia o
deploy com base neste arquivo — ele existe para que o status de prontidão
para produção seja rastreável e auditável por qualquer pessoa que consulte
o OutLife_Repository.

## Status atual do Gate

**Status: 🔴 PENDENTE**

O Production_Readiness_Gate **não está satisfeito**. A etapa obrigatória do
upgrade de plano (ver abaixo) ainda não foi realizada, e as demais condições
listadas na checklist deste documento devem ser verificadas antes do
lançamento para usuários reais em volume.

Este status pendente **não bloqueia**:
- o desenvolvimento das demais fases do spec `outlife-production-plan`;
- a implantação em produção (Vercel_Production_Deployment) das
  funcionalidades que já estiverem prontas.

Ele apenas sinaliza que a aplicação **ainda não deve receber tráfego real em
volume** enquanto permanecer pendente.

## Etapa obrigatória: upgrade do Production_Supabase_Project para o plano Pro

| Campo | Valor |
|---|---|
| Projeto | Production_Supabase_Project (`dxmbftbhmjjqtpjymakj`) |
| Plano atual | Free |
| Plano exigido antes do lançamento | Pro |
| Custo mensal estimado | **US$ 25/mês** (conforme `design.md` / tabela de estimativa de custos em `requirements.md`) |
| Status | 🔴 Pendente — upgrade ainda não realizado |

O upgrade para o plano Pro é tratado como **etapa obrigatória e independente**
das demais condições da checklist abaixo: quando ele for concluído, essa
condição específica deve ser marcada como satisfeita imediatamente,
**independentemente do status das demais condições** (Requirement 3.3).

Enquanto o upgrade não for realizado, esta condição permanece pendente sem
bloquear o restante do trabalho (Requirement 3.2).

### Regra de processo — validade da marcação de "upgrade concluído"

> **Uma marcação de "upgrade concluído" nesta seção só é válida quando o
> upgrade do Production_Supabase_Project para o plano Pro tiver sido
> efetivamente realizado no Supabase Dashboard.**
>
> Se este documento for editado para marcar essa condição como concluída
> **antes** de o upgrade ter sido de fato realizado, essa marcação é
> **inválida** e o Production_Readiness_Gate deve ser tratado como
> permanecendo **pendente**, independentemente do texto escrito aqui
> (Requirement 3.4).
>
> **Evidência mínima exigida para marcar esta condição como concluída:**
> print de tela ou confirmação do Supabase Dashboard mostrando o projeto
> `dxmbftbhmjjqtpjymakj` no plano **Pro** ativo (não "Free", não "trial"),
> anexada ou referenciada neste documento (ex: caminho de arquivo, link, ou
> data/hora da verificação). Uma marcação manual do checkbox sem essa
> evidência **não conta como conclusão válida** desta etapa.
>
> Esta regra é de **processo** (disciplina de quem atualiza este
> documento), não uma verificação automatizada de código.

- [ ] Upgrade do Production_Supabase_Project para o plano Pro realizado
  - **Evidência exigida**: print/confirmação do Supabase Dashboard mostrando o plano Pro ativo para o projeto `dxmbftbhmjjqtpjymakj`, com data da verificação.
  - **Status**: 🔴 Pendente

## Checklist das demais condições para o lançamento (Requirements 4 a 9)

Cada item abaixo corresponde a um Requirement do spec
`outlife-production-plan`. Um item só deve ser marcado como concluído
(`- [x]`) quando a evidência exigida estiver disponível e verificável — a
mesma regra de processo da seção anterior se aplica a toda esta checklist:
**marcação sem evidência real não é válida.**

- [ ] **Requirement 4 — Dados reais do usuário substituindo Mocked_Data_Function**
  (`fetchUserTrails`, `fetchSavedDestinations`, `fetchFavoritePartners`, `fetchNextAdventure`)
  - **Evidência exigida**: as quatro funções implementadas consultando o Production_Supabase_Project (não mais arrays/objetos fixos), com os property tests correspondentes (Properties 4-7) passando; verificação manual em produção com um usuário de teste real mostrando dados refletindo sua própria atividade.

- [ ] **Requirement 5 — Sistema de Achievement_Rule e Achievement_Record reais**
  - **Evidência exigida**: tabela `achievement_records`, view `user_achievement_stats` e função `grant_pending_achievements` aplicadas no Production_Supabase_Project; `fetchUserAchievements` consultando dados reais; property tests (Properties 8-10) passando; confirmação de que nenhum Achievement_Record é criado para atividade de usuário não autenticado.

- [ ] **Requirement 6 — Integração real com a Google Places API**
  - **Evidência exigida**: Google_Places_Credential cadastrada como variável de ambiente server-side (Vercel + `.env` local), nunca exposta ao bundle do cliente; `fetchDestinationsFromGoogle`/`fetchPlacesPhotos` retornando dados reais via server function; comportamento de fallback para array vazio confirmado (credencial ausente ou falha de chamada), com property test de resiliência (Property 11) passando.

- [ ] **Requirement 7 — PWA instalável**
  - **Evidência exigida**: `manifest.json` publicado e referenciado no HTML, com nome, ícones em pelo menos dois tamanhos e cor de tema; service worker registrado; confirmação visual de que um navegador compatível (Chrome/Edge mobile) identifica a OutLife_Application como instalável.

- [ ] **Requirement 8 — SEO e remoção da dependência residual da Lovable**
  - **Evidência exigida**: `sitemap.xml` publicado e acessível publicamente listando as rotas públicas; meta tags `og:image`/`twitter:image` em `src/routes/__root.tsx` sem nenhuma ocorrência de `lovable.app` ou subdomínio associado; título e descrição específicos por rota pública, distintos dos genéricos.

- [ ] **Requirement 9 — Monitoramento de erros e analytics de uso em produção**
  - **Evidência exigida**: projeto criado no Sentry Dashboard com DSN configurado (client e server) na Vercel e no `.env` local; Sentry.init integrado e capturando erros reais; `<Analytics />` do Vercel Analytics montado; confirmação de que falha de inicialização de qualquer um dos dois serviços não impede o carregamento normal da aplicação (unit test correspondente passando).

## Observação sobre Requirements não incluídos nesta checklist

Os Requirements 1, 2, 10, 11 e 12 do spec `outlife-production-plan` (Seed_Script,
validação do fluxo funcional, E2E_Test_Suite, otimização de imagens e
Rate_Limiting_Policy) são cobertos por outras tasks de código e seus próprios
testes automatizados, e não fazem parte da checklist deste documento porque o
Requirement 3.5 exige explicitamente apenas os Requirements 4 a 9 aqui. Isso
não diminui sua importância para o lançamento — apenas reflete o escopo
definido pelo Acceptance Criteria correspondente.

## Como atualizar este documento

1. Realize a ação correspondente (upgrade de plano, implementação, verificação manual etc.).
2. Reúna a evidência exigida pelo item (print, link, resultado de teste, data da verificação).
3. Só então marque o checkbox correspondente como `- [x]` e registre a evidência (ou uma referência a ela) na própria linha ou em uma nota abaixo do item.
4. Nunca marque um item como concluído "adiantado", assumindo que a ação será feita depois — isso viola a regra de processo descrita acima e invalida a marcação.
