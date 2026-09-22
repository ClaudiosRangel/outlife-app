# Implementation Plan: Segmentos nativos (estilo Strava)

## Overview

Segmentos nativos em 3 frentes: (A) dados + lógica pura de matching + testes;
(B) API + integração na conclusão da atividade (detecção de esforços);
(C) UI (tela do segmento + criação + destaque) + APK. Uma frente por vez.

## Task Dependency Graph

- Tarefa 1 (schema/RPC/lib pura) — base.
- Tarefa 2 (API + detecção no salvar) — depende de 1.
- Tarefa 3 (UI + APK) — depende de 1 e 2.

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3"] }
  ]
}
```

## Tasks

- [x] 1. Dados e lógica pura (Frente A)
  - [x] 1.1 `src/lib/segment-match.ts` (`nearestPointIndex`,
    `matchSegmentEffort`) + `segment-match.test.ts` (6 testes fast-check
    passando) (Requisitos 2.2, 2.3).
  - [x] 1.2 Migration `20260915140000_segments.sql`: `segments` +
    `segment_efforts` (+bbox, RLS) + RPC `segment_leaderboard`. Aplicada 2× +
    NOTIFY pgrst (Requisitos 1, 3, 4).

- [ ] 2. API + detecção (Frente B)
  - [ ] 2.1 API: `createSegment`, `fetchSegments`, `fetchSegmentById`,
    `fetchSegmentLeaderboard`, `recordSegmentEffort` + tipos
    (Requisitos 1, 3).
  - [ ] 2.2 `detectAndRecordEfforts(activityId, points)`: busca segmentos
    candidatos (bbox), roda matchSegmentEffort, grava esforços; best-effort
    (Requisitos 2.1, 2.4, 2.5).
  - [ ] 2.3 Integrar a detecção no fluxo de salvar atividade (após persistir a
    atividade, com os points em mãos) sem bloquear o salvamento (Requisito 2.5).

- [ ] 3. UI + fechamento (Frente C)
  - [ ] 3.1 Rota `/segmento/$segmentId`: dados do segmento + ranking top 10
    (destacando o usuário) (Requisitos 3, 5.2). Registrar no routeTree.
  - [ ] 3.2 Criar segmento a partir de uma atividade (na tela de detalhe da
    atividade) (Requisito 1.1).
  - [ ] 3.3 Destaque de conquista de segmento no card da comunidade (usar o
    slot já existente) e/ou na tela do segmento (Requisito 5.1).
  - [ ] 3.4 i18n PT+EN.
  - [ ] 3.5 `tsc` limpo + testes; build APK; commit+push; ROADMAP+backlog.

## Notes

- Importar do Strava/Garmin fica fora (decisão do usuário): segmentos nativos.
- Não reescrever o tracker; usar os points já gravados.
