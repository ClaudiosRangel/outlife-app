# Verificação de Terreno — Tarefa 1.1

> Notas de confirmação de contratos reais no código, produzidas ANTES de
> qualquer alteração (tarefa 1.1 do plano). Esta é uma tarefa de leitura/
> verificação — nenhum código de produção foi alterado.
>
> Fonte da verdade lida diretamente do repositório `c:\Source\OutLife`.
> Data da verificação: registrada junto ao commit desta nota.

## 1. Colunas e índices de `public.user_activities`

Arquivo de criação: `supabase/migrations/20260522214044_1d0f0a86-de8c-4884-a2e7-63c5e3510dde.sql`

Colunas na criação (confirmadas):

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | `UUID` PK `DEFAULT gen_random_uuid()` | |
| `user_id` | `UUID NOT NULL` | **sem FK explícita para profiles/auth.users nesta migração** |
| `destination_id` | `UUID` FK → `destinations(id)` ON DELETE SET NULL | |
| `start_time` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | confirmado (nome exato) |
| `end_time` | `TIMESTAMPTZ` (nullable) | confirmado (nome exato) |
| `duration_seconds` | `INTEGER` | |
| `distance_meters` | `NUMERIC` | |
| `route` | `GEOGRAPHY(LineString, 4326)` | |
| `route_geojson` | `JSONB` | |
| `status` | `TEXT NOT NULL DEFAULT 'in_progress'` | CHECK original `IN ('in_progress','completed')` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |

`activity_type` **NÃO existe na criação** — foi adicionado depois em
`supabase/migrations/20260721000000_activity-type-and-map-snapshot.sql`:

- `ALTER TABLE public.user_activities ADD COLUMN IF NOT EXISTS activity_type TEXT`
  (nullable) `+ map_snapshot_url TEXT`.
- CHECK: `activity_type IS NULL OR activity_type IN ('caminhada','pedalada','trilha','outro')`.

Confirmação do design (nomes exatos): `user_id`, `status`, `activity_type`,
`start_time`, `end_time` — **todos confirmados**.

### Índice por `(user_id, status)` — NÃO existe

O único índice relevante criado é:

```sql
CREATE INDEX user_activities_user_start_idx
  ON public.user_activities (user_id, start_time DESC);
```

Não há índice `(user_id, status)`. A função `live_activity_type` (tarefa 2.1)
filtra por `user_id = _user_id AND status = 'in_progress'` e ordena por
`start_time DESC LIMIT 1`. O índice existente `(user_id, start_time DESC)`
**já atende razoavelmente** essa consulta (o `status = 'in_progress'` filtra
poucas linhas por usuário). O índice parcial opcional sugerido pelo design
(`idx_user_activities_user_status ... WHERE status = 'in_progress'`) continua
sendo um bom reforço, mas **não é obrigatório** — decisão delegada à tarefa 2.2.

> Observação: o CHECK de `status` na criação é `('in_progress','completed')`.
> O design menciona uma migração `20260715160200` adicionando `scheduled` ao
> CHECK. Isso não afeta a tarefa 1.1 (a função só busca `in_progress`), mas
> vale confirmar na tarefa 2.x se o valor `scheduled` de fato existe — não foi
> necessário para esta verificação.

## 2. Assinaturas e tipos em `src/lib/api.ts` (arquivo único)

Confirmado que `@/lib/api` é um **arquivo único grande** (`src/lib/api.ts`),
não um barrel de pasta. Todas as assinaturas/tipos citados existem:

```ts
// ~linha 529
export type ActivityType = "caminhada" | "pedalada" | "trilha" | "outro";

// ~linha 531
export type UserActivity = {
  id: string;
  user_id: string;
  destination_id: string | null;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  route_geojson: GeoJSON.LineString | null;
  status: "in_progress" | "completed";
  description: string | null;
  image_url: string | null;
  activity_type: ActivityType | null;
  map_snapshot_url: string | null;
  elevation_gain: number | null;
};

// ~linha 1126
export type LocationSharingMode = "none" | "friends" | "public";

// ~linha 1128
export type SharedLocation = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  latitude: number;
  longitude: number;
  location_updated_at: string;
  location_sharing_mode: LocationSharingMode;
};

// ~linha 1144
export async function updateMyLocation(input: {
  latitude: number;
  longitude: number;
  mode: LocationSharingMode;
}): Promise<void>; // grava profiles.{latitude,longitude,location_sharing_mode,location_updated_at}

// ~linha 1164
export async function updateLocationSharingMode(mode: LocationSharingMode): Promise<void>;
// mode === 'none' zera latitude/longitude/location_updated_at (revogação — Req 5.5)

// ~linha 1180
export async function fetchSharedUserLocations(): Promise<SharedLocation[]>;
// SELECT em "public_user_locations", filtra r.id !== myId, converte lat/lng para Number
```

### Divergência menor a registrar (não bloqueia)

O design afirmava "`updateMyLocation` já grava `location_updated_at = now()`
**no servidor**". Na verdade, o `location_updated_at` é gravado **no cliente**
com `new Date().toISOString()`:

```ts
.update({
  latitude: input.latitude,
  longitude: input.longitude,
  location_sharing_mode: input.mode,
  location_updated_at: new Date().toISOString(),  // relógio do CLIENTE
})
```

Implicações para a feature:
- O Req 2.4 (`location_updated_at` = instante da nova posição) segue atendido
  — a escrita ocorre a cada publicação, como o design assume.
- Atenção: a VIEW compara `location_updated_at > now() - interval '120 seconds'`
  usando o **relógio do servidor Postgres**, enquanto o valor gravado vem do
  **relógio do cliente**. Se o relógio do dispositivo estiver adiantado/
  atrasado, a janela de 120s (`is_live`) pode divergir. Isso não é regressão
  desta feature (comportamento pré-existente), mas o teste de integração da
  VIEW (tarefa 2.3) e a lógica pura `deriveIsLive` (tarefa 4.1, com `nowMs`
  injetado) devem ter isso em mente. Não requer ação na tarefa 1.1.

## 3. VIEW `public.public_user_locations` e função `are_friends`

Arquivo: `supabase/migrations/20260525181443_68fbc422-5893-41c1-a5e7-0a1d1a184d0f.sql`

Confirmado exatamente como o design descreve:

- `CREATE VIEW public.public_user_locations WITH (security_invoker=on)`.
- Filtros: `latitude/longitude/location_updated_at NOT NULL`,
  `location_updated_at > now() - interval '24 hours'`, e visibilidade
  `public` / (`friends` E `are_friends(auth.uid(), p.id)`) / `p.id = auth.uid()`.
- `GRANT SELECT ... TO anon, authenticated`.
- `public.are_friends(_a, _b)` é `LANGUAGE SQL STABLE SECURITY DEFINER
  SET search_path = public` — checa `user_friends.status = 'accepted'` nos
  dois sentidos. Este é o **padrão a seguir** para a nova função de vínculo.
- `location_sharing_mode` é um **ENUM** `public.location_sharing_mode
  ('none','friends','public')` (criado nessa mesma migração), coerente com o
  tipo TS `LocationSharingMode`.

## 4. Chave i18n `search.activeNow` — JÁ EXISTE (não precisa criar)

O i18n do OutLife **não** fica em `src/lib/i18n.ts` — usa i18next com arquivos
JSON em `public/locales/<lang>/translation.json`. A chave já está definida em
ambos os locales, dentro do namespace `search`:

- `public/locales/pt-BR/translation.json` → `search.activeNow` = "Amigos em atividade"
- `public/locales/en/translation.json` → `search.activeNow` = "Friends active now"

Já é consumida em `src/routes/busca.tsx` (`t("search.activeNow")`).

Conclusão: o fallback "criar a chave na tarefa 6" **não é necessário** — a
`LiveFriendsList` pode reaproveitar `t("search.activeNow")` diretamente como
título.

---

## DECISÃO DE RLS — JOIN direto vs `SECURITY DEFINER`

### Fato confirmado (RLS de SELECT em `user_activities`)

A migração de criação (`20260522214044_*.sql`) define **exatamente uma**
policy de SELECT para `user_activities`:

```sql
ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activities"
  ON public.user_activities FOR SELECT
  USING (auth.uid() = user_id);
```

Nenhuma outra policy de SELECT foi encontrada nas migrações posteriores
(`20260721000000_*` só faz ALTER de colunas e recria `finish_user_activity`;
não toca em policies de SELECT).

**Portanto: o observador NÃO pode ler linhas de `user_activities` de outros
usuários.** RLS permite apenas `auth.uid() = user_id` (as próprias linhas).

### Consequência para a VIEW `public_user_locations_live`

Como a VIEW será `WITH (security_invoker=on)` (exigência do Req 7.5), um
`JOIN`/`LEFT JOIN LATERAL` **direto** contra `user_activities` roda com as
permissões do OBSERVADOR. Sob a RLS acima, esse join retornaria `NULL` para as
atividades de qualquer amigo (só enxergaria as próprias) — o `activity_type`
viria sempre `NULL` e `is_live` sempre `false` para amigos, **quebrando o
Req 1.1**.

### DECISÃO: usar função `SECURITY DEFINER` (opção 2 do design) — CONFIRMADA

A decisão fica travada na **opção 2** do design: encapsular o vínculo numa
função `SECURITY DEFINER` (`public.live_activity_type(_user_id uuid)`), no
mesmo padrão já usado por `public.are_friends`. Motivos:

1. **É a única opção compatível com a RLS atual** sem ampliar a superfície de
   exposição de dados. A opção 1 (criar uma nova policy de SELECT ampla em
   `user_activities`) exporia linhas de atividade de outros usuários de forma
   mais abrangente que o necessário e é dispensável.
2. **Segue padrão existente e comprovado** no repositório (`are_friends` é
   `SECURITY DEFINER SET search_path = public`).
3. A função expõe **apenas** o `activity_type` da atividade `in_progress` mais
   recente — não vaza histórico, distância, rota nem qualquer outra coluna.
4. A visibilidade continua governada pela própria VIEW `security_invoker`
   (modo `public` / `friends` + `are_friends` / self) — a função de vínculo
   não decide visibilidade, só devolve o tipo de atividade quando existe uma
   `in_progress`. A combinação (VIEW security_invoker filtra QUEM aparece) +
   (função SECURITY DEFINER devolve o activity_type do vínculo) preserva a
   privacidade: um amigo só é exibido se passar pelo filtro de visibilidade da
   VIEW, e só então seu `activity_type`/`is_live` é resolvido.

Assinatura alvo (para a tarefa 2.1), idempotente:

```sql
CREATE OR REPLACE FUNCTION public.live_activity_type(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.activity_type
  FROM public.user_activities a
  WHERE a.user_id = _user_id
    AND a.status = 'in_progress'
  ORDER BY a.start_time DESC
  LIMIT 1;
$$;
```

> Esta nota substitui o "comentário no arquivo de migração" pedido pela
> tarefa 1.1, já que o arquivo de migração ainda não existe (será criado na
> tarefa 2.1). A tarefa 2.1 deve **repetir esta decisão como comentário** no
> cabeçalho do novo arquivo `.sql`.

---

## Resumo para as próximas tarefas

- **Tarefa 2.1** — criar `public.live_activity_type` como `SECURITY DEFINER`
  (decisão de RLS acima). Copiar o racional como comentário no `.sql`.
- **Tarefa 2.2** — VIEW `public_user_locations_live` `security_invoker=on`,
  superset de `public_user_locations` + `activity_type` (via
  `live_activity_type(p.id)`) + `is_live`. Índice parcial `(user_id, status)`
  é **opcional** (já há `(user_id, start_time DESC)`). Manter regras de 24h e
  visibilidade idênticas.
- **Tarefa 5.1** — `fetchLiveActivityFriends` faz SELECT em
  `public_user_locations_live` e mantém `r.id !== myId` (mesmo padrão de
  `fetchSharedUserLocations`).
- **Tarefa 6.1** — reaproveitar `t("search.activeNow")` como título
  (chave já existe em pt-BR e en; **não** criar).
- **Atenção transversal** — `location_updated_at` é gravado com relógio do
  CLIENTE em `updateMyLocation`, enquanto a janela de 120s é avaliada com o
  relógio do SERVIDOR na VIEW. Não é bug desta feature, mas manter em mente
  nos testes de integração (2.3) e na lógica pura (`deriveIsLive`, 4.1).
