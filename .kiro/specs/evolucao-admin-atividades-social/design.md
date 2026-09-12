# Design Document — evolucao-admin-atividades-social

## Overview

Este design detalha, frente a frente, a implementação técnica dos 9 requisitos
do bloco de evolução do OutVitar. Todas as mudanças **estendem** a base
existente (nada é reescrito). O padrão do projeto é seguido à risca:

- **Migrações Supabase idempotentes** (`IF NOT EXISTS` / `CREATE OR REPLACE` /
  `DROP ... IF EXISTS`), em arquivo novo timestampado em `supabase/migrations/`,
  aplicadas em produção via `scripts/run-one-migration.mjs` (o agente aplica;
  `SUPABASE_DB_URL` no `.env`) e refletidas em `supabase/migrations-pendentes.sql`.
- **RLS**: escrita administrativa via `public.is_admin(auth.uid())`; leitura de
  dados entre usuários via RPC `SECURITY DEFINER` (a RLS de `user_activities`
  não permite leitura cruzada).
- **Endpoints server-side** (importação) rodam na Vercel (`src/routes/api.*`);
  no app nativo, chamados pela URL absoluta `https://outlife-app.vercel.app`
  (mesmo padrão de `push-registration.ts`).
- **Telas admin** seguem o padrão existente: guarda `isCurrentUserAdmin`,
  header `bg-gradient-forest`, cards; i18n pt-BR/en.
- **Rotas novas** exigem regenerar `routeTree.gen.ts` (o `build:native` já faz).
- **Testes**: Vitest + fast-check para toda lógica pura nova.

### Ordem de implementação (menor risco → maior risco)

Cada item é entregue, buildado (APK) e commitado isoladamente, como o usuário
pediu ("uma a uma, sem se perder"):

1. **Req 6 — Trial de 1 ano** (mudança pequena e isolada).
2. **Req 7 — Bug do deep link `/a/:id` 404** (bugfix pontual).
3. **Req 9 — Comentários: respostas + curtidas + exclusão** (social, contido).
4. **Req 5 — Catálogo de tipos de atividade** (base para métricas e banners).
5. **Req 8 — Banners OUTVITAR** (depende do catálogo/ícones do Req 5).
6. **Req 4 — Sugestões de amizade**.
7. **Req 3 — Conquistas por Destino via GPS**.
8. **Req 1/2 — Importação e curadoria de trilhas/destinos** (maior, por último).

> Nota de continuidade entre sessões: o roadmap
> `docs/ROADMAP-FINALIZACAO-APP.md` recebe uma seção deste bloco com o status
> por frente. Cada frente concluída é marcada lá (data + resumo + migration).

---

## Frente A — Req 6: Trial de parceiro de 1 ano

### Situação atual
`fetchPartnerTrialStatus` (em `src/lib/api.ts`) calcula o trial por **cliques**
de contato, com `PARTNER_TRIAL_CLICK_THRESHOLD = 15`. O painel do parceiro
(`parceiro.painel.tsx`) mostra "faltam N cliques".

### Decisão de design
Trial passa a ser **por data**: 1 ano a partir do início. Fonte da data de
início, em ordem de precedência:
1. `profiles.trial_started_at` (coluna nova, nullable) quando presente;
2. fallback para `profiles.created_at` do parceiro (todo parceiro já tem).

Assim nenhum parceiro existente fica sem trial: quem não tem `trial_started_at`
usa a data de criação da conta. Novos parceiros podem ter `trial_started_at`
setado no momento em que viram parceiro (opcional; o fallback cobre).

### Modelo de dados (migration idempotente)
```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
```

### Lógica (função pura testável — `src/lib/partner-trial.ts`, nova)
```ts
export const TRIAL_DURATION_DAYS = 365;
export interface TrialStatus {
  trialActive: boolean;
  remainingDays: number;   // 0 quando expirado
  startedAt: string;       // ISO
  endsAt: string;          // ISO (startedAt + 365 dias)
}
export function computeTrialStatus(startedAtIso: string, nowMs: number): TrialStatus
```
- `endsAt = startedAt + 365 dias`.
- `trialActive = now < endsAt`.
- `remainingDays = max(0, ceil((endsAt - now)/dia))`.
- Nunca `NaN`; data inválida → trial inativo com `remainingDays = 0`.

### API / UI
- `fetchPartnerTrialStatus` reescrita para usar `computeTrialStatus`
  (`trial_started_at ?? created_at`). Mantém a mesma forma de retorno usada
  pelo painel, adicionando `remainingDays`/`endsAt`; o campo antigo de cliques
  deixa de ser o gatilho (pode continuar exposto como métrica informativa).
- `parceiro.painel.tsx`: banner do trial passa a exibir "N dias restantes" /
  "Trial encerrado", com barra de progresso por tempo decorrido no ano.

### Correctness properties (fast-check)
- P1: para qualquer `startedAt` válido e `now < startedAt+365d` → `trialActive=true`.
- P2: `now >= startedAt+365d` → `trialActive=false` e `remainingDays=0`.
- P3: `remainingDays` é inteiro em `[0, 366]`, monotonicamente decrescente no tempo.
- P4: entrada inválida (data não-parseável) nunca produz `NaN`/`Infinity`.

---

## Frente B — Req 7: Bug do deep link `/a/:id` 404 no nativo

### Diagnóstico
No app nativo (Capacitor SPA), o WebView serve arquivos de `dist/native-spa`.
Ao abrir `/a/:id` via App Link/intent, o `entry-native` monta o router, mas o
`appUrlOpen` em `useDeepLinkNavigation` (`__root.tsx`) hoje trata `/a/:id`
apenas dentro do bloco de auth/hash e do `catch` (intent scheme). O 404 ocorre
quando o WebView tenta resolver a URL como recurso antes do router assumir, ou
quando a navegação inicial cai no `NotFoundComponent` antes do `appUrlOpen`
disparar. O print confirma: `404 Página não encontrada`.

### Decisão de design
1. **Garantir o roteamento interno**: no `useDeepLinkNavigation`, tratar o
   padrão `/a/:id` **fora** do bloco de auth (é o caminho mais comum),
   navegando para `/a/$activityId` (a rota de preview já existe e funciona no
   navegador) — não para `/atividade/$activityId` diretamente, preservando o
   comportamento de preview. A rota `/a/$activityId` já resolve a atividade
   pública por RLS (status completed) — o mesmo componente serve nativo e web.
2. **Fallback**: se o parsing via `new URL()` falhar (intent scheme), o `catch`
   já cobre `outlife://atividade/:id`; adicionar cobertura para `/a/:id` no
   catch também.
3. **Cold start**: quando o app abre já na URL `/a/:id` (não via `appUrlOpen`,
   mas como rota inicial do WebView), garantir que a rota exista no
   `routeTree` (existe) e que o `NotFoundComponent` não capture antes. Como o
   SPA nativo usa `createMemoryHistory`/hash, validar a `initialEntries`.

O componente `a.$activityId.tsx` **não muda** de lógica de dados (Req 7.1/7.2
já cobertos: mostra "não encontrada" para id inexistente/não-completed). A
correção é de **roteamento/navegação**, não de dados.

### Correctness properties
- P1: para um `activityId` bem-formado, a função pura de extração de rota a
  partir de uma URL `/a/<id>` retorna `{ to: "/a/$activityId", params:{ activityId:id } }`.
- P2: URLs de auth (com `access_token`) nunca são roteadas como atividade.
- P3: id inexistente → tela "atividade não encontrada" (não 404).

> Extrair a lógica de "URL → destino de rota" para uma função pura
> `parseDeepLink(url)` em `src/lib/deep-link.ts` (nova) para testar sem DOM.

---

## Frente C — Req 9: Comentários — respostas, curtidas e exclusão

### Situação atual
`post_comments` (colunas: id, post_id, author_id, text, created_at). RPC
`create_post_comment` incrementa `community_posts.comments_count`. Sem threads,
sem curtir comentário.

### Modelo de dados (migration idempotente)
```sql
-- Threads: comentário-pai (nullable = comentário raiz)
ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id UUID
  REFERENCES public.post_comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS post_comments_parent_idx
  ON public.post_comments(parent_comment_id);

-- Curtidas de comentário/resposta (idempotente por usuário)
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- Contador desnormalizado opcional em post_comments
ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;
```

### RLS
```sql
-- comment_likes: qualquer autenticado curte/descurte o SEU; leitura pública
CREATE POLICY "read comment_likes" ON public.comment_likes FOR SELECT USING (true);
CREATE POLICY "insert own comment_like" ON public.comment_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own comment_like" ON public.comment_likes FOR DELETE
  USING (auth.uid() = user_id);

-- post_comments: excluir o próprio OU admin (estende a policy existente)
DROP POLICY IF EXISTS "delete own or admin comment" ON public.post_comments;
CREATE POLICY "delete own or admin comment" ON public.post_comments FOR DELETE
  USING (auth.uid() = author_id OR public.is_admin(auth.uid()));
```

### RPCs (SECURITY DEFINER) — contadores atômicos
- `toggle_comment_like(_comment_id)`: insere ou remove o like do `auth.uid()`
  (idempotente por UNIQUE) e ajusta `likes_count` via `increment/decrement`;
  retorna o novo estado `{ liked, likes_count }`.
- `create_post_comment(_post_id, _text, _parent_comment_id?)`: estende a RPC
  existente para aceitar `parent_comment_id`; incrementa `comments_count` do
  post (respostas contam como comentário do post — decisão: sim, para o
  contador refletir toda a conversa).
- Exclusão: `delete_post_comment(_comment_id)` (SECURITY DEFINER) valida
  `author_id = auth.uid() OR is_admin`, apaga o comentário (cascata remove
  replies + likes), e decrementa `comments_count` pelo total removido
  (comentário + N replies). Camada de app: `deleteComment` em `api.ts` também
  checa autoria/admin antes de chamar (Req 9.7 — dupla camada).

### API (`src/lib/api.ts`)
- `fetchPostComments(postId)`: retorna comentários raiz + replies aninhados
  (`author:profiles!post_comments_author_id_fkey`), `likes_count`, e
  `liked_by_me` (via join com `comment_likes` do usuário logado).
- `replyToComment(postId, parentId, text)`, `toggleCommentLike(commentId)`,
  `deleteComment(commentId)`.

### UI (`comunidade.tsx`)
- Cada comentário mostra: avatar, nome, texto, botão curtir (coração + contagem),
  botão "Responder", e (se autor/admin) excluir.
- Replies indentados sob o pai (estilo Instagram), com "ver N respostas".
- Curtir é otimista com rollback em erro.

### Correctness properties
- P1: curtir 2× o mesmo comentário pelo mesmo usuário → `likes_count` líquido 0
  (idempotente).
- P2: excluir comentário-pai remove todas as replies e likes (cascata) e
  decrementa `comments_count` pelo total removido.
- P3: `comments_count` do post = número de linhas em `post_comments` daquele
  post, após qualquer sequência de criar/responder/excluir.
- P4: não-autor não-admin nunca consegue excluir (RLS + app).

---

## Frente D — Req 5: Catálogo de tipos de atividade

### Situação atual
`activity_type` é um enum fixo por CHECK em `user_activities`
(`caminhada|pedalada|trilha|outro`); `ACTIVITY_TYPES` hardcoded no front;
`computeActivityMetrics` decide pace só para caminhada/pedalada.

### Decisão de design (migração do enum → catálogo sem quebrar dados)
- Nova tabela `activity_types` como **fonte dos tipos oferecidos no
  rastreamento**. `user_activities.activity_type` **continua sendo TEXT** (não
  vira FK rígida) — assim atividades antigas não quebram. O catálogo usa `code`
  igual ao valor gravado hoje (caminhada/pedalada/trilha/outro) + novos.
- **CHECK constraint** de `user_activities.activity_type` é **relaxado/removido**
  (troca por validação na aplicação contra o catálogo), para permitir novos
  codes sem migration a cada tipo novo. Migration verifica e dropa o CHECK
  antigo se existir (idempotente, dentro de `DO $$`).

### Modelo de dados
```sql
CREATE TABLE IF NOT EXISTS public.activity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,          -- ex.: 'corrida','caminhada','natacao'
  name TEXT NOT NULL,                 -- rótulo exibido
  icon_key TEXT NOT NULL,             -- chave no Icon_Model_Set
  metric_form TEXT NOT NULL
    CHECK (metric_form IN ('pace_km','speed_elevation','pace_100m')),
  active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_types ENABLE ROW LEVEL SECURITY;
-- leitura pública (o rastreamento lista os ativos); escrita só admin
CREATE POLICY "read activity_types" ON public.activity_types FOR SELECT USING (true);
CREATE POLICY "admin write activity_types" ON public.activity_types FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
```
Seed inicial (idempotente, `ON CONFLICT (code) DO NOTHING`): corrida
(pace_km), caminhada (pace_km), trilha (speed_elevation), pedalada
(speed_elevation), natacao (pace_100m), remo (speed_elevation), escalada
(speed_elevation). Mantém os 4 codes atuais para compatibilidade.

### Icon_Model_Set
Conjunto fixo de ícones no front (`src/lib/activity-icons.ts`, novo), mapeando
`icon_key → componente lucide-react` (Footprints=caminhada, Running/PersonRunning
via lucide (`Zap`/`Rabbit` como fallback), Bike=pedalada, Mountain=trilha,
Waves=natação, Sailboat/Ship=remo, MountainSnow=escalada). Usar ícones
existentes do lucide-react para não adicionar assets. Cada `icon_key` tem
também uma cor. Um helper `getActivityIcon(iconKey)` centraliza.

### Metric_Form — módulo puro (estende `activity-metrics.ts`)
Novo `src/lib/metric-forms.ts`:
```ts
export type MetricForm = 'pace_km' | 'speed_elevation' | 'pace_100m';
export interface MetricInput { distanceMeters:number; durationSeconds:number; elevationGain?:number; }
export interface MetricOutput {
  primary: { label:string; value:string } | null;   // ex. pace 5:49/km
  secondary?: { label:string; value:string } | null; // ex. elevação 479 m
  speedKmh: string | null;
}
export function computeByMetricForm(form: MetricForm, input: MetricInput): MetricOutput
```
- `pace_km`: primary = pace min/km; speed também.
- `speed_elevation`: primary = velocidade km/h; secondary = ganho de elevação m.
- `pace_100m`: primary = pace por 100 m (natação); usa distância/tempo.
- `computeActivityMetrics` atual é preservada (retrocompat) e pode delegar a
  `computeByMetricForm` internamente.

### API / UI
- `fetchActivityTypes()` (ativos, ordenados por position) — usado no
  rastreamento; `admin*ActivityType` (create/update/delete/reorder) só admin.
- Tela `/admin/atividades`: CRUD + seletor de ícone (grid do Icon_Model_Set) +
  seletor de metric_form + reorder (drag simples ou botões sobe/desce) +
  toggle active. Padrão visual das outras telas admin.
- `atividade.rastrear.tsx`: o seletor de tipo passa a vir de
  `fetchActivityTypes()` (fallback ao enum fixo se a query ainda não carregou).
- Card no hub admin.

### Correctness properties
- P1: cada MetricForm nunca retorna `NaN`/`Infinity`; duração 0 → tudo `null`.
- P2: `pace_100m` com 100 m em 120 s → "2:00/100m".
- P3: `speed_elevation` sempre traz `secondary` de elevação (0 m quando ausente).
- P4: seed é idempotente (rodar 2× não duplica codes).

---

## Frente E — Req 8: Banners de compartilhamento OUTVITAR

### Situação atual
`banner-generator.ts` gera banner de atividade (mapa/fallback + distância +
duração + velocidade/pace) e de post. Sem ícone da atividade, sem marca, sem
descrição, sem variação por metric_form; sem variantes foto/vídeo explícitas.

### Decisão de design (estende `banner-generator.ts`)
Ampliar `ActivityBannerInput`:
```ts
export type ActivityBannerInput = {
  variant: 'photo' | 'map' | 'video_poster';
  backgroundUrl?: string | null;      // foto, mapSnapshot, ou poster do vídeo
  iconKey: string;                    // ícone da atividade (desenhado no canvas)
  activityName: string;               // ex. "Corrida"
  description?: string | null;        // do usuário; senão Default_Description
  metrics: Array<{ label:string; value:string }>; // já resolvidas por metric_form
};
```
- **Marca**: desenhar "OUTVITAR" (bold) no canto superior direito, no lugar de
  onde o Strava põe a marca.
- **Ícone**: desenhar o Activity_Icon no canto superior esquerdo. Como o canvas
  não renderiza componente React, converter o ícone lucide para um path/imagem:
  usar um pequeno conjunto de PNGs dos ícones (gerados uma vez) OU desenhar via
  `Path2D` a partir do SVG do lucide. Decisão: **PNGs** dos ícones no
  `public/activity-icons/<icon_key>.png` (branco, com sombra), carregados via
  `loadImageElement` — simples e confiável no canvas.
- **Descrição**: `description || Default_Description` (i18n
  `activity.bannerDefaultDescription`, ex.: "Mais uma aventura no OutVitar 🌿").
- **Métricas por metric_form**: o chamador (`atividade.$activityId.tsx`) resolve
  via `computeByMetricForm` e passa `metrics[]` já rotuladas (distância + as do
  form). O banner só desenha o que recebe (mantém o gerador burro/testável).
- **Variantes**:
  - `photo`: fundo = foto do usuário (`image_url`).
  - `map`: fundo = `map_snapshot_url` (trajeto) — comportamento atual.
  - `video_poster`: vídeo real no canvas é inviável de exportar como imagem;
    **decisão documentada**: para vídeo, gera-se um banner estático sobre o
    **poster** (primeiro frame / `map_snapshot` / foto) com as mesmas camadas, e
    o compartilhamento do vídeo em si segue o fluxo de mídia já existente. Ou
    seja, o "banner de vídeo" é a arte estática que acompanha; o vídeo é
    compartilhado à parte. Isso evita transcodificação client-side (lição do
    Bloco B — mídia pesada estoura memória).
- **UI** (`atividade.$activityId.tsx`): seletor de variante (Foto / Mapa) quando
  houver foto e/ou mapa; usa `computeByMetricForm` do Req 5 para montar as
  métricas conforme o tipo. Mantém timeout/erro tipado (`BannerTimeoutError`).

### Correctness properties
- P1: o banner sempre inclui a marca "OUTVITAR" e o ícone (quando `iconKey`
  resolve um PNG existente; se faltar, desenha sem ícone, nunca lança).
- P2: descrição vazia/whitespace → usa Default_Description.
- P3: `metrics` vazio nunca quebra (desenha só marca+ícone+descrição).
- P4: timeout/erro de imagem → rejeita (nunca blob incompleto) — preservado.

---

## Frente F — Req 4: Sugestões de amizade

### Modelo / RPC (SECURITY DEFINER)
Sem tabela nova. RPC `suggest_friends(_limit int default 20)`:
```sql
RETURNS TABLE(id uuid, full_name text, username text, avatar_url text, reason text)
```
Regras (excluindo self e quem já tem qualquer linha em `user_friends` com o
usuário, em qualquer status/direção):
1. **Amigos-de-amigos**: usuários seguidos/aceitos pelos amigos do usuário.
2. **Atividades em comum**: usuários com `user_activities.activity_type` em
   comum com o usuário (completed).
Ordena por `reason` (amigo-de-amigo primeiro) e limita. `reason` alimenta um
rótulo ("Amigo de X", "Também faz trilha"). Só campos públicos.

### API / UI
- `fetchFriendSuggestions(limit)` em `api.ts`.
- Seção "Sugestões para você" em `/amigos` (topo), com botão Adicionar/Seguir
  que chama o fluxo existente e remove o item da lista (otimista).
- Placeholder para nome/avatar ausentes (avatar fallback, "Aventureiro").

### Correctness properties
- P1: a lista nunca inclui o próprio usuário.
- P2: a lista nunca inclui alguém com friendship existente (qualquer status).
- P3: sem duplicatas (um usuário aparece uma vez, mesmo se casar em 2 regras).

---

## Frente G — Req 3: Conquistas por Destino via GPS

### Situação atual
Existe `achievement_records` + view `user_achievement_stats` +
`grant_pending_achievements` (SECURITY DEFINER). `destinations` tem
coordenadas; `user_activities` tem `route_geojson`/posição.

### Design
- **Função pura** `src/lib/haversine.ts` (já existe conforme steering) reutilizada;
  `gpsProximity(pointLat, pointLng, destLat, destLng, radiusM)` → boolean.
  Se não existir helper de proximidade, criar `isWithinRadius` puro (testável).
- **RPC** `register_destination_visits(_activity_id)` (SECURITY DEFINER),
  chamada no finish da atividade (ou em trigger AFTER UPDATE quando status vira
  completed): pega a rota da atividade, cruza com `destinations` (aproximação:
  usa o ponto inicial/mais próximo; raio configurável ex. 500 m), grava em uma
  tabela `user_destination_visits (user_id, destination_id, activity_id,
  visited_at, UNIQUE(user_id,destination_id))` — 1 destino distinto por usuário.
- **Conquistas**: registros em `achievement_records` com keys
  `destinos_1`, `destinos_5`, `destinos_10`. Uma função
  `grant_destination_achievements(_user_id)` conta destinos distintos visitados
  e concede as conquistas atingidas (idempotente — no máx. 1×, Req 3.4/3.6).
- **Exibição**: já há grid de conquistas no perfil; adicionar os ícones/labels
  das novas keys no `achievementIconMap` (MapPin/Award).

### Modelo de dados
```sql
CREATE TABLE IF NOT EXISTS public.user_destination_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  destination_id UUID NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES public.user_activities(id) ON DELETE SET NULL,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, destination_id)
);
ALTER TABLE public.user_destination_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own visits" ON public.user_destination_visits FOR SELECT
  USING (auth.uid() = user_id);
-- escrita só via RPC SECURITY DEFINER (sem policy de INSERT para cliente)
```

### Correctness properties
- P1: `isWithinRadius` simétrico e coerente (ponto no centro → dentro; além do
  raio → fora); nunca `NaN`.
- P2: visitar o mesmo destino 2× não duplica linha (UNIQUE) nem concede a
  conquista 2×.
- P3: atingir 5 destinos concede `destinos_1` e `destinos_5` (todas as faixas
  ≤ contagem), cada uma no máximo uma vez.

---

## Frente H — Req 1/2: Importação e curadoria de trilhas/destinos

### Modelo de dados
```sql
CREATE TABLE IF NOT EXISTS public.imported_trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_source TEXT NOT NULL CHECK (external_source IN ('osm','icmbio')),
  external_id TEXT NOT NULL,          -- id na origem (osm relation/way id; ibge/cnuc)
  name TEXT NOT NULL,
  description TEXT,
  region TEXT,                        -- rótulo da Import_Region
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  geojson JSONB,                      -- trajeto/polígono quando disponível
  license TEXT,                       -- 'ODbL' para osm
  attribution TEXT,                   -- '© OpenStreetMap contributors' para osm
  visible BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (external_source, external_id)
);
ALTER TABLE public.imported_trails ENABLE ROW LEVEL SECURITY;
-- usuário vê só visíveis; admin vê tudo
CREATE POLICY "read visible or admin" ON public.imported_trails FOR SELECT
  USING (visible = true OR public.is_admin(auth.uid()));
CREATE POLICY "admin write imported_trails" ON public.imported_trails FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
```

### Importação
- **Script Node** `scripts/import-trails.mjs` (rodado pelo agente com
  `SUPABASE_DB_URL`): recebe fonte + região (bbox), consulta:
  - **OSM/Overpass**: `[out:json]; (relation["route"="hiking"](bbox); way["highway"="path"](bbox);); out center tags;` — mapeia cada resultado para `imported_trails` com `license='ODbL'`, `attribution='© OpenStreetMap contributors'`, `visible=false`, upsert por `(external_source, external_id)`.
  - **ICMBio/CNUC**: dataset GeoJSON de unidades de conservação (download por UF) → nome, centro, `external_source='icmbio'`.
- Idempotente: upsert por `onConflict: 'external_source,external_id'`.
- **Tela admin** `/admin/trilhas`: lista (nome, fonte, atribuição, toggle
  visível), busca, e um botão "Importar por região" que — para v1 —
  documenta/dispara o script (a importação em lote roda server-side/local, não
  no device). O admin foca na **curadoria** (liberar/ocultar).
- **Exibição ao usuário**: itens `visible=true` aparecem em Explorar como uma
  seção "Trilhas" (ou integrados à listagem de destinos). A atribuição OSM é
  exibida no rodapé da listagem/detalhe quando houver item `osm`.

### Correctness properties
- P1: upsert não duplica `(external_source, external_id)`.
- P2: todo item `osm` tem `attribution` e `license='ODbL'`.
- P3: item recém-importado nasce `visible=false`.
- P4: falha na busca externa não altera itens existentes.

---

## Estratégia de testes (global)

- **Lógica pura** (Vitest + fast-check): `partner-trial.ts`, `deep-link.ts`,
  `metric-forms.ts`, proximidade GPS, truncamento/idempotência de curtidas.
- **Migrações**: aplicadas em produção via `run-one-migration.mjs`, testadas
  rodando 2× (idempotência) contra o banco.
- **Build/APK**: `npm run build:native` → `npx cap sync android` →
  `assembleDebug` a cada frente concluída. `tsc --noEmit` só com os 6 erros
  pré-existentes de `use-local-push.ts`.
- **i18n**: chaves novas em pt-BR e en, validadas com `JSON.parse`.

## Rastreabilidade requisito → frente

| Requisito | Frente | Migration nova |
|---|---|---|
| Req 6 (trial 1 ano) | A | `profiles.trial_started_at` |
| Req 7 (deep link 404) | B | — (só front) |
| Req 9 (comentários) | C | `post_comments.parent_comment_id` + `comment_likes` |
| Req 5 (catálogo atividade) | D | `activity_types` + relax CHECK |
| Req 8 (banners) | E | — (front + PNGs de ícones) |
| Req 4 (sugestões amizade) | F | RPC `suggest_friends` |
| Req 3 (conquistas destino) | G | `user_destination_visits` + RPCs |
| Req 1/2 (importação) | H | `imported_trails` + script import |

---

## Architecture

A arquitetura reaproveita integralmente a stack e os padrões já em produção;
cada frente é um incremento isolado. Camadas envolvidas:

- **Banco (Supabase/Postgres)**: tabelas novas e colunas aditivas, sempre com
  RLS. Escrita administrativa por `public.is_admin(auth.uid())`; leitura
  cruzada entre usuários por RPC `SECURITY DEFINER`. Migrações idempotentes
  aplicadas via `scripts/run-one-migration.mjs`.
- **Endpoints server-side (Vercel, `src/routes/api.*`)**: usados apenas onde há
  I/O externo (importação OSM/ICMBio da Frente H) ou envio de push. No app
  nativo, chamados pela URL absoluta `https://outlife-app.vercel.app`.
- **Front (React 19 + TanStack Router)**: telas admin novas seguem o padrão
  `isCurrentUserAdmin` + `bg-gradient-forest` + cards; lógica de cálculo em
  módulos puros testáveis (`src/lib/*`). Rotas novas regeneram
  `routeTree.gen.ts` no `build:native`.
- **Nativo (Capacitor)**: deep link resolvido pelo roteador interno
  (Frente B); nenhuma dependência de servidor externo para navegar.

Mapa frente → camadas:

| Frente | Banco | Server (Vercel) | Front |
|---|---|---|---|
| A (trial) | coluna | — | painel parceiro |
| B (deep link) | — | — | roteamento nativo |
| C (comentários) | tabelas/RPC | — | comunidade |
| D (catálogo atividade) | tabela/RLS | — | admin + rastreamento |
| E (banners) | — | — | banner-generator + detalhe |
| F (sugestões) | RPC | — | tela amigos |
| G (conquistas GPS) | tabela/RPC | — | perfil |
| H (importação) | tabela/RLS | script Node | admin trilhas |

Detalhamento por frente: ver seções "Frente A" … "Frente H" acima
(Overview), que descrevem a decisão de design de cada requisito.

## Data Models

Resumo das mudanças de schema (todas idempotentes; SQL completo em cada Frente):

- **Frente A**: `profiles.trial_started_at TIMESTAMPTZ` (nullable).
- **Frente C**: `post_comments.parent_comment_id UUID` (self-FK, cascade),
  `post_comments.likes_count INTEGER DEFAULT 0`, tabela `comment_likes`
  (`comment_id`, `user_id`, `UNIQUE(comment_id,user_id)`), RLS.
- **Frente D**: tabela `activity_types` (`code UNIQUE`, `name`, `icon_key`,
  `metric_form CHECK`, `active`, `position`), RLS; relaxamento do CHECK de
  `user_activities.activity_type` (permanece TEXT); seed idempotente.
- **Frente F**: sem tabela; RPC `suggest_friends`.
- **Frente G**: tabela `user_destination_visits`
  (`UNIQUE(user_id,destination_id)`), RLS; keys de conquista `destinos_1/5/10`
  em `achievement_records`; RPCs `register_destination_visits`,
  `grant_destination_achievements`.
- **Frente H**: tabela `imported_trails`
  (`UNIQUE(external_source,external_id)`, `visible`, `license`, `attribution`),
  RLS.

As definições SQL completas de cada tabela/coluna/policy estão nas seções de
Frente correspondentes (A, C, D, G, H).

## Components and Interfaces

### Módulos puros novos (`src/lib/`)
- `partner-trial.ts` — `computeTrialStatus(startedAtIso, nowMs)` (Frente A).
- `deep-link.ts` — `parseDeepLink(url)` → destino de rota (Frente B).
- `metric-forms.ts` — `computeByMetricForm(form, input)` (Frente D).
- `activity-icons.ts` — `getActivityIcon(iconKey)` (Frentes D/E).
- proximidade GPS — `isWithinRadius(...)` (reutiliza/estende `haversine.ts`) (Frente G).

### Funções de API novas (`src/lib/api.ts`)
- Trial: `fetchPartnerTrialStatus` (reescrita).
- Comentários: `fetchPostComments`, `replyToComment`, `toggleCommentLike`,
  `deleteComment`.
- Catálogo: `fetchActivityTypes`, `adminCreate/Update/Delete/ReorderActivityType`.
- Sugestões: `fetchFriendSuggestions`.
- Conquistas: chamada de `register_destination_visits` no finish.
- Trilhas: `fetchImportedTrails`, `setTrailVisibility`, `fetchVisibleTrails`.

### RPCs (SECURITY DEFINER) novas/estendidas
- `create_post_comment(_post_id,_text,_parent_comment_id?)` (estendida),
  `toggle_comment_like(_comment_id)`, `delete_post_comment(_comment_id)`.
- `suggest_friends(_limit)`.
- `register_destination_visits(_activity_id)`, `grant_destination_achievements(_user_id)`.

### Rotas novas (front)
- `/admin/atividades` (Frente D), `/admin/trilhas` (Frente H).
- Reuso: `/amigos` (Frente F), `/perfil` (Frente G), `/atividade/$activityId`
  e `/a/$activityId` (Frentes B/E), `comunidade` (Frente C),
  `parceiro/painel` (Frente A).

### Endpoints/scripts server-side
- `scripts/import-trails.mjs` (Node, rodado pelo agente) — Overpass/ICMBio →
  upsert em `imported_trails` (Frente H).

## Correctness Properties

Propriedades para testes baseados em propriedade (fast-check). Detalhe por
frente nas seções de Frente acima.

### Property 1: Trial (Frente A)
Para qualquer `startedAt` válido, se `now < startedAt+365d` então
`trialActive=true`; se `now >= startedAt+365d` então `trialActive=false` e
`remainingDays=0`. `remainingDays` é inteiro em `[0,366]`, decrescente no
tempo; entrada inválida nunca produz `NaN`/`Infinity`.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

### Property 2: Deep link (Frente B)
`parseDeepLink` de uma URL `/a/<id>` bem-formada retorna a rota de atividade;
URLs de auth (com `access_token`) nunca são roteadas como atividade; id
inexistente/não-completed leva à tela "atividade não encontrada", nunca a 404.

**Validates: Requirements 7.1, 7.2, 7.4, 7.5**

### Property 3: Comentários (Frente C)
Curtir 2× o mesmo comentário pelo mesmo usuário resulta em contagem líquida 0
(idempotente por UNIQUE); excluir um comentário-pai remove todas as replies e
likes (cascata) e decrementa `comments_count` pelo total removido;
`comments_count` do post é sempre igual ao número de linhas de `post_comments`
daquele post após qualquer sequência de operações.

**Validates: Requirements 9.3, 9.4, 9.5, 9.8**

### Property 4: Métricas (Frente D)
`computeByMetricForm` nunca retorna `NaN`/`Infinity`; duração 0 → todos os
campos `null`; `pace_100m` de 100 m em 120 s = "2:00/100m"; `speed_elevation`
sempre traz `secondary` de elevação (0 m quando ausente); o seed de
`activity_types` é idempotente.

**Validates: Requirements 5.4, 5.6**

### Property 5: Banners (Frente E)
O banner sempre inclui a marca "OUTVITAR"; descrição vazia/whitespace usa a
Default_Description; `metrics` vazio não quebra a geração; timeout ou erro de
imagem rejeita a promessa (nunca resolve com blob incompleto).

**Validates: Requirements 8.2, 8.4, 8.5, 8.9**

### Property 6: Sugestões (Frente F)
A lista de sugestões nunca inclui o próprio usuário, nunca inclui alguém com
friendship existente em qualquer status, e não contém duplicatas.

**Validates: Requirements 4.2, 4.3, 4.5**

### Property 7: Conquistas GPS (Frente G)
`isWithinRadius` é coerente (ponto no centro → dentro; além do raio → fora) e
nunca retorna `NaN`; visitar o mesmo destino 2× não duplica linha nem concede a
conquista 2×; atingir N destinos concede todas as faixas com limite ≤ N, cada
uma no máximo uma vez.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 8: Importação (Frente H)
O upsert nunca duplica `(external_source, external_id)`; todo item `osm` tem
`attribution` e `license='ODbL'`; item recém-importado nasce `visible=false`;
falha na busca externa não altera nenhum `imported_trail` existente.

**Validates: Requirements 2.2, 2.3, 2.4, 2.6, 2.7**

## Error Handling

- **Migrações**: idempotentes; rodar 2× não falha nem duplica. FKs em
  `try/catch` individual quando aplicável (Postgres não tem
  `ADD CONSTRAINT IF NOT EXISTS`).
- **RPCs SECURITY DEFINER**: validam autorização explícita (`is_admin`/autoria)
  e usam `SET search_path = public`; erros previstos retornam mensagem tratada,
  nunca vazam dados de outra empresa/usuário.
- **Importação externa (H)**: falha de rede/API preserva os `imported_trails`
  existentes (Req 2.6) e reporta erro ao admin (Req 2.5).
- **Banners (E)**: mantém `BannerTimeoutError` e propagação de erro de
  renderização — nunca compartilha imagem incompleta (Req 8.9).
- **Deep link (B)**: id inexistente/não-completed → tela "não encontrada"
  (Req 7.2); fallback para roteamento externo se o interno falhar (Req 7.5).
- **Curtidas/exclusão (C)**: UI otimista com rollback; RLS + checagem de app
  como dupla camada (Req 9.7).

## Testing Strategy

- **Unit/PBT (Vitest + fast-check)** para todos os módulos puros novos:
  `partner-trial`, `deep-link`, `metric-forms`, proximidade GPS, e as
  propriedades de idempotência de curtidas/contadores (lógica extraída pura
  quando possível).
- **Migrações**: aplicar em produção via `run-one-migration.mjs` e rodar 2×
  para confirmar idempotência; verificar objetos criados com script de
  verificação (padrão `verify-all-objects.mjs`).
- **Verificação de build a cada frente**: `npx tsc --noEmit` (só os 6 erros
  pré-existentes de `use-local-push.ts`), `npm run build:native`,
  `npx cap sync android`, `assembleDebug` → APK; commit + push na `main`.
- **i18n**: chaves novas em pt-BR e en, validadas com `JSON.parse`.
- **Regressão manual guiada**: cada frente tem um roteiro curto de teste no
  aparelho (instalar APK, cenário feliz + borda), registrado no roadmap.
