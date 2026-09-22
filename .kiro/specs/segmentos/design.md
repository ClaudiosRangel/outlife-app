# Design Document

Design — Segmentos nativos (estilo Strava)

## Overview

Segmentos nativos com detecção de esforço no cliente (onde os pontos com
timestamp estão disponíveis ao finalizar a atividade) e ranking no banco.
Reutiliza `haversineMeters` e o trajeto já gravado. Sem PostGIS: matching por
proximidade de início/fim + verificação de ordem/distância, com uma função
pura testável.

## Architecture

- **Dados (Supabase)**: tabelas `segments` (definição) e `segment_efforts`
  (esforços). Leitura pública; escrita restrita ao dono via RLS. RPC
  `segment_leaderboard(_segment_id, _limit)` para o top 10 (melhor por usuário).
- **Detecção (cliente)**: ao finalizar a atividade, com os `points`
  (`{lat,lng,ts}`) em mãos, buscar segmentos candidatos (bounding box grosseiro
  via colunas min/max lat/lng do segmento) e rodar `matchSegmentEffort(points,
  segment)` (função pura) para cada um; gravar os esforços detectados.
- **Ranking (banco)**: RPC agrega `segment_efforts` por usuário (min tempo),
  ordena asc, limita 10, junta `profiles`.

## Components and Interfaces

- `src/lib/segment-match.ts` (puro): 
  - `nearestPointIndex(points, target)`: índice do ponto mais próximo.
  - `matchSegmentEffort(points, segment, opts)`: retorna
    `{ matched: boolean, elapsedSeconds?: number, startIdx?, endIdx? }`.
    Regra: acha o ponto mais próximo do início do segmento (dentro de
    `radius`), depois o ponto mais próximo do fim **após** o início (dentro de
    `radius`); valida que a distância percorrida entre eles ~ distância do
    segmento (tolerância). elapsed = ts[end]-ts[start].
- `src/lib/api.ts`: `createSegment`, `fetchSegments`, `fetchSegmentById`,
  `fetchSegmentLeaderboard`, `recordSegmentEffort`, `detectAndRecordEfforts`.
- Rota `/segmento/$segmentId` (detalhe + ranking) e ponto de entrada para criar
  segmento a partir de uma atividade (na tela de detalhe da atividade).
- Integração no fluxo de salvar atividade (onde a atividade é persistida):
  chamar `detectAndRecordEfforts(activityId, points)` de forma best-effort.

## Data Models

```sql
create table segments (
  id uuid pk default gen_random_uuid(),
  created_by uuid references profiles(id) on delete set null,
  name text not null,
  activity_type text,
  distance_meters numeric not null default 0,
  polyline jsonb not null,            -- [[lng,lat],...]
  start_lat numeric, start_lng numeric,
  end_lat numeric, end_lng numeric,
  min_lat numeric, max_lat numeric, min_lng numeric, max_lng numeric, -- bbox
  created_at timestamptz default now()
);
create table segment_efforts (
  id uuid pk default gen_random_uuid(),
  segment_id uuid references segments(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  activity_id uuid references user_activities(id) on delete cascade,
  elapsed_seconds int not null,
  achieved_at timestamptz default now()
);
```
RLS: `segments`/`segment_efforts` SELECT público; INSERT/UPDATE/DELETE só do
dono (`created_by`/`user_id` = auth.uid()). Cascata em profiles/atividade cobre
a exclusão de conta (Req 4.3).

## Correctness Properties

- **Property 1 (sem falso positivo):** `matchSegmentEffort` só retorna matched
  quando início e fim são atingidos na ordem e a distância percorrida entre
  eles é compatível com a do segmento (dentro da tolerância).
- **Property 2 (tempo coerente):** elapsedSeconds ≥ 0 e corresponde a
  ts[end]-ts[start] com end>start.
- **Property 3 (ranking 1 por usuário):** o leaderboard retorna no máximo um
  esforço por usuário (o de menor tempo), ordenado asc, no máximo 10.
- **Property 4 (best-effort):** falha na detecção não impede salvar a atividade.

## Error Handling

- Detecção em try/catch; loga e segue. Sem pontos suficientes → nenhum esforço.
- RPCs retornam erro → toast no cliente; ranking vazio renderiza estado vazio.

## Testing Strategy

- fast-check/unit em `segment-match.test.ts`: match verdadeiro num trajeto que
  cobre o segmento; sem match quando só início; sem match fora de ordem;
  elapsed correto; robustez a pontos não-finitos.
- Verificação manual: criar segmento de uma atividade, refazer, ver ranking.

## Notas de implementação

- Frentes: (A) schema + RPC + lib pura + testes; (B) API + integração no
  salvar atividade + detecção; (C) UI (tela do segmento + criar + destaque no
  card) + APK.
- Migration idempotente 2× + NOTIFY pgrst + consolidado.
- Raio de tolerância inicial: 25 m para início/fim; tolerância de distância
  30%. Ajustável.
