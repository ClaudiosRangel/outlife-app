# Design Document

Design — Explorar repaginado (mapa 3D + "o que acontece agora")

## Overview

Novo mapa de destaque no topo do Explorar com provider plugável: Mapbox GL
(quando há `VITE_MAPBOX_TOKEN`, com 3D) e fallback Leaflet/OSM (o `MapView`
atual). Uma camada "agora" plota amigos ao vivo + parceiros + eventos próximos.
As seções de busca (destinos/trilhas/parceiros) permanecem, com visual
modernizado. Mapbox GL é lazy-loaded.

## Architecture

- **Config de mapa** (`src/lib/map-config.ts`, puro): lê
  `import.meta.env.VITE_MAPBOX_TOKEN`; `hasMapbox()` decide o provider.
- **Componente novo** `src/components/explore/ExploreMap.tsx`: escolhe o
  provider. Se `hasMapbox()`, renderiza `MapboxExploreMap` (lazy); senão o
  `MapView` (Leaflet) atual. Props: marcadores "agora" (amigos/parceiros/
  eventos), posição do usuário, callbacks de seleção.
- **`MapboxExploreMap`** (lazy, `mapbox-gl`): inicializa mapa com estilo
  `mapbox://styles/mapbox/outdoors-v12` (ou streets), botão 2D/3D (setPitch +
  terreno DEM opcional), botão recentrar, marcadores customizados (avatar de
  amigo, pin de parceiro/evento). Falha de init → callback `onError` para o
  ExploreMap cair no fallback.
- **Dados "agora"** (reaproveita/estende API): amigos ao vivo
  (`fetchLiveActivityFriends`), parceiros (`fetchPartners` com lat/lng),
  eventos (`fetchEvents` — verificar campos de local/coords). Filtragem por
  proximidade do centro no cliente (bounding box simples), limitando a N.

## Components and Interfaces

- `src/lib/map-config.ts`: `hasMapbox(): boolean`, `getMapboxToken(): string|null`.
- `src/components/explore/ExploreMap.tsx`: seletor de provider + estado de erro.
- `src/components/explore/MapboxExploreMap.tsx`: mapa Mapbox GL (lazy).
- `explorar.tsx`: troca o bloco do `MapView` pelo `ExploreMap`, alimentando os
  marcadores "agora"; mantém as seções de busca abaixo (com cards revisados).

## Data Models

- Sem novo schema. Marcador unificado:
  `type NowMarker = { id, kind: 'friend'|'partner'|'event', lat, lng, title, subtitle?, avatarUrl?, href? }`.

## Correctness Properties

- **Property 1 (fallback seguro):** sem token ou com falha do Mapbox, a tela
  renderiza o mapa fallback sem erro fatal.
- **Property 2 (sem watcher extra):** montar o Explorar não abre novos
  watchPosition (publisher continua inerte).
- **Property 3 (marcadores limitados):** a camada "agora" nunca plota além do
  limite definido (evita travar).

## Error Handling

- Mapbox init/tiles falham → `onError` → provider cai para Leaflet.
- Dados "agora" falham → mapa base continua; camada vazia.

## Testing Strategy

- Unit puro: `map-config.test.ts` (hasMapbox conforme env) e
  `nearby.ts`/`filterNearby` (bounding box + limite) com fast-check.
- Verificação manual do mapa (3D toggle, marcadores, fallback) no APK.

## Notas de implementação

- Instalar `mapbox-gl` (+ tipos). Lazy import do componente Mapbox.
- Token via `VITE_MAPBOX_TOKEN` (.env local; documentar na Vercel/CI).
- Restringir o token por URL no dashboard Mapbox antes de publicar.
- Frentes: (A) config + lib nearby + deps + testes; (B) ExploreMap + Mapbox
  component (lazy) + fallback; (C) integrar no explorar + camada agora + APK.
