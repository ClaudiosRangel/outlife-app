# Roadmap OutVitar — orientação obrigatória de toda sessão

Este arquivo é carregado automaticamente em toda sessão do Kiro neste
workspace. Ele existe para que NENHUMA sessão se perca no meio do plano de
finalização do app. **Antes de trabalhar em qualquer coisa do OutVitar, leia
o documento-mestre de roadmap** referenciado abaixo — ele é a fonte única de
verdade sobre o que já foi feito, o que está em andamento e o que falta.

## Documento-mestre (fonte de verdade)

#[[file:docs/ROADMAP-FINALIZACAO-APP.md]]

## Regras de continuidade entre sessões

1. **Sempre comece consultando** `docs/ROADMAP-FINALIZACAO-APP.md` para saber
   o bloco/tarefa atual antes de agir.
2. **Sempre atualize** o `docs/ROADMAP-FINALIZACAO-APP.md` ao concluir uma
   tarefa, spec ou bloco — marque o status, a data e um resumo do que foi
   feito. O roadmap deve refletir a realidade do código, não a intenção.
3. **Ordem dos blocos é deliberada** (reduz risco antes de subir pra Apple).
   Não pular blocos sem o usuário pedir explicitamente.
4. **Um spec por bloco**, em `.kiro/specs/`. Cada bloco tem seu próprio
   ciclo requirements → design → tasks. O roadmap lista o nome do spec de
   cada bloco.
5. **Rebranding**: o app está migrando de "OutLife" para **OutVitar** (slogan
   "VIVER É DIFERENTE DE ESTAR VIVO"). Textos novos voltados ao usuário usam
   OutVitar. O `appId` técnico atual ainda é `app.outlife.mobile` — a troca
   de identidade técnica está planejada no bloco de rebranding, não fazer
   antes.
6. **Idioma**: toda conversa com o usuário em português (regra já existente
   em `idioma-portugues.md`). Specs em português.
7. **Confiabilidade estilo Strava** é o padrão de qualidade para
   rastreamento (trajeto/tempo/velocidade). Nunca degradar a integridade de
   registro de atividades.

## Padrões técnicos do projeto (resumo — detalhe no roadmap)

- Stack: React 19 + TypeScript + Vite + TanStack Start/Router + Supabase +
  Tailwind + Shadcn UI. App nativo via Capacitor 8 (`android/`; `ios/` ainda
  não gerado — necessário Codemagic para build iOS, o usuário não tem Mac).
- Migrations Supabase: sempre criar arquivo novo timestampado em
  `supabase/migrations/`, idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`,
  `DROP ... IF EXISTS`). Nunca editar migration já aplicada.
- Rastreamento vive em `src/hooks/use-activity-tracker.ts` +
  `src/lib/activity-*.ts` + `src/lib/haversine.ts`. Não reescrever a base;
  estender.
- Testes: Vitest (unit + fast-check para property-based) e Playwright (E2E).

## HANDOFF — como trabalhamos (ler na íntegra ao iniciar sessão)

Este bloco é o "modo de operação" combinado com o usuário. Seguir sempre.

### Fluxo de cada rodada de mudança
1. Ler `docs/ROADMAP-FINALIZACAO-APP.md` (topo = rodadas recentes) antes de agir.
2. Uma coisa por vez, bem-feita, sem quebrar o que funciona. Ler o código
   relevante antes de codar (não duplicar/reescrever).
3. Ao final de CADA rodada: `npm run build:native` → `npx cap sync android` →
   `gradlew.bat assembleDebug` (gera APK) → commit + push na `main` →
   atualizar o `docs/ROADMAP-FINALIZACAO-APP.md`.

### Build / APK (memorizar — armadilhas reais)
- `npm run build:native` (BUILD_TARGET=native-spa → `dist/native-spa`).
  **Frequentemente TRAVA na 1ª invocação** (fica só em "cross-env vite build"
  sem transformar). Parar e reiniciar (às vezes 2-3×). Confirmar conclusão pelo
  timestamp de `dist/native-spa/index.html` mudando + "✓ built in".
- **Se travar repetido após kills forçados de processo:** o cache do vite
  corrompe. Resolver com `Remove-Item -Recurse -Force node_modules/.vite` e
  rodar de novo. (Aconteceu de verdade.)
- `npx cap sync android` (às vezes demora/pendura; confirmar por
  `android/app/src/main/assets/public/index.html` timestamp).
- `cd android && .\gradlew.bat assembleDebug --console=plain` (30s–4min; daemon
  Gradle às vezes reinicia — aguardar). Buscar "BUILD SUCCESSFUL".
- APK: `c:\Source\OutLife\android\app\build\outputs\apk\debug\app-debug.apk`
  (~9,96 MB atualmente).
- Rodar tudo via `control_pwsh_process` (start) e ler saída com
  `get_process_output`; parar o processo (stop) ao terminar cada etapa.

### Verificação
- Preferir `get_diagnostics` nos arquivos tocados (rápido) a rodar `tsc` inteiro
  (o tsc costuma travar/demorar nesta máquina). O `build:native` bem-sucedido já
  valida imports/sintaxe/routeTree.
- Colunas/RPC novas do Supabase → resolver erro de tipo com `as never` no
  `.select()/.insert()/.eq()/.rpc()/.from()`.
- **Testes de lib pura NÃO devem importar do hook `use-activity-tracker`**
  (puxa Capacitor e trava a coleta do vitest). Extrair a função pura para um
  módulo próprio em `src/lib/` e testar lá (foi o que fizemos com
  `activity-duration.ts`).
- Testes: `control_pwsh_process` start `npx vitest run <arq> --reporter=basic`,
  aguardar ~30s, ler saída ("Tests X passed"), parar o processo (pendura no fim,
  normal).

### Git
- Commit + push sempre na `main`. `git push` escreve no stderr e retorna exit
  code 1 mesmo com sucesso no PowerShell — **confirmar pela linha
  `xxx..yyy main -> main`**. DNS às vezes falha; retentar.
- Shell é PowerShell: separador de comandos é `;` (não `&`).

### Migrations Supabase (o agente aplica em produção)
- `SUPABASE_DB_URL` está no `.env`. Aplicar com
  `node scripts/run-one-migration.mjs supabase/migrations/<arquivo>.sql`,
  **rodar 2× (idempotência)**, depois `node scripts/reload-postgrest-schema.mjs`.
- Migration idempotente (`IF NOT EXISTS`/`CREATE OR REPLACE`/`DROP...IF EXISTS`;
  para constraint usar `DO $$ ... EXCEPTION WHEN duplicate_object THEN null $$`).
- Refletir cada migration no consolidado `supabase/migrations-pendentes.sql`
  (numerado; já vai até o item ~44).
- Chaves do Supabase no `.env`: `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`
  (não é "ANON_KEY"). Connection string Postgres = `SUPABASE_DB_URL`.
- Scripts temporários de debug: prefixo `_tmp-`, ler `.env`, `new pg.Client({
  connectionString, ssl:{rejectUnauthorized:false} })`. **SEMPRE remover após usar.**

### routeTree.gen.ts (CRÍTICO — o gerador é intermitente)
- Ao adicionar rota nova, editar `src/routeTree.gen.ts` MANUALMENTE em 8 pontos:
  (1) import, (2) const `.update()`, (3-5) as 3 interfaces
  (FileRoutesByFullPath/To/ById), (6-8) os 3 unions (fullPaths/to/id),
  RootRouteChildren interface + objeto rootRouteChildren, e o bloco
  `declare module` FileRoutesByPath.
- **Truque validado:** quando as linhas se repetem, criar script temporário
  `_tmp-rtN.mjs` com `s.split(from).join(to)` (com contagem esperada por
  bloco) para inserir em todas as ocorrências de uma vez. Remover o script depois.
- **Rotas dinâmicas devem ser FLAT**, não aninhadas. Se o arquivo é
  `segmento.$segmentId.editar.tsx`, o build ANINHA como filha de `$segmentId`
  (que não tem `<Outlet/>`) e a tela não abre. Solução: nomear
  `segmento.editar.$segmentId.tsx` → rota `/segmento/editar/$segmentId` (flat).
- Após o build, VERIFICAR (grep) que as rotas flat sobreviveram (o build pode
  regenerar). Rotas dinâmicas usam `$` (ex.: `/oferta/$campaignId`).

### i18n
- `public/locales/pt-BR/translation.json` e `public/locales/en/translation.json`.
  Validar com `node -e "JSON.parse(...)"`. Plurais i18next: `_one`/`_other` com
  `{{count}}`. Sempre passar `defaultValue` no `t()` de chaves novas.

### Mapa / GPS
- **mapbox-gl (WebGL) NÃO funciona no WebView Android** (tela branca). Usar
  **Leaflet + tiles raster do Mapbox** via `getMapboxToken()` (`src/lib/map-config.ts`).
  Token no `.env` como `VITE_MAPBOX_TOKEN` (público `pk.`). 3D real inviável no
  WebView.
- Seletor de camadas padronizado: `src/components/map-layers.tsx`
  (`MapLayerControl` + `MapTileLayer`). Todos os mapas usam.
- Ícone de voo livre = PARAPENTE (não avião).
- Rastreamento: NÃO reescrever `use-activity-tracker.ts`; estender. Duração final
  usa `max(contador, elapsedFromPoints(pontos))` (`src/lib/activity-duration.ts`)
  porque o Android congela o setInterval em 2º plano (senão a velocidade média
  infla). Elevation gain estilo Strava em `src/lib/elevation-gain.ts`.

### Loja virtual / campanhas (estado atual)
- `partner_campaigns` (tema/layout/cta/preço/show_on_start/post_to_community/
  notify_users). Card visual reutilizável: `CampaignCard` (em
  `StartCampaignBanner.tsx`) + `campaign-style.ts` (6 temas, 3 layouts).
  Carrossel com autoplay: `CampaignCarousel.tsx` (Home + Comunidade).
- Ofertas aparecem: Home (seção "Loja Virtual"), Comunidade (topo do feed).
  NÃO na tela Gravar (removido a pedido). Clique → `/oferta/$campaignId`.
- Checkout Pix/cartão + cupons: estrutura PRONTA em MODO SIMULADO (tabelas
  `orders`/`coupons`/`coupon_redemptions`, RPCs, Edge Functions
  `payment-create`/`payment-webhook` + `_shared/psp.ts` agnóstico). Falta plugar
  PSP real — guia em `docs/CHECKOUT-ATIVAR-PAGAMENTO.md`.

### Backlog acordado com o usuário (fila, fora do que já foi feito)
- Estratégia WhatsApp PRO: convite bonito que leva quem não tem o app a
  baixar/cadastrar para participar do evento; + incentivo de INDICAÇÃO (quem
  convida amigo que aceita ganha cupom de desconto com % definido na
  administração, válido em qualquer loja virtual). **Pensar junto com o usuário
  antes de implementar.**
- Tela de admin de cupons (`/admin/cupons`).
- Rebranding técnico (appId → OutVitar) + publicação (Codemagic p/ iOS).
- Pedido do usuário: **analisar o app inteiro e dar parecer sincero de design**
  (o que mudar para ficar competitivo/profissional/viciante).
