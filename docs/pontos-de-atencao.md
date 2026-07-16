# Pontos de atenção — spec `outlife-production-plan`

Este documento registra problemas reais encontrados durante a execução do
spec `outlife-production-plan`, que precisam de atenção antes ou depois do
próximo deploy em produção (https://outlife-app.vercel.app/).

## 1. Bug pré-existente: `npm run dev` quebra a hidratação do client (não afeta produção)

**Severidade**: Média (só afeta desenvolvimento local, não o build de produção).

**Causa**: `src/lib/i18n.ts` importa os arquivos JSON de tradução direto de
`public/locales/*/translation.json` como módulo JavaScript. O Vite rejeita
esse tipo de import em modo dev (`npm run dev` / `vite dev`) com o erro
"Assets in public directory cannot be imported from JavaScript", o que
quebra a hidratação do React no client por completo — nenhum clique ou
interação funciona na página.

**Confirmado que NÃO afeta produção**: no build real (`npm run build`), o
Rollup resolve esse import normalmente durante o bundling, e o app funciona
sem problema. Isso foi confirmado rodando a suíte E2E (Playwright) contra
`npm run build` + `npx vite preview` com sucesso (testes de login e
submissão de avaliação passaram).

**Impacto prático**: bloqueia rodar a suíte E2E completa localmente via
`npm run dev` (só funciona contra o build de produção servido localmente).
Também deixa qualquer desenvolvimento local com `npm run dev` instável até
ser corrigido.

**Correção recomendada (não aplicada ainda)**: mover os JSONs de tradução
para dentro de `src/locales/` (fora de `public/`) e importar normalmente
como módulo, ou trocar o import em `i18n.ts` por `?url` + `fetch()` em
runtime. Requer ajustar `i18next-browser-languagedetector`/carregamento
lazy se os arquivos forem grandes.

## 2. Limitação: Sentry não captura erros do lado servidor (Vercel/Nitro)

**Severidade**: Baixa/aceita como trade-off — captura client-side funciona
normalmente.

**Causa**: o SDK `@sentry/tanstackstart-react` inclui, no lado servidor,
dependências pesadas (`@sentry/node`, OpenTelemetry). Tanto import estático
quanto dinâmico desse pacote dentro de `src/start.ts` (middlewares globais
oficiais `sentryGlobalRequestMiddleware`/`sentryGlobalFunctionMiddleware`)
fazem o Nitro (preset `vercel`) tentar empacotar essas dependências na
função serverless, disparando um bug conhecido do Rollup
(`Cannot read properties of null (reading 'getVariableForExportName')`,
[rollup/rollup#4739](https://github.com/rollup/rollup/issues/4739)) que
quebra o build de produção por completo.

**Solução aplicada**: a captura de erro do Sentry ficou limitada ao client
(`src/instrument.client.ts`, `src/client.tsx`, e o `ErrorComponent` de
`src/routes/__root.tsx` via `src/lib/report-error-client.ts`, usando
`createIsomorphicFn` para restringir o import do SDK ao browser). Erros que
ocorrem exclusivamente no servidor (SSR, server functions) continuam
apenas logados via `console.error` pelo `errorMiddleware` já existente,
visíveis nos logs da Vercel, mas não chegam ao Sentry Dashboard.

**Correção futura possível**: aguardar atualização do SDK do Sentry para
esse cenário, ou testar um upgrade de Vite/Rollup (mudança maior, fora do
escopo original do spec).

## 3. Achados durante a implementação (não são bugs, mas merecem registro)

- **`trackPartnerProfileView`/`trackPartnerContactClick` silenciavam erros**
  antes da task 17.5 — não desestruturavam `{ error }` do retorno de
  `supabase.rpc()`, o que fazia qualquer erro (incluindo o de rate limit,
  `P0429`) ser descartado silenciosamente. Corrigido: ambas agora relançam
  o erro, no mesmo padrão já usado por `finishActivity`.
- **Testes E2E (`tests/e2e/*.spec.ts`) rodam contra o Production_Supabase_Project
  real** — não há banco de teste local disponível neste ambiente (Docker
  não instalado). Cada execução de `signup.spec.ts`/`submit-review.spec.ts`
  cria um usuário real de teste (e uma review real, no caso do
  `submit-review.spec.ts`) no banco de produção. Os testes de login/cadastro
  removem o usuário de teste ao final (`test.afterAll`, best-effort); a
  review de teste criada em `submit-review.spec.ts` **não** é removida
  (decisão documentada no próprio arquivo — não há FK nem constraint de
  unicidade que a torne um problema).
- **Vitest também tenta coletar os specs do Playwright** em
  `tests/e2e/*.spec.ts`, gerando falhas de coleta (não de execução) ao
  rodar `npm run test`. Não trava a suíte (aparecem como falhas de arquivo,
  não de teste), mas seria bom no futuro excluir `tests/e2e/` da
  configuração do Vitest (`vitest.config`/`vite.config.ts`, campo
  `test.exclude`) para limpar a saída.

## 4. Variáveis de ambiente que faltam na Vercel (ver instruções abaixo)

Ver seção "Cadastro de variáveis de ambiente na Vercel" para o passo a
passo completo. Resumo do que falta cadastrar em produção:

- `SENTRY_DSN` / `VITE_SENTRY_DSN` (novo, task 17.1/17.2)
- Confirmar que `GOOGLE_PLACES_API_KEY` já está cadastrada (task 12.1, spec
  anterior — deve já estar lá, mas vale confirmar)
- Confirmar que as 7 variáveis do Supabase (`SUPABASE_URL`,
  `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID`,
  `VITE_SUPABASE_PROJECT_ID`, `SUPABASE_SERVICE_ROLE_KEY`) já estão
  cadastradas (spec `migracao-supabase-proprio-lovable`, já deve estar OK).
