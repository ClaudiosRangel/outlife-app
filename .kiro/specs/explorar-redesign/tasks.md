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

## Tarefas — Fase 2 (Explorar como diferencial)

- [ ] 4. Clima Open-Meteo + panorama (dados)
  - [ ] 4.1 `src/lib/weather.ts`: `fetchWeatherNow(lat,lng)` (Open-Meteo, sem
    key) + `outdoorVerdict(weather)` puro (bom/atenção/evite) + testes
    fast-check (Requisitos 5.1, 7.1, 5.5).
  - [ ] 4.2 `src/lib/explore-panorama.ts`: `buildPanorama({friends, partners,
    destinations, trails, events, center})` puro — contadores + destaques
    (próximo evento, amigo mais próximo, destino bem avaliado perto) + testes
    (Requisitos 5.2, 5.3).
  - [ ] 4.3 API: `fetchNearbyEvents` (events + destino coords + event_date) e
    ajustar destinos/trilhas para expor coords no Explorar (Requisito 6.2).

- [ ] 5. UI do panorama + camadas de mapa
  - [ ] 5.1 Componente `ExplorePanorama` (cartão "Panorama agora": clima +
    veredito + contadores + destaques) no topo do Explorar (Requisitos 5.1,
    5.2, 5.3, 5.4).
  - [ ] 5.2 Seletor de camada/estilo do mapa (outdoor/ruas/satélite) no
    `MapView` via tiles Mapbox; filtro por tipo de marcador (Requisitos 6.1,
    6.3).
  - [ ] 5.3 Plotar destinos+trilhas+eventos próximos no mapa (além de amigos+
    parceiros) (Requisito 6.2).
  - [ ] 5.4 Modernizar cards das seções de busca (visual chamativo) (Req 3.2).
  - [ ] 5.5 i18n PT+EN; `tsc` limpo + testes; build APK; commit+push;
    ROADMAP+backlog+PESQUISA-APIS.

## Notes

- Documentar `VITE_MAPBOX_TOKEN` em PUBLICACAO-LOJAS (Vercel/CI).
- Restringir token por URL no Mapbox antes de publicar.
- Pesquisa de APIs registrada em `docs/PESQUISA-APIS-EXPLORAR.md` (clima
  Open-Meteo escolhido; eventos = internos).

- [x] 4. Fase 3 — Explorar como diferencial (panorama total + busca por região)
  - [x] 4.1 Clima enriquecido (Open-Meteo, sem key): índice UV, qualidade do ar
    (US AQI), nascer/pôr do sol, fase da lua (`weather.ts` + `fetchAirQuality`
    + `uvLevelKey`/`aqiLevelKey`/`moonPhase`). Testes.
  - [x] 4.2 Resumo em linguagem natural (`explore-summary.ts` +
    `buildExploreSummary`) — parágrafo no topo do painel. Testes.
  - [x] 4.3 Busca por região geocodificada (`geocode.ts` via Mapbox): digitar
    "Juiz de Fora" recentra mapa + panorama; chip da região com limpar.
  - [x] 4.4 Contadores clicáveis (amigos/eventos/parceiros/lugares): 1 vai
    direto ao item; vários abrem lista (bottom sheet). Lugares = destinos +
    trilhas próximos ordenados por distância.
  - [x] 4.5 Camadas de mapa (outdoors/satélite/ruas) via seletor sobre o mapa
    (`MAP_LAYERS`, tiles Mapbox).
  - [x] 4.6 i18n PT+EN; tsc limpo; testes (summary 4 + weather extras);
    APK 15:37.

## Notes fase 3

- Não há API única gratuita e confiável de "tudo que rola por região" para app
  comercial (Eventbrite/Meetup/PredictHQ são fragmentados/pagos/fracos no BR).
  Diferencial = conteúdo próprio + camadas grátis do Open-Meteo (clima, UV, ar,
  sol, lua). Documentado.
- Cards de busca (destinos/trilhas/parceiros) ainda no visual atual — repaginar
  numa próxima passada se desejado.
