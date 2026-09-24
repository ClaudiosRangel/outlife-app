# Pesquisa: segmento seguindo as ruas + vídeo do percurso (Flyover)

> Itens 1 e 2 solicitados. Pesquisa registrada com o caminho técnico. Ainda
> NÃO implementados (frentes próprias) — este doc guia a implementação futura.

## Item 1 — Criar segmento seguindo as ruas (curvas), não em linha reta

**Como o Strava faz** (conteúdo parafraseado do suporte oficial):
- Um segmento tem **ponto inicial, ponto final e uma sequência de posições no
  meio** — ou seja, a geometria com as curvas. Não é uma reta.
  Fonte: https://support.strava.com/en-us/articles/15401994-how-do-i-create-a-segment-on-strava
- O segmento é criado **a partir do trajeto GPS de uma atividade já gravada**
  (que já contém as curvas reais das ruas). O usuário escolhe início/fim ao
  longo desse trajeto, com botões de "mover ponto" que são dinâmicos: com zoom
  afastado movem em incrementos grandes; com zoom aproximado, ajuste fino.
  Fonte: https://support.strava.com/en-us/articles/15401997-optimizing-segment-creation-how-to-create-good-segments
- Para desenhar ROTAS (feature separada), o Strava usa traçar com o dedo e a
  linha "gruda" na rua/trilha mais próxima (snap-to-road).
  Fonte: https://support.strava.com/en-us/articles/15401660-creating-routes-on-mobile

**Como fazer no OutVitar** (já temos token Mapbox):
- **Melhor opção (a partir da atividade)**: já temos `detectAndRecordEfforts`
  usando os pontos reais. Para "criar segmento a partir do trajeto", cortar a
  polilinha da atividade entre o início/fim escolhidos — geometria com curvas
  de graça, sem API externa. (Hoje a criação pelo mapa faz uma reta 2 pontos.)
- **Criar pelo mapa com curvas**: usar a **Mapbox Directions API** (perfil
  `walking`/`cycling`), que retorna a rota seguindo as ruas entre os pontos
  marcados (aceita até 25 coords, retorna geometry).
  Fonte: https://docs.mapbox.com/api/navigation/directions/
- **Limpar trajeto GPS ruidoso**: **Mapbox Map Matching API** (2–100 coords),
  "gruda" o trace na malha de ruas.
  Fonte: https://docs.mapbox.com/api/navigation/map-matching/
- O `SegmentDrawMap` e o schema `segments.polyline` (jsonb [lng,lat][]) já
  suportam polilinha com N pontos — só falta trocar a "reta 2 pontos" pela
  geometria real (do trajeto da atividade OU da Directions API).

## Item 2 — Vídeo do percurso (o "Flyover" do Strava / TripLog etc.)

**Como o Strava faz**: chamam de **Flyover** — uma reprodução/animação **3D**
do trajeto sobre um mapa dinâmico, com estatísticas ao vivo (distância,
elevação). Não é um arquivo de vídeo pré-renderizado: é uma animação em tempo
real que percorre a linha do trajeto (o usuário dá play/pause, muda a
velocidade). Só no app (não na web).
Fonte: https://support.strava.com/en-us/articles/15401641-flyover
e "Activity Replay": https://support.strava.com/en-us/articles/15401546-activity-replay

**Como fazer no OutVitar** (WebView Android = 2D confiável, sem WebGL):
- Versão 2D do replay: um marcador que percorre a `route_geojson` da atividade
  ao longo do tempo (interpolando os pontos), com a câmera do Leaflet
  acompanhando (`map.panTo`) e as métricas atualizando (distância/tempo/
  velocidade no instante). Controles play/pause/velocidade.
- Para "gerar um vídeo compartilhável": capturar frames do mapa via canvas
  (mais complexo no Leaflet) OU gerar um MP4 no cliente (pesado). Alternativa
  mais simples e robusta: o replay animado dentro do app (como o Strava faz —
  não precisa ser arquivo) + o banner estático de compartilhamento que já
  existe (`generateActivityBanner`).
- 3D real (voo sobre o terreno) exige WebGL estável, que não funciona no
  WebView Android atual — ficaria só para navegador/versão futura.

**Resumo**: ambos são frentes próprias. Recomendo (1) primeiro melhorar o
segmento para usar a geometria real do trajeto/Directions (ganho grande, baixo
risco), e (2) depois o replay 2D animado da atividade.
