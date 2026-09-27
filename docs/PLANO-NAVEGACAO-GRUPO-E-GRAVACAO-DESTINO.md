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
