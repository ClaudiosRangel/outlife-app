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

- [ ] 2. Componentes de mapa (Frente B)
  - [ ] 2.1 `MapboxExploreMap.tsx` (lazy, mapbox-gl): estilo outdoors, toggle
    2D/3D, recentrar, marcadores (amigo/parceiro/evento), `onError`
    (Requisitos 1.1, 1.3, 1.4, 2.1, 2.2, 4.1, 4.3).
  - [ ] 2.2 `ExploreMap.tsx`: escolhe Mapbox (se token) ou fallback `MapView`;
    trata `onError` caindo para o fallback (Requisitos 1.2, 4.3).

- [ ] 3. Integração + fechamento (Frente C)
  - [ ] 3.1 Trocar o `MapView` inline do `explorar.tsx` pelo `ExploreMap`,
    alimentando a camada "agora" (amigos ao vivo + parceiros + eventos
    próximos, limitados) (Requisitos 2.1, 2.3, 2.4).
  - [ ] 3.2 Modernizar visual das seções de busca (destinos/trilhas/parceiros)
    preservando dados e navegação (Requisito 3).
  - [ ] 3.3 Manter aviso offline + publisher inerte (Requisitos 2.3, 4.4).
  - [ ] 3.4 i18n PT+EN; `tsc` limpo + testes; build APK; commit+push;
    ROADMAP+backlog.

## Notes

- Documentar `VITE_MAPBOX_TOKEN` em PUBLICACAO-LOJAS (Vercel/CI).
- Restringir token por URL no Mapbox antes de publicar.
