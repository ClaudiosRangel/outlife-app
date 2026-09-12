# Roadmap de Finalização — OutVitar (ex-OutLife)

> **Fonte única de verdade** do plano de finalização do app antes da
> publicação nas lojas. Toda sessão do Kiro lê este arquivo (via
> `.kiro/steering/roadmap-outvitar.md`). **Mantenha-o atualizado** ao
> concluir qualquer tarefa/bloco: marque status, data e resumo.

**Última atualização:** 12/09/2026 (spec evolucao-admin-atividades-social — Frentes A/B/C/D/E/F concluídas)
**App:** OutVitar — slogan "VIVER É DIFERENTE DE ESTAR VIVO"

> **🟦 BLOCO EM ANDAMENTO — spec `evolucao-admin-atividades-social`**
> (`.kiro/specs/evolucao-admin-atividades-social/`) — requirements ✅ | design ✅
> | tasks ⬜ | implementação ⬜. 8 frentes solicitadas pelo usuário, a
> implementar UMA A UMA (build+commit por frente). Ordem (menor→maior risco):
> A) ✅ CONCLUÍDA (12/09/2026) — Req 6 trial parceiro 1 ano. `partner-trial.ts`
>    (computeTrialStatus, 365d, 5 testes fast-check) + coluna
>    `profiles.trial_started_at` (migration 20260911170000, aplicada em prod, fallback created_at)
>    + `fetchPartnerTrialStatus` reescrita (por data) + painel exibe dias
>    restantes/progresso por tempo (i18n partnerTrial.*). APK 14:11.
> B) ✅ CONCLUÍDA (12/09/2026) — Req 7 bug deep link `/a/:id` 404 no nativo.
>    `deep-link.ts` (parseDeepLink puro, 6 testes fast-check) + `useDeepLinkNavigation`
>    em `__root.tsx` reescrito: `/a/:id` navega para a rota de preview `/a/$activityId`
>    (não mais redireciona pra detalhe), com fallback e tratamento de cold start.
>    Também dei 1 ano cheio de trial (trial_started_at=now) aos 9 parceiros atuais. APK 14:33.
> C) ✅ CONCLUÍDA (12/09/2026) — Req 9 comentários: respostas (thread
>    `parent_comment_id`) + curtir (`comment_likes`, idempotente) + excluir
>    (autor/admin). Migration 20260912100000 aplicada em prod (RPCs
>    create_post_comment estendida, toggle_comment_like, delete_post_comment).
>    api.ts: fetchPostComments (raiz+replies+liked_by_me), replyToComment,
>    toggleCommentLike, deleteComment. UI comunidade.tsx: CommentRow +
>    PostComments reescrito (replies aninhados, curtir otimista, responder,
>    excluir). Idempotência validada no banco. SEM APK (build no final do bloco).
> D) ✅ CONCLUÍDA (12/09/2026) — Req 5 catálogo de tipos de atividade.
>    Migration 20260912110000 aplicada em prod (tabela `activity_types`
>    code/name/icon_key/metric_form/active/position + RLS; relaxou CHECK de
>    `user_activities.activity_type`; seed 8 tipos). `metric-forms.ts`
>    (computeByMetricForm pace_km/speed_elevation/pace_100m, testes fast-check —
>    achou bug real de distância subnormal→Infinity, corrigido).
>    `activity-icons.ts` (ICON_MODEL_SET 8 ícones lucide). api.ts: fetch/create/
>    update/delete/reorderActivityType(s). Tela admin `/admin/atividades` (CRUD +
>    seletor de ícone + metric_form + reorder + toggle active), card no hub.
>    `atividade.rastrear.tsx` lê o catálogo (fallback ao enum). routeTree
>    regenerado manualmente (o build:native não gerou a rota nova — inserida à
>    mão seguindo o padrão de admin.compliance). tsc limpo. SEM APK (fim do bloco).
> E) ✅ CONCLUÍDA (12/09/2026) — Req 8 banners OUTVITAR. `banner-generator.ts`
>    estendido (retrocompatível): marca "OUTVITAR", ícone+nome da atividade,
>    descrição do usuário ou Default_Description, métricas por metric_form,
>    variantes foto/mapa/poster. PNGs dos 8 ícones em `public/activity-icons/`
>    gerados por `scripts/gen-activity-icons.mjs`. `atividade.$activityId.tsx`
>    integrado (busca catálogo, computeByMetricForm, seletor Foto/Mapa).
>    Testes fast-check (resolveBannerDescription/truncateForBanner). i18n
>    bannerDefaultDescription/shareBannerText/bannerVariant*. tsc limpo. SEM APK.
> F) ✅ CONCLUÍDA (12/09/2026) — Req 4 sugestões de amizade. RPC
>    `suggest_friends(_limit)` (SECURITY DEFINER, migration 20260912120000
>    aplicada em prod): amigos-de-amigos + atividade (completed) em comum,
>    exclui self e qualquer relação existente, dedup, só campos públicos.
>    `fetchFriendSuggestions` + type FriendSuggestion. Seção "Sugestões para
>    você" no topo de `/amigos` (Adicionar remove otimista, rótulo por reason,
>    placeholder). i18n friends.suggestions*/reason*. tsc limpo. SEM APK.
> G) Req 3 conquistas por Destino via GPS — `user_destination_visits` + RPCs; keys `destinos_1/5/10`.
> H) Req 1/2 importação/curadoria trilhas-destinos (OSM/ICMBio) — `imported_trails` + `scripts/import-trails.mjs` + `/admin/trilhas` (toggle visível; atribuição OSM obrigatória).
>
> ⚙️ DECISÃO (12/09/2026): a partir da Frente C, o **APK é gerado só no FINAL
> do bloco** (todas as frentes). As migrações continuam aplicadas em produção
> por frente e os commits também são por frente; só o build nativo/APK fica
> acumulado para o fim.
> Detalhe completo em requirements.md + design.md do spec. Cada frente concluída
> marcar aqui com data/resumo/migration.


> **⚠️ ESTADO ATUAL (ler primeiro numa nova sessão) — 09/09/2026**
>
> Blocos A–F concluídos. Estamos numa fase de **ajustes de UX/bugfix pós-teste
> do APK** (usuário testando no celular real, iOS + Android).
>
> **✓ MIGRAÇÕES APLICADAS EM PRODUÇÃO (09/09/2026):** o
> `supabase/migrations-pendentes.sql` INTEIRO foi executado direto no banco
> de produção via `scripts/run-migrations.mjs` (lib `pg` + `SUPABASE_DB_URL`
> no `.env`, connection string direta do Postgres). Todos os 23 objetos
> verificados presentes (`scripts/verify-all-objects.mjs`). Corrigida também
> uma ambiguidade `PGRST203` de `finish_user_activity` (existiam 2 versões,
> 9 e 10 args; dropada a de 9 via `scripts/fix-finish-fn.mjs`, mantida a de 10
> com `_video_url` que o frontend chama). A partir de agora eu POSSO rodar SQL
> em produção com esses scripts — não depende mais do SQL Editor manual.
> **Nota de segurança:** a senha do banco foi exposta no chat; o usuário deve
> trocá-la (Settings → Database → Reset database password) e atualizar o
> `.env`.
>
> **Já feito nesta rodada (commitado + APK gerado):** curtir parceiro (upsert
> idempotente), avaliações recalculam rating/reviews_count (trigger + backfill),
> painel do parceiro (leads/reservas + avaliações recebidas + contador de
> favoritos), push ao parceiro (tipos partner_lead/review_received), área
> administrativa `/admin` (hub aprovar cadastros/destinos, atalho no perfil só
> p/ admin), badge do ícone (contagem de não-lidas no payload FCM), menu com
> concavidade SVG no botão Gravar, logo transparente no topo, StatusBar
> decorativa removida.
>
> **PENDÊNCIAS ABERTAS (o que fazer a seguir):**
> 1. **Avaliações não aparecem no painel** — ✓ BUG REAL ENCONTRADO E
>    CORRIGIDO (10/09/2026): a tabela `reviews` tem DUAS FKs para `profiles`
>    (`author_id` e `partner_id`), então o embed PostgREST `author:profiles(...)`
>    era AMBÍGUO (PGRST201) e a query falhava — deixando a seção presa no
>    Skeleton (caixa cinza vazia da tela do usuário). Corrigido qualificando a
>    FK: `author:profiles!reviews_author_id_fkey(...)` em `fetchReviewsByPartner`
>    e `fetchReviewsByDestination` (api.ts). Confirmado no banco: o parceiro
>    `6d97e26d...` tem 8 avaliações reais; a conta do usuário testador (Caio,
>    author_id `d1542723...`) é quem ESCREVEU as reviews, por isso o painel
>    dele estava vazio (correto). Agora o painel do parceiro avaliado mostra as
>    reviews, e o estado vazio mostra o texto certo.
> 2. **Logo do topo** — ✓ FEITO: size=78 no BrandLogo (index.tsx), no APK.
> 3. **Badge/push no celular** — ✅ CAUSAS RAIZ CORRIGIDAS (10/09/2026): (a) o
>    app não registrava o token (`registerPushForCurrentPlatform` nunca era
>    chamado) → criado hook `useRegisterPush` ligado no `__root.tsx` dentro do
>    AuthProvider; (b) `fn_send_native_push` chamava `extensions.http_post`
>    inexistente → corrigido para `net.http_post` (pg_net), migration
>    20260910120000 aplicada; (c) adicionada permissão POST_NOTIFICATIONS
>    (Android 13+). FIREBASE_SERVICE_ACCOUNT confirmado OK na Vercel (endpoint
>    responde com erro do FCM, não 503). FALTA validar no aparelho real:
>    instalar APK novo → logar → aceitar permissão popula native_push_tokens.
>    iOS ainda exige APNs no Firebase. Detalhe antigo mantido abaixo:
>    o payload FCM já manda notification_count/aps.badge (item 12 do
>    migrations-pendentes, JÁ APLICADO em produção), MAS: (b) no iOS o badge exige permissão de badge + APNs configurado no
>    Firebase; (c) a "central de notificações" vazia sugere que o PUSH em si
>    não está chegando — investigar se native_push_tokens está sendo populado
>    (registro do token no device) e se o fn_send_native_push→/api/push/send-fcm
>    está funcionando em produção (FIREBASE_SERVICE_ACCOUNT na Vercel). Pode ser
>    que push nunca tenha chegado no device de teste — validar a cadeia inteira.
> 6. **Push — 2º round de correção (11/09/2026)**: além do registro/net.http_post,
>    faltava a URL absoluta da API no app nativo. `push-registration.ts` usava
>    `VITE_API_BASE_URL ?? ""` → no Capacitor o fetch relativo ia p/ localhost
>    do WebView (endpoint inexistente). Corrigido: em plataforma nativa usa
>    `https://outlife-app.vercel.app`. Listeners de registration anexados ANTES
>    de register(). VALIDAR no aparelho: instalar APK, logar, aceitar permissão
>    → conferir `native_push_tokens` populada.
> 7. **Área admin ampliada (11/09/2026)**: 3 telas novas — Dashboard
>    (`/admin/dashboard`, RPC admin_dashboard_stats: usuários/ativos/publicações/
>    interações/atividades/eventos/destinos), Textos da Home (`/admin/conteudo`,
>    tabela app_content editável, Home lê via fetchAppContent com fallback i18n),
>    Publicar interação (`/admin/publicar`, cria community_post com imagem/vídeo
>    em qualquer categoria). Migration 20260910140000 aplicada em produção.
>
> 4. **Dicas/Melhorias (checklist admin)** — ✓ FEITO (10/09/2026): novo menu
>    na Área administrativa (`/admin/melhorias`). O admin registra uma dica/
>    melhoria (título + descrição opcional) que vira item de checklist
>    PENDENTE; marca como PRONTO com um toque (círculo → check verde, texto
>    riscado). Contadores pendentes/prontas, excluir com confirmação, pendentes
>    no topo. Tabela `admin_suggestions` (migration 20260910100000, RLS só
>    admin) JÁ APLICADA em produção via `scripts/run-one-migration.mjs`.
>    Funções em api.ts: `fetchAdminSuggestions`, `createAdminSuggestion`,
>    `setAdminSuggestionDone`, `deleteAdminSuggestion`. i18n bloco `adminTips.*`.
> 5. Dashboard Supabase: templates de e-mail OutVitar (docs/EMAILS-SUPABASE-
>    OUTVITAR.md) — pendente o usuário aplicar.
>
> **Como buildar APK:** `npm run build:native` → `npx cap sync android` →
> `cd android && .\gradlew.bat assembleDebug`. APK em
> `android/app/build/outputs/apk/debug/app-debug.apk`. Rotas novas (ex.: /admin)
> exigem regenerar `routeTree.gen.ts` — o `build:native` já regenera.
> **git:** commitar + push na `main` (repo ClaudiosRangel/outlife-app). tsc só
> deve ter os 6 erros pré-existentes de use-local-push.ts.
**Objetivo final:** finalizar as 14 frentes solicitadas, com confiabilidade
de registro estilo Strava, e publicar na App Store (via Codemagic, sem Mac) e
Play Store.

---

## Legenda de status

- ⬜ **A fazer** — ainda não iniciado
- 🟦 **Em andamento** — spec ou implementação em progresso
- ✅ **Concluído** — implementado, testado e validado
- ⏸️ **Bloqueado / aguardando** — depende de terceiro (ex.: conta Apple, Mac/CI)

Cada bloco tem um spec dedicado em `.kiro/specs/<nome>/`. O ciclo de cada
spec é requirements → design → tasks → implementação → QA.

---

## Ordem de execução (deliberada — reduz risco antes das lojas)

| # | Bloco | Spec | Itens do usuário | Status |
|---|-------|------|------------------|--------|
| A | Precisão do rastreamento GPS | `rastreamento-preciso-gps` | 1, 11 | ✅ Concluído |
| B | Estabilidade (crash de memória em fotos) | `estabilidade-comunidade-midia` | 7 | ✅ Concluído |
| C | Rebranding OutLife → OutVitar (só front) | `rebranding-outvitar` | nome, logo, slogan | ✅ Concluído |
| D | Vídeo na atividade/comunidade (itens 4,5 já prontos) | `video-atividade-comunidade` | 6 | ✅ Concluído |
| E | Gamificação & Perfil | `gamificacao-niveis-rank` | 10, 12 | ✅ Concluído |
| F | Parceiros & Cadastros completos | `parceiros-cadastros-completos` | 2, 3, 8, 9, 13 | ✅ Concluído |
| G | QA — suíte de testes do app | `qa-app-outvitar` | 14 | ⬜ A fazer |
| H | Publicação nas lojas (iOS via Codemagic + Android) | `publicacao-lojas` | subir p/ Apple | ⏸️ Aguardando conta Apple |

> **Navegação de menu aprovada pelo usuário** (padrão de mercado):
> `Início · Explorar · ⏺ Gravar · Comunidade · Você`. Parceiros e busca ficam
> como conteúdo dentro de Explorar/Início, não como abas próprias. Aplicar ao
> longo dos blocos D/E/F e consolidar no rebranding (C).

---

## Bloco A — Precisão do rastreamento GPS (itens 1, 11)

**Spec:** `.kiro/specs/rastreamento-preciso-gps/`
**Status:** ✅ Concluído — requirements ✅ | design ✅ | tasks ✅ | implementação ✅ | testes ✅

**Problema:** ao caminhar, o app mostra velocidade de corrida; trajeto não
fiel por ruído de GPS. Causa raiz: filtro de acurácia frouxo (20m), threshold
de 2m fixo, e velocidade média derivada de distância inflada.

**Escopo:** camada de validação/filtragem de pontos (acurácia, salto por
Speed_Ceiling por tipo, deslocamento mínimo calibrado), velocidade instantânea
suavizada, warmup de sinal, indicador de qualidade de GPS. Sem alterar modelo
de dados nem fluxo de finalização/offline.

**Histórico:**
- 07/09/2026 — requirements.md criado e refinado (7 requisitos, EARS).
- 07/09/2026 — design.md criado. Decisões: 4 módulos puros novos
  (`tracking-config`, `point-validation`, `instant-speed`, `gps-signal`);
  filtragem por acurácia (12m caminhada), Speed_Ceiling por tipo, deslocamento
  mínimo 1.5m; velocidade suavizada por média móvel (não Kalman); sem mudança
  de schema nem do plugin nativo. 10 correctness properties.
- 07/09/2026 — tasks.md criado. 7 tarefas-pai em 5 waves: módulos puros
  (config, validação, velocidade, sinal) → integração no hook → UI →
  verificação.
- 07/09/2026 — **Bloco A IMPLEMENTADO E TESTADO (✅ concluído)**. Novos módulos
  puros: `src/lib/tracking-config.ts`, `point-validation.ts`, `instant-speed.ts`,
  `gps-signal.ts` (+ testes, 42 passando com fast-check). `use-activity-tracker.ts`
  integrado (`ingestSample` unificado nativo/web, `lastAcceptedRef`,
  `smoothedSpeedMps`, `gpsSignalState`). UI `atividade.rastrear.tsx`: velocidade
  suavizada ao vivo + indicador de sinal GPS. i18n pt-BR/en (`metrics.currentSpeed`,
  `gpsSignal.*`). Rebuild do plugin nativo (dist desatualizado). Sem mudança de
  schema. Falhas de teste restantes são pré-existentes (E2E Playwright coletado
  pelo Vitest; timeout de rede no Supabase; 6 erros tsc em use-local-push.ts).

---

## Bloco B — Estabilidade: crash de memória em fotos (item 7)

**Spec:** `.kiro/specs/estabilidade-comunidade-midia/` (bugfix)
**Status:** ✅ Concluído — bugfix.md ✅ | design ✅ | tasks ✅ | implementação ✅ | testes ✅

**Causa identificada (bug condition C(X)):** o app estoura memória do WebView
ao decodificar imagens grandes. Duas causas: (1) preview via
`FileReader.readAsDataURL` materializa a imagem inteira como base64 em
`comunidade.tsx`; (2) Post_Images exibidas em resolução original sem teto de
dimensão. O `image-resize.ts` já cobre o upload (comprime até 5MB) — o crash
é na exibição/preview, não no upload.

**Escopo:** trocar preview para `URL.createObjectURL` (+ revogação); aplicar
Decode_Dimension_Cap na exibição do feed; preservar upload/pipeline e todas as
funções da comunidade. Crítico antes das lojas.

**Histórico:**
- 07/09/2026 — bugfix.md criado (metodologia de bug condition, 4 requisitos).
- 07/09/2026 — design.md + tasks.md criados.
- 07/09/2026 — **Bloco B IMPLEMENTADO E TESTADO (✅ concluído)**. Novo
  `src/components/SafeImage.tsx` (decoding async + lazy + container fixo +
  fallback sem loop via `nextImageSrcOnError`). `comunidade.tsx`: preview
  trocado de `readAsDataURL` (base64) para `URL.createObjectURL` via
  `src/lib/object-url-preview.ts` (`createObjectUrlManager`, revogação
  disciplinada); as 2 `<img>` do feed agora usam `SafeImage`. 10 testes novos
  passando (fast-check). Sem mudança de schema; upload/pipeline/mutações da
  comunidade intactos. Erros restantes do tsc são pré-existentes
  (`use-local-push.ts`).

---

## Bloco C — Rebranding OutLife → OutVitar (nome, logo, slogan)

**Spec:** `.kiro/specs/rebranding-outvitar/`
**Status:** ✅ Concluído (escopo front) — requirements ✅ | design ✅ | tasks ✅ | implementação ✅ | tarefa 6 (ícone/splash) opcional, aguarda logo

**DECISÃO FINAL (08/09/2026):** rebranding é SÓ de nome exibido no front. O
`appId` técnico permanece `app.outlife.mobile` (namespace, applicationId,
package_name, Firebase, deep links, buckets Supabase, storeName localforage
TODOS mantidos) para não quebrar backend/push/configs. Só `appName`/`app_name`
(rótulo sob o ícone) e todos os textos de UI/i18n exibem "OutVitar".

**Decisões do usuário:** trocar `appId` para `app.outvitar.mobile` (antes da 1ª
publicação) + ajustar acento do tema para o laranja/sol da logo.

**Escopo:** nome exibido "OutVitar" (hero, i18n, metadados), slogan "VIVER É
DIFERENTE DE ESTAR VIVO" (i18n), logo (asset centralizado + fallback), tema
(accent → `--sun` laranja), `capacitor.config.ts` (appId + appName), assets
nativos (`@capacitor/assets`, ícone Apple-compliant). Referências internas
técnicas a "outlife" (storeName localforage, buckets Supabase) podem ser
mantidas para não quebrar dados — documentado. A barra de navegação já está no
padrão aprovado (Início·Busca·Explorar·Eventos·Comunidade·Perfil) — não
reestruturada aqui.

**Nota (item 9 do usuário — Busca na Home):** já contemplado; a Home já tem
botão de busca no hero e há aba "Busca" dedicada na navegação.

**Histórico:**
- 07/09/2026 — requirements.md criado (7 requisitos) + análise com 4
  esclarecimentos do usuário incorporados.
- 07/09/2026 — design.md criado. `BrandLogo` (asset + fallback textual);
  nome/slogan em i18n; metadados de rota; tema `--accent` → laranja/sol;
  `capacitor.config.ts` + `build.gradle` (namespace/applicationId) +
  strings.xml; assets via `@capacitor/assets` (bloqueio se ícone não for
  Apple-compliant). Referências internas "outlife" (localforage storeName,
  buckets Supabase) PRESERVADAS para não quebrar dados. 5 correctness
  properties. **Pré-requisito da tarefa de assets nativos: arquivo
  `assets/logo-outvitar.png` 1024×1024 fornecido pelo usuário.**
- 08/09/2026 — **Implementação parcial (tarefas 1–5)**: i18n (nome/slogan +
  8 ocorrências trocadas/idioma + teste de guarda); `BrandLogo` (fallback
  testado); Home usa BrandLogo/slogan/ecosystem; 28 arquivos de rota com
  metadados/textos rebrandizados (termos técnicos `*_Native_Shell`/
  `_Application`/`[OutLife]` preservados); tema `--accent` → laranja; nativo
  (`capacitor.config.ts`, `build.gradle`, `strings.xml`, pasta Java movida
  para `app/outvitar/mobile/`). 7 testes passando, tsc limpo (só os 6
  pré-existentes de use-local-push). **PENDÊNCIAS**: (1) tarefa 6
  (ícone/splash) aguarda `assets/logo-outvitar.png`; (2) **Firebase**:
  `google-services.json` + `assetlinks.json` ainda com `app.outlife.mobile` —
  re-registrar app no Firebase com novo package e baixar novo JSON, senão o
  push (FCM) quebra. `npx cap sync` após resolver.

---

## Bloco D — Social & Comunidade (itens 4, 5, 6)

**Spec:** `.kiro/specs/video-atividade-comunidade/` (item 6)
**Status:** ✅ Concluído (escopo item 6) — requirements ✅ | design ✅ | tasks ✅ | implementação ✅ | testes ✅

**DESCOBERTA (08/09/2026):** ao investigar o código, os itens 4 e 5 JÁ ESTÃO
IMPLEMENTADOS:
- **Item 4 (amigos ao vivo no mapa)** — ✅ PRONTO via spec concluído
  `amigos-em-atividade-ao-vivo`: `LiveFriendsList` em Explorar +
  `fetchLiveActivityFriends` + `MapView` centraliza/acompanha o avatar do amigo
  selecionado + `useLiveActivityPublisher` publica posição no rastreamento.
- **Item 5 (eventos modelo Strava)** — ✅ PRONTO: `eventos.$eventId.tsx` tem
  organizador, "N confirmados" com avatares, "Confirmar presença", data/hora/
  categoria e Q&A. Equivalente ao print do Strava (diferenças só cosméticas).
- **Item 6 (vídeo na atividade → comunidade)** — ❌ não existe suporte a vídeo.

**Escopo do Bloco D = só item 6:** gravar/anexar vídeo na atividade/comunidade
e exibi-lo no feed, com **limites de tamanho e duração** desde o design (lição
do Bloco B: mídia pesada estoura memória). Refino cosmético de eventos fica
opcional/futuro.

**Histórico:**
- 08/09/2026 — requirements.md criado (6 requisitos): anexar vídeo na
  comunidade (preview via Object_URL, não base64); limites Max_Video_Bytes/
  Duration; upload em Video_Bucket dedicado (RLS por usuário); exibição no feed
  sem autoplay/preload (Video_Player + Video_Poster via SafeImage); vídeo no
  Activity_Finish_Sheet; preservação total dos fluxos do Bloco B.
- 08/09/2026 — design.md + tasks.md criados e validados (formato Kiro OK).
  Decisão central: **validar e recusar** (30 MB / 60 s / tipo mp4/webm/mov),
  NÃO transcodificar no cliente (o oposto do objetivo de estabilidade do
  Bloco B). Exibir sem autoplay/preload com poster.
- 08/09/2026 — **Bloco D IMPLEMENTADO E TESTADO (✅ concluído — item 6)**.
  Novos módulos puros: `src/lib/video-validation.ts` (constantes + validação
  tipo/tamanho/duração, total e tipada) + `video-validation.test.ts` (Vitest +
  fast-check). Helper fino de DOM `src/lib/video-duration.ts`
  (`readVideoDurationSeconds` via `<video preload=metadata>`, indeterminável →
  NaN → recusa). Componente `src/components/SafeVideo.tsx` (`preload="none"`,
  sem autoplay, `playsInline`, poster via SafeImage, fallback puro sem loop) +
  teste. `api.ts`: `uploadCommunityPostVideo` (bucket `community-post-videos`),
  `createCommunityPost` e `finishActivity` aceitam `video_url`. `comunidade.tsx`:
  seletor de vídeo (Object_URL, nunca base64), validação na seleção, feed usa
  `SafeVideo` quando há `video_url` (precedência sobre imagem, imagem vira
  poster). `atividade.rastrear.tsx`: vídeo opcional no finish; **desabilitado
  offline** (Req 5.4, aviso claro). i18n pt-BR/en. **2 migrações Supabase
  idempotentes**: `20260908120000_community-post-video.sql` (coluna `video_url`
  + bucket + RLS espelhando imagens) e `20260908120500_finish-activity-video.sql`
  (coluna `user_activities.video_url` + `finish_user_activity` com `_video_url`
  propagando para atividade e post automático). 24 testes passando (14 novos +
  10 do Bloco B, sem regressão). `tsc --noEmit`: só os 6 erros pré-existentes de
  `use-local-push.ts`. **PENDÊNCIA de deploy**: aplicar as 2 migrações no
  Supabase (o cliente já usa `as never` nos inserts, então o front compila
  antes da migração, mas o `video_url` só persiste após aplicá-las).

---

## Bloco E — Gamificação & Perfil (itens 10, 12)

**Spec:** `.kiro/specs/gamificacao-niveis-rank/`
**Status:** ✅ Concluído — requirements ✅ | design ✅ | tasks ✅ | implementação ✅ | testes ✅

**Escopo:**
- Item 10: nível do usuário (iniciante/intermediário/avançado) por atividades
  reais concluídas — nível geral + nível por tipo (caminhada/pedalada/trilha).
- Item 12: rankings por km, menor tempo, maior altimetria — escopo global ou
  entre seguidos, filtro de período (semana/mês/ano/sempre) e por destino.

**Decisões do usuário (aprovadas):** faixas combinadas por OR (intermediário
10 ativ. / 50 km / 1000 m; avançado 50 ativ. / 300 km / 8000 m); nível geral +
por tipo; ranking global e entre seguidos com seletor; ranking por destino
excluindo atividades sem destino; filtro semana/mês/ano/sempre.

**Histórico:**
- 08/09/2026 — requirements.md (8 requisitos), design.md e tasks.md criados e
  validados (formato Kiro OK). Decisões-chave: **nível derivado no cliente**
  (função pura, não persiste `profiles.level` → sem trigger extra);
  **ranking via RPC `SECURITY DEFINER`** (a RLS de `user_activities` não deixa
  ler entre usuários) retornando só campos públicos; `tempo` = MIN(duração)
  por usuário (marca pessoal), demais = SUM.
- 08/09/2026 — **Bloco E IMPLEMENTADO E TESTADO (✅ concluído)**. Módulos puros:
  `src/lib/user-level.ts` (`classifyLevel`/`levelProgress`, faixas por OR,
  monotônico, total) + teste; `src/lib/ranking-format.ts` (`sortRanking`,
  `formatRankingValue`, `periodStartIso` — semana=segunda 00:00 local) + teste.
  Migração idempotente `20260908130000_gamificacao-niveis-rank.sql`: VIEW
  `user_level_stats` (por user_id+tipo, só completed) + RPC
  `fetch_activity_ranking` (SECURITY DEFINER, filtros período/destino/escopo
  via `user_friends` requester=auth.uid() following/accepted + self, Top N).
  `api.ts`: `fetchUserLevelStats` + `fetchActivityRanking`. `perfil.tsx`:
  Level_Card real (nível derivado + progresso) + chips de nível por tipo +
  atalho para rankings. Nova tela `src/routes/ranking.tsx` (Leaderboard: métrica/
  escopo/período, destaque do usuário logado, estado vazio). Ranking por destino
  em `destino.$destinationId.tsx`. i18n pt-BR/en (`profile.levels`, bloco
  `ranking`). 44 testes passando (25 novos). `tsc --noEmit`: só os 6
  pré-existentes de `use-local-push.ts`. **Bug de hardening corrigido**: o
  fast-check expôs que `ALLOWED_VIDEO_TYPES[type]` colidia com chaves de
  protótipo (`"valueOf"` → função truthy); `validateVideoFileMeta`
  (Bloco D) passou a usar `hasOwnProperty`. **PENDÊNCIA de deploy**: aplicar a
  migração no Supabase (o cliente usa `as never`, compila antes; VIEW/RPC só
  respondem após aplicar). `routeTree.gen.ts` regenerado com a rota /ranking.

---

## Bloco F — Parceiros & Cadastros completos (itens 2, 3, 8, 9, 13)

**Spec:** `.kiro/specs/parceiros-cadastros-completos/`
**Status:** ✅ Concluído — requirements ✅ | design ✅ | tasks ✅ | implementação ✅ | testes ✅

**Decisões do usuário (aprovadas):** cadastro completo opcional em geral,
obrigatório só no fluxo de verificação do parceiro (1a); PF→CPF, PJ→CNPJ (CPF
do responsável opcional), CADASTUR concede o selo para ambos; parceiros em
Explorar com abas Destinos/Parceiros, mantendo `/marketplace` e `/mercado`.

**Descobertas (investigação):**
- Item 2 (parceiro = conta): já é estrutural (`profiles.role='partner'` sobre
  `auth.users`; seed de demo é a única exceção documentada). Nada a fazer.
- Item 9 (busca na Home): já existe (atalho no hero → `/busca` unificada de
  destinos/parceiros/posts). Nada a fazer.
- Item 3 (avaliações): já é nota única + comentário/foto + XP; sem multicritério
  nem mensageria. Mantido como está (decisão do usuário).
- Dados sensíveis (phone/cnpj/cadastur) já vivem em `profile_contacts`
  owner-only; **faltavam** cpf, person_type e endereço estruturado.
- NÃO havia validação de dígito verificador de CPF/CNPJ (só regex de formato).

**Histórico:**
- 08/09/2026 — requirements.md (8 requisitos), design.md e tasks.md criados e
  validados. Decisões-chave: validação pura de documento (dígito verificador)
  em `document-validation.ts`; documento/telefone em `profile_contacts`
  (owner-only), endereço/person_type em `profiles` (nullable, não sensível);
  `PartnerList` reutilizável em vez de refatorar o marketplace.
- 08/09/2026 — **Bloco F IMPLEMENTADO E TESTADO (✅ concluído)**. Módulo puro
  `src/lib/document-validation.ts` (`isValidCPF`/`isValidCNPJ` com dígito
  verificador real, `isValidCEP`, `onlyDigits`, máscaras) + teste (17,
  fast-check). Migração idempotente `20260908140000_cadastros-completos.sql`
  (`profiles` + person_type[CHECK pf/pj] + endereço estruturado nullable;
  `profile_contacts` + cpf + phone_secondary). `api.ts`: `PersonType`,
  `MyContacts`, `fetchMyContacts`, `updateMyContacts` (upsert owner-only,
  valida documento antes de gravar), allowlist ampliada (person_type +
  endereço). `configuracoes.tsx`: seção "Dados completos" (PF/PJ, documento
  com máscara/validação, endereço, telefone; pré-preenche e invalida cache;
  opcional). `compliance.tsx`: CNPJ passou a validar dígito verificador
  (`.refine`) e persiste CNPJ/telefone/CADASTUR em `profile_contacts`.
  `PartnerList.tsx` novo + abas Destinos/Parceiros em `explorar.tsx`
  (item 8; rotas antigas preservadas). i18n pt-BR/en (`explore.tabs`,
  `settings.*` completos). 61 testes passando (17 novos); `tsc --noEmit` só
  com os 6 pré-existentes de `use-local-push.ts`. **PENDÊNCIA de deploy**:
  aplicar a migração no Supabase (colunas só existem após aplicar; o front
  compila antes via `as never`).

---

## Bloco G — QA (item 14)

**Spec:** `.kiro/specs/qa-app-outvitar/` (a criar)
**Status:** ⬜ A fazer

**Escopo previsto:** suíte de testes cobrindo os fluxos entregues nos blocos
A–F. Unit/property (Vitest + fast-check) para lógica de rastreamento/métricas;
E2E (Playwright) para fluxos de tela. Rodar antes da publicação.

---

## Bloco H — Publicação nas lojas

**Spec:** `.kiro/specs/publicacao-lojas/` (a criar)
**Status:** ⏸️ Aguardando conta Apple Developer

**Contexto:** usuário está no Windows, sem Mac. Caminho definido: **Codemagic**
compila e assina iOS na nuvem (App Store Connect API Key, sem Mac). Pré-passos
(navegador): conta Apple Developer US$99/ano, registrar Bundle ID, criar app
no App Store Connect + API Key, ficha da loja + política de privacidade.
Pontos de atenção: permissões de localização em background (maior causa de
rejeição), login de teste nas notas de revisão, `firebase-service-account.json`
nunca no bundle/repo.

**Passo a passo detalhado:** ver histórico da conversa (já entregue) — replicar
no spec quando iniciar.

---

## Registro de sessões (append-only)

- **07/09/2026** — Definido o plano completo em blocos A–H. Criado steering
  `roadmap-outvitar.md` + este roadmap. Bloco A: requirements.md criado e
  refinado. Próximo passo: design.md do Bloco A. Sugestões de menu aprovadas
  pelo usuário. Rebranding para OutVitar definido.
- **08/09/2026** — Blocos A, B, C concluídos em sessões anteriores. **Bloco D
  (vídeo, item 6) concluído nesta sessão**: design + tasks validados,
  implementação completa (video-validation, video-duration, SafeVideo, upload/
  create/finish com video_url, seletor na comunidade e no finish de atividade,
  2 migrações Supabase idempotentes, i18n). 24 testes passando; tsc só com os 6
  erros pré-existentes. Descoberto que itens 4 e 5 já estavam prontos. Próximo:
  **Bloco E — Gamificação & Perfil (itens 10, 12)**. Pendência de deploy do
  Bloco D: aplicar as 2 migrações no Supabase.
- **08/09/2026 (Bloco E)** — **Bloco E concluído nesta sessão**: níveis
  (iniciante/intermediário/avançado, geral + por tipo) e rankings (km/tempo/
  altimetria, global ou seguidos, período semana/mês/ano/sempre, e por destino).
  Módulos puros `user-level.ts` e `ranking-format.ts` (+ testes), VIEW
  `user_level_stats` + RPC `fetch_activity_ranking` (SECURITY DEFINER),
  `fetchUserLevelStats`/`fetchActivityRanking` na api, Level_Card real +
  níveis por tipo no perfil, nova tela `/ranking`, ranking por destino, i18n.
  44 testes passando; tsc só com os 6 pré-existentes. Corrigido bug de
  hardening em `validateVideoFileMeta` (colisão com chaves de protótipo,
  exposto pelo fast-check). Próximo: **Bloco F — Parceiros & Cadastros
  completos (itens 2, 3, 8, 9, 13)**. Pendências de deploy acumuladas
  (aplicar no Supabase): 2 migrações do Bloco D + 1 do Bloco E.
- **08/09/2026 (Bloco F)** — **Bloco F concluído nesta sessão**: cadastros
  completos (PF/PJ, CPF/CNPJ com dígito verificador, endereço estruturado,
  telefone), edição em Configurações, validação reforçada no Compliance, e
  parceiros concentrados em Explorar (abas Destinos/Parceiros). Itens 2, 9 e 3
  já existiam (documentados, sem mudança). Módulo `document-validation.ts` +
  teste, migração de colunas, `fetchMyContacts`/`updateMyContacts`,
  `PartnerList`. 61 testes passando; tsc só com os 6 pré-existentes. Próximo:
  **Bloco G — QA (item 14)**. Pendências de deploy acumuladas (aplicar no
  Supabase): 2 migrações do Bloco D + 1 do Bloco E + 1 do Bloco F.
