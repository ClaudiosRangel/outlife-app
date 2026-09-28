# Plano — Navegação em grupo e gravação de rota como destino

> Registro das ideias grandes discutidas em 26/09/2026 (prints do concorrente
> Trivlock + Google Maps compartilhar localização). Ideias, NÃO copiar igual —
> elaborar algo parecido com a cara do OutVitar.

## Contexto: o que já foi feito nesta rodada (fixes rápidos)

- **1A** imagem sobre badges → card de cabeçalho com `z-10`.
- **1B** botão "Iniciar navegação" fora da tela → agora rola no fluxo (acima da
  barra inferior sticky).
- **6** erro "Não foi possível carregar o ranking" → schema cache do PostgREST
  recarregado (as RPCs de liga existem e rodam).
- **2** "Iniciar navegação" inteligente → se o usuário está a >300m do início,
  abre sheet com distância + "Como chegar (Google Maps)" + "Iniciar mesmo
  assim"; se perto, vai gravar. (feito na tela de destino)
- **3** destinos sem rota ocultados (status→rejected, reversível); só ficam no
  Explorar os com rota real. Cachoeira Alta é o único aprovado agora.

## Item 4 — Gravação de rota pelo Explorar → aprovação (spec futuro)

**Ideia:** substituir o card "Sugerir destino" por um fluxo em que o usuário
GRAVA a rota (indo até o local) e, ao finalizar, envia para aprovação do admin
virar um destino. A gravação teria (inspirado no concorrente, elaborar próprio):
1. **Calibração de GPS** (aguardar precisão < ~25m, com "iniciar mesmo assim").
2. **Contagem regressiva** (3-2-1) antes de começar.
3. **Código de compartilhamento** da atividade (para acompanhamento — ver item 5).
4. Início da navegação/gravação.
- Botões laterais durante a gravação: trocar camada do mapa, adicionar ponto
  (com foto/nome/ícone), recado rápido, câmera.
- Encerrar: **gravar** (salva) ou **descartar**.
- Ao finalizar uma gravação feita "para virar destino": envia como destino
  `pending` → admin confere padrão (rota completa, dá pra chegar, infos) →
  aprova. Substitui o botão "Sugerir".

**Estado atual reaproveitável:** já temos rastreamento (`use-activity-tracker`),
auto-pausa, calibração parcial (gpsSignalState), pontos, e o admin `/admin/
destino-novo` (que hoje recebe GPX). Faltaria: contagem regressiva, adicionar
ponto com foto durante a gravação, e o caminho "finalizar → criar destino
pending a partir da rota gravada".

**Risco/esforço:** médio-alto. Spec próprio: `gravar-rota-como-destino`.

## Item 5 — Navegação em grupo (ver amigos ao vivo na rota) (spec futuro)

**Ideia (Google Maps "compartilhar localização" / print do concorrente):**
durante uma atividade/navegação, os integrantes do grupo compartilham a
localização em tempo real; cada um aparece com seu avatar no mapa; se alguém se
perde, todos veem onde ele está. Recados rápidos ("pausa", "retornando",
"tudo 100%", "preciso de ajuda"). Distância entre os membros ("+1,2 km",
"+350 m").

**Como funciona tecnicamente (honesto):** precisa de internet (GPS pega a
posição offline, mas ENVIAR aos outros exige rede). Em área sem sinal, o ícone
"congela" na última posição e atualiza ao voltar o sinal — igual ao Maps.

**Estado atual reaproveitável:** já temos "amigos ao vivo" (`fetchLiveActivity
Friends` / `use-live-activity-publisher` / `LiveFriendsList` / view
`live-activity-friends`). Ou seja, JÁ publicamos e lemos posição ao vivo de
amigos. Faltaria: (a) conceito de "grupo/sessão de trajeto" (quem está nessa
rota agora), (b) código de convite para entrar na sessão, (c) mapa da navegação
mostrando os membros + distância entre eles + recados rápidos, (d) privacidade
(só compartilha com quem entrou na sessão, com expiração).

**Risco/esforço:** ALTO (tempo real + privacidade + UX de mapa ao vivo). Spec
próprio: `navegacao-em-grupo`. É o maior diferencial "viciante", mas o mais
complexo — fazer por último e com cuidado de privacidade (LGPD/lojas).

## Item 1C — Comentários/feedback e "descobrir mais" no destino (menor)

O print de "Descobrir Mais" + comentários é do concorrente. No nosso destino
hoje temos amigos/parceiros/clima/elevação. Avaliar adicionar:
- **Comentários/avaliações no destino** (reusar `reviews` que já existe para
  parceiros/atividades? há `saved_destinations`, mas avaliação de destino
  precisa checar o schema).
- "Descobrir mais" (links da web) é secundário e depende de fonte de conteúdo —
  provavelmente pular ou deixar por último.

## Ordem sugerida (impacto x esforço x risco)

1. **(feito)** Fixes 1A/1B/2/3/6.
2. Item 4 (gravar rota → destino) — destrava conteúdo próprio e substitui
   "Sugerir"; médio.
3. Item 1C (comentários no destino) — engajamento; pequeno/médio.
4. Item 5 (navegação em grupo ao vivo) — maior diferencial, maior risco; por
   último e com atenção a privacidade.


---

## Fluxo completo — botão "Criar rota" (modo destino) — atualizado 27/09/2026

Objetivo: transformar um trajeto real gravado em um DESTINO pendente de
aprovação (substitui o antigo "Sugerir").

Conceitos distintos (não confundir):
- **Tipo de atividade** (como você se move): corrida, caminhada, trilha,
  pedalada, natação… Define o rastreamento e o KOM/ranking por segmento.
- **Categoria do destino** (o tipo de lugar): trilha, cachoeira, montanha,
  praia, pico, parque, outro. Serve para o usuário filtrar destinos no Explorar.
  São coisas diferentes e são escolhidas em momentos diferentes.

Passo a passo:
1. Explorar (aba Destinos) → **FAB flutuante "Criar rota"** → navega para
   `/atividade/rastrear?mode=destino`.
2. Banner laranja explica o modo. O usuário **escolhe o TIPO DE ATIVIDADE**
   (obrigatório — mesmo seletor de ícones do rastreamento normal).
3. Toca INICIAR → **calibração de GPS** (mostra qualidade do sinal; "Iniciar"
   quando bom, ou "Iniciar mesmo assim") → **contagem 3-2-1** → começa a gravar.
4. Grava o trajeto real (mapa + métricas ao vivo, como uma atividade normal).
5. Toca FINALIZAR → abre o **sheet de destino**: nome, descrição, **dificuldade**
   (Fácil/Moderada/Difícil), **CATEGORIA do lugar** (trilha/cachoeira/montanha/
   praia/ciclismo/outro) e **foto** opcional.
6. Enviar → `createDestinationFull({ status:'pending', routeGeojson, distanceKm,
   startLat/Lng, elevation, difficulty, category })` a partir de
   `buildDestinationDraft(points)`. Toast "enviado para aprovação" → volta ao
   Explorar. **Não** salva atividade no feed nesse modo; descartar/fechar não
   cria nada.
7. Moderação: admin aprova/rejeita em `/admin/destinos` (fluxo já existente),
   com notificação ao autor quando publicado.

Regras/armadilhas:
- Trajeto < 2 pontos ao finalizar → erro claro, não cria destino.
- Falha no upload da foto → cria destino sem foto (não bloqueia).
- A categoria do destino NÃO herda o tipo de atividade (bug corrigido — antes
  gravava `activity_type = "cachoeira"`, o que quebrava o KOM).

## Coerência dos filtros do Explorar — decisão 27/09/2026

- A **faixa de chips** abaixo da busca deixou de ser DIFICULDADE (que duplicava
  o painel completo e misturava "Acessível") e passou a ser **CATEGORIA**
  (Todos/Trilhas/Cachoeiras/Montanhas/Praias/Picos/Parques), coerente com o
  placeholder "Trilhas, cachoeiras, regiões…". Os chips alimentam
  `advFilters.category` (fonte única) — sem filtro duplicado.
- O **painel de filtros completo** (ícone ao lado da busca) mantém: região,
  dificuldade, categoria, pet-friendly, pago/grátis, "rotas que curti". A
  dificuldade vive só aqui agora.
- Removido o **segundo botão de filtro** (decorativo, no header ao lado de
  "Explorar destinos") — havia dois; ficou só o funcional na barra de busca.

## Fluxo completo — tela de Destino (`/destino/$destinationId`)

Ordem de cima para baixo (seções que só aparecem quando há dado):
1. **Hero** (foto grande) com botões flutuantes Voltar e Salvar (bookmark).
2. **Card de cabeçalho** (com folga abaixo do hero — não sobrepõe mais a foto):
   badges (dificuldade colorida, categoria, Pago/Gratuito, Pet) + nome + local
   (região/UF) + linha de métricas (distância km, duração, elevação).
3. **Visitação** (horário de funcionamento + preço), quando cadastrados.
4. **Clima** (Open-Meteo): temperatura/sensação/vento/umidade + previsão horária
   + alerta "Atenção" para condições agravantes. Silencioso se não carregar.
5. **Perfil de elevação** (gráfico SVG), quando há `elevation_profile`.
6. **Mapa da rota** (Leaflet + traçado real `route_geojson`, início/fim).
7. **Sobre** (descrição).
8. **Amigos nesta trilha** (avatares — accepted/following que passaram perto).
9. **Parceiros na região** (até 8, raio ~30 km do destino).
10. **Aviso de segurança** (responsabilidade do usuário).
11. **CTA "Iniciar navegação"** (laranja, no fluxo): lê a posição atual; se
    está a >300 m do início, abre sheet com a distância + "Como chegar (Google
    Maps)" + "Iniciar mesmo assim"; se perto, vai direto para gravar. Sem
    geolocalização/erro → segue para gravar (não bloqueia).
