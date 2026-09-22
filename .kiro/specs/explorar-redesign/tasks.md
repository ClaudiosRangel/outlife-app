# Implementation Plan: Explorar repaginado (mapa 3D + "agora")

## Overview

3 frentes: (A) config/deps/lib pura; (B) componente de mapa Mapbox lazy +
fallback; (C) integração no Explorar (camada "agora" + buscas modernizadas) +
APK. Uma frente por vez, sem quebrar o rastreamento/publisher.

## Task Dependency Graph

- Tarefa 1 (config + deps + lib nearby) — base.
- Tarefa 2 (ExploreMap + MapboxExploreMap + fallback) — depende de 1.
- Tarefa 3 (integrar no explorar + camada agora + APK) — depende de 1 e 2.

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

- [x] 1. Config, deps e lógica pura (Frente A)
  - [x] 1.1 Instalado `mapbox-gl@3.31`. `src/lib/map-config.ts`
    (`hasMapbox`, `getMapboxToken`, estilo/centro) + `map-config.test.ts`
    (Requisito 1.1, 1.2).
  - [x] 1.2 `src/lib/nearby.ts`: `filterNearby` (bbox/raio + limite + amigos
    primeiro) + testes fast-check (4) (Requisitos 2.1, 4.2).

- [x] 2. Componentes de mapa (Frente B)
  - [x] 2.1 `MapboxExploreMap.tsx` (lazy, mapbox-gl): estilo outdoors, toggle
    2D/3D (terreno DEM + pitch), recentrar, marcadores (amigo/parceiro/evento),
    `onError` (Requisitos 1.1, 1.3, 1.4, 2.1, 2.2, 4.1, 4.3).
  - [x] 2.2 `ExploreMap.tsx`: escolhe Mapbox (se token) ou fallback `MapView`;
    `onError` cai no fallback (Requisitos 1.2, 4.3).

- [x] 3. Integração + fechamento (Frente C)
  - [x] 3.1 Trocado o `MapView` inline do `explorar.tsx` pelo `ExploreMap`
    (mapa grande 3D), alimentando a camada "agora" (amigos ao vivo + parceiros
    próximos, via filterNearby limite 60). Clique no marcador navega
    (Requisitos 2.1, 2.2, 2.4). Eventos ficam como evolução (não há
    fetchEvents com coords hoje).
  - [x] 3.2 Seções de busca (destinos/trilhas/parceiros) preservadas com os
    cards atuais; parceiros passam a carregar sempre (também alimentam o mapa)
    (Requisito 3).
  - [x] 3.3 Aviso offline + publisher inerte mantidos (Requisitos 2.3, 4.4).
  - [x] 3.4 `tsc` limpo; APK 10:39; commit+push; ROADMAP+backlog.

## Notes

- Documentar `VITE_MAPBOX_TOKEN` em PUBLICACAO-LOJAS (Vercel/CI).
- Restringir token por URL no Mapbox antes de publicar.
