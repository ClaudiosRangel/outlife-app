# Requirements Document

Requisitos — Explorar repaginado (mapa moderno 3D + "o que acontece agora")

## Introduction

O usuário quer repaginar a tela Explorar: um mapa GPS moderno (Mapbox, até 3D)
que, ao abrir, mostre "tudo o que está acontecendo na região agora" — eventos,
parceiros próximos, amigos em atividade (e qual atividade) — uma visão geral do
momento. Abaixo, manter as buscas por Destinos / Trilhas / Parceiros (já
existentes), porém com visual moderno, bonito e chamativo.

Decisões: o usuário criou conta Mapbox e forneceu token (`VITE_MAPBOX_TOKEN`).
Manter um fallback gratuito (Leaflet/OSM, já existente) para quando o token não
estiver disponível ou o Mapbox falhar. Não degradar o rastreamento nem a
publicação ao vivo existentes.

## Glossary

- **Mapa base**: camada de mapa (Mapbox GL quando há token; Leaflet/OSM como
  fallback).
- **Camada "agora"**: overlay que mostra amigos ao vivo, parceiros e eventos
  próximos ao centro atual.
- **3D**: inclinação/pitch + terreno/edifícios do Mapbox GL.

## Requirements

### Requisito 1 — Mapa base moderno com Mapbox (3D) e fallback

**User Story:** Como usuário, quero um mapa bonito e moderno ao abrir o
Explorar, com opção 3D.

#### Critérios de Aceitação
1. QUANDO houver `VITE_MAPBOX_TOKEN` ENTÃO o mapa DEVE usar Mapbox GL (estilo
   moderno) e permitir alternar 2D/3D (pitch/terreno).
2. QUANDO NÃO houver token (ou o Mapbox falhar ao carregar) ENTÃO DEVE usar o
   fallback Leaflet/OSM, sem quebrar a tela.
3. QUANDO o mapa carregar ENTÃO DEVE ocupar um espaço de destaque (maior que o
   mapa atual de 40px), com controles de recentrar e alternar camada/3D.
4. QUANDO o usuário compartilhar localização ENTÃO o mapa DEVE poder centralizar
   nele (comportamento atual de "centralizar em mim" preservado).

### Requisito 2 — Camada "o que acontece agora"

**User Story:** Como usuário, ao abrir o Explorar quero ver o que está
acontecendo na região agora.

#### Critérios de Aceitação
1. QUANDO o mapa abrir ENTÃO DEVE exibir marcadores de: amigos em atividade ao
   vivo (com o tipo de atividade), parceiros próximos e eventos próximos.
2. QUANDO eu tocar num marcador ENTÃO DEVE mostrar informação resumida e um
   caminho para o detalhe (perfil do amigo, parceiro, evento).
3. QUANDO estiver offline ENTÃO DEVE manter o aviso de que o ao vivo depende de
   internet (comportamento atual), sem quebrar o mapa base.
4. QUANDO não houver nada "agora" ENTÃO DEVE exibir um estado vazio elegante
   (sem marcadores, mas mapa utilizável).

### Requisito 3 — Buscas (Destinos / Trilhas / Parceiros) preservadas e modernizadas

**User Story:** Como usuário, quero continuar buscando destinos, trilhas e
parceiros, com visual melhor.

#### Critérios de Aceitação
1. QUANDO eu usar as abas/busca ENTÃO DEVE continuar filtrando destinos
   (dificuldade), trilhas importadas e parceiros como hoje.
2. QUANDO a lista for exibida ENTÃO DEVE ter um visual moderno (cards), sem
   perder as informações atuais.
3. QUANDO eu abrir um item ENTÃO DEVE navegar para o detalhe existente
   (destino/trilha/parceiro).

### Requisito 4 — Desempenho e robustez

**User Story:** Como usuário, quero que a tela seja fluida e não trave.

#### Critérios de Aceitação
1. QUANDO o mapa carregar ENTÃO o Mapbox GL DEVE ser carregado sob demanda
   (lazy) para não pesar o bundle inicial.
2. QUANDO houver muitos marcadores ENTÃO NÃO DEVE travar (limitar/clusterizar
   ou limitar a quantidade exibida).
3. QUANDO o Mapbox falhar (rede/token inválido) ENTÃO DEVE cair no fallback sem
   erro fatal.
4. QUANDO a tela montar ENTÃO NÃO DEVE abrir novos watchers de GPS (preservar a
   decisão atual do publisher inerte).


---

## Fase 2 — Explorar como diferencial (panorama da região "agora")

Objetivo: tornar o Explorar o diferencial do app — ao abrir, dar um panorama
completo do que está acontecendo na região, no mapa E em resumo escrito
(o que não cabe em pino vira texto). App outdoor: condições de clima são
parte central.

### Requisito 5 — Panorama escrito "agora na sua região"

**User Story:** Como usuário, ao abrir o Explorar quero um resumo do momento na
minha região, além dos pinos no mapa.

#### Critérios de Aceitação
1. QUANDO o Explorar abrir com minha posição conhecida ENTÃO DEVE exibir um
   cartão "Panorama agora" com: condições de clima atuais (temperatura,
   sensação, vento, probabilidade de chuva) e um veredito outdoor
   ("bom para atividade" / "atenção" / "evite"), obtido de uma API gratuita.
2. QUANDO o panorama for exibido ENTÃO DEVE mostrar contadores do momento:
   amigos ativos agora, eventos próximos (por data), parceiros próximos,
   destinos/trilhas próximos.
3. QUANDO houver destaques ENTÃO DEVE listar o próximo evento, o amigo mais
   próximo em atividade e um destino bem avaliado por perto (o que não cabe
   como pino).
4. QUANDO não houver posição conhecida ENTÃO DEVE exibir um panorama nacional/
   genérico sem quebrar, e um convite a compartilhar localização.
5. QUANDO a API de clima falhar/offline ENTÃO o restante do panorama DEVE
   funcionar (clima degrada graciosamente).

### Requisito 6 — Camadas e controles de mapa

**User Story:** Como usuário, quero ajustar o mapa (estilo/camada) e ver mais
tipos de marcador.

#### Critérios de Aceitação
1. QUANDO eu abrir o seletor de camada ENTÃO DEVE permitir alternar estilo do
   mapa (ex.: outdoor/ruas/satélite) usando os estilos de tiles do Mapbox.
2. QUANDO o mapa exibir a camada "agora" ENTÃO DEVE incluir amigos ao vivo,
   parceiros, destinos e trilhas próximos, e eventos próximos (posicionados
   pela coordenada do destino do evento).
3. QUANDO eu filtrar por tipo (amigos/parceiros/destinos/eventos) ENTÃO o mapa
   e o painel DEVEM refletir o filtro.

### Requisito 7 — API externa de contexto regional (clima)

**User Story:** Como operador, quero usar uma API gratuita e confiável para o
clima da região, sem custo/თkey.

#### Critérios de Aceitação
1. QUANDO buscar clima ENTÃO DEVE usar o Open-Meteo (gratuito, sem API key)
   com lat/lng, retornando atual + resumo do dia.
2. QUANDO a fonte de eventos externos for avaliada ENTÃO fica documentado que
   não há API pública gratuita de "eventos outdoor por região" adequada hoje;
   usamos os eventos do próprio app (tabela `events`) + clima do Open-Meteo.
