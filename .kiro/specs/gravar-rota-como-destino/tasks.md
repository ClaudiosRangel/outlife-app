# Implementation Plan

Gravar rota pelo Explorar → destino para aprovação

## Overview

Estende a gravação com calibração+contagem e um modo "destino" que, ao
finalizar, cria um `destinations` pending para aprovação admin. Reusa tracker,
createDestinationFull e a moderação existente. Substitui o card "Sugerir".

## Task Dependency Graph

```mermaid
flowchart TD
  T1[1 lib pura buildDestinationFromRoute + testes]
  T2[2 Recording_Screen: calibracao + contagem 3-2-1]
  T3[3 search param mode=destino + sheet de destino no finalizar]
  T4[4 Explorar: Criar rota abre modo destino + substitui Sugerir]
  T5[5 admin: preview do tracado no card de moderacao (opcional)]
  T6[6 verificacao build+APK+roadmap]

  T1 --> T3
  T2 --> T3
  T3 --> T4
  T4 --> T6
  T5 --> T6
```

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "2"] },
    { "wave": 2, "tasks": ["3"] },
    { "wave": 3, "tasks": ["4", "5"] },
    { "wave": 4, "tasks": ["6"] }
  ]
}
```

## Tasks

- [ ] 1. Lib pura: payload de destino a partir da rota gravada
  - `src/lib/route-to-destination.ts`: `buildDestinationDraft({ points, name, ... })`
    → distância (haversine), start (1º ponto), geojson LineString. + testes
    (Properties 3, validações).
  - _Requisitos: 5.1, 5.2, 4.1; Property 3_

- [ ] 2. Recording_Screen: calibração + contagem regressiva
  - Estado `preStart` (calibrating→countdown→start); usa `gpsSignalState` +
    botão "iniciar mesmo assim"; countdown 3-2-1 → `proceedStart()`. Sem tocar
    no `useActivityTracker`.
  - _Requisitos: 1.1, 1.2, 1.3, 1.4_

- [ ] 3. Modo destino: search param + sheet ao finalizar
  - `/atividade/rastrear` `validateSearch` aceita `mode?: "destino"`.
  - Ao finalizar em modo destino: sheet com nome/descrição/dificuldade/categoria/
    foto → `createDestinationFull(status:'pending', routeGeojson, ...)`.
    Descartar não cria nada. Não salva atividade no feed nesse modo.
  - _Requisitos: 2.2, 2.3, 2.5, 2.6; Properties 1, 2_

- [ ] 4. Explorar: "Criar rota" abre modo destino + substitui "Sugerir"
  - Botão "Criar rota" → `/atividade/rastrear?mode=destino`. Card "Sugerir"
    substituído por chamada ao fluxo de gravar rota.
  - _Requisitos: 2.1, 3.1, 3.2_

- [ ] 5. Admin: preview do traçado na moderação (opcional)
  - `/admin/destinos`: mostrar `DestinationRouteMap` no card quando o pending
    tiver `route_geojson`.
  - _Requisitos: 4.2_

- [ ] 6. Verificação e entrega
  - Diagnostics + testes puros; build:native + cap sync + APK; rotas verificadas;
    commit/push main; roadmap atualizado.
  - _Requisitos: 4.3_

## Notes

- Reusar tracker/createDestinationFull; sem migration prevista.
- search param evita mexer no routeTree.gen.ts.
- Testes puros em src/lib (sem Capacitor).
- Destino nasce pending → só aparece no Explorar após aprovação.
