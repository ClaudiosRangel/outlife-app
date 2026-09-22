# Requirements Document

Requisitos — Card da Comunidade estilo Strava + likes com avatares

## Introduction

O usuário quer repaginar o card de publicação no feed da Comunidade para um
formato inspirado no Strava (parecido, mas não igual), mais rico e organizado,
e melhorar a exibição de curtidas mostrando os avatares de quem curtiu além do
total. O card deve destacar a atividade (ícone, data/hora, lugar/cidade),
a descrição, as métricas (distância e demais conforme o tipo), conquistas/
níveis já existentes no app, e permitir ver várias mídias (mapa do trajeto,
fotos e vídeo) num carrossel. O botão de curtir atual deve ser mantido como
está hoje (comportamento e posição), apenas somando a exibição dos avatares.

Não deve quebrar o que já funciona: curtir/comentar/compartilhar/seguir,
exclusão do próprio post, filtros por aba, e a criação de post.

## Glossary

- **Card**: item de publicação no feed da Comunidade (`community_posts`).
- **Post de atividade**: post com `activity_id` (gerado ao finalizar uma
  atividade rastreada). Tem métricas (distância, duração, etc.).
- **Post manual**: post sem `activity_id` (foto/vídeo/relato).
- **metric_form**: forma de métrica do tipo de atividade
  (`speed_elevation`, `pace`, etc.), já existente em `metric-forms.ts`.
- **Kudos/likes**: curtidas do post (tabela `post_likes`).

## Requirements

### Requisito 1 — Cabeçalho do card (autor + contexto da atividade)

**User Story:** Como usuário do feed, quero ver de forma clara quem publicou,
que atividade é, quando e onde, para entender o contexto rapidamente.

#### Critérios de Aceitação
1. QUANDO o card for exibido ENTÃO DEVE mostrar avatar + nome do autor no topo
   (clicável para o perfil, como hoje).
2. QUANDO o card for exibido ENTÃO logo abaixo do nome DEVE mostrar o ícone da
   atividade (por tipo), a data e hora, e o lugar/cidade.
3. QUANDO o post não for de atividade ENTÃO DEVE usar o ícone da categoria do
   post (comportamento atual preservado) e ocultar métricas de atividade.

### Requisito 2 — Descrição destacada

**User Story:** Como usuário, quero que a descrição da atividade apareça em
destaque, para dar contexto à publicação.

#### Critérios de Aceitação
1. QUANDO houver descrição/texto ENTÃO DEVE ser exibida com destaque (título/
   subtítulo), acima ou próximo das métricas, não escondida.
2. QUANDO não houver texto ENTÃO o card NÃO DEVE mostrar espaço vazio quebrado.

### Requisito 3 — Métricas da atividade

**User Story:** Como usuário, quero ver a distância percorrida e as demais
métricas conforme o tipo de atividade, como no Strava.

#### Critérios de Aceitação
1. QUANDO o post for de atividade ENTÃO DEVE exibir distância e as métricas
   pertinentes ao `metric_form` (ex.: tempo, ritmo/velocidade, elevação),
   reutilizando `computeByMetricForm` (sem reescrever).
2. QUANDO um dado de métrica não existir ENTÃO DEVE ser omitido ou mostrado
   como "—", sem quebrar o layout.

### Requisito 4 — Conquistas, prêmios e níveis

**User Story:** Como usuário, quero ver conquistas/prêmios/níveis que já temos
no app associados àquela publicação/autor.

#### Critérios de Aceitação
1. QUANDO houver conquista(s) recente(s) do autor relacionadas ENTÃO o card
   PODE exibir um selo/linha de conquista (usando os dados já existentes:
   achievements/níveis).
2. QUANDO a frente de Segmentos existir (futuro) ENTÃO o card DEVE ter um slot
   pronto para exibir "conquista de segmento" — deixado como ponto de extensão,
   sem bloquear esta entrega.
3. QUANDO não houver conquista a exibir ENTÃO o card NÃO DEVE mostrar a seção.

### Requisito 5 — Carrossel de mídias (mapa + fotos + vídeo)

**User Story:** Como usuário, quero deslizar entre o mapa do percurso, fotos e
vídeo da atividade, para ver tudo no mesmo card.

#### Critérios de Aceitação
1. QUANDO o post de atividade tiver mapa (`map_snapshot_url`), foto
   (`image_url`) e/ou vídeo (`video_url`) ENTÃO DEVE exibir essas mídias num
   carrossel horizontal deslizável, na ordem: mapa, foto, vídeo (as que
   existirem).
2. QUANDO houver só uma mídia ENTÃO DEVE exibi-la sem controles de carrossel.
3. QUANDO houver vídeo ENTÃO DEVE seguir o padrão atual (SafeVideo, sem
   autoplay, poster = foto/mapa) para não regредir memória/performance.
4. QUANDO o post for de atividade ENTÃO tocar no mapa/na mídia principal DEVE
   levar ao detalhe da atividade (comportamento atual preservado).

### Requisito 6 — Likes com avatares + total

**User Story:** Como usuário, quero ver as figurinhas (avatares) de quem curtiu
e o total, mantendo o botão de curtir como é hoje.

#### Critérios de Aceitação
1. QUANDO um post tiver curtidas ENTÃO o card DEVE exibir até 3 avatares de
   quem curtiu + o total (ex.: 3 avatares e "96").
2. QUANDO o botão de curtir for usado ENTÃO seu comportamento/posição atuais
   DEVEM ser mantidos (toggle otimista, contador), apenas somando os avatares.
3. QUANDO não houver curtidas ENTÃO a linha de avatares NÃO DEVE aparecer.
4. QUANDO buscar os avatares ENTÃO NÃO DEVE degradar a performance do feed
   (buscar sob demanda/agregado, não N chamadas por card no scroll).

### Requisito 7 — Não regredir o existente

**User Story:** Como usuário, quero que tudo que já funciona continue
funcionando após a repaginação.

#### Critérios de Aceitação
1. QUANDO o card novo for aplicado ENTÃO curtir, comentar, compartilhar,
   seguir, excluir o próprio post e os filtros por aba DEVEM continuar
   funcionando.
2. QUANDO o compartilhamento for acionado ENTÃO DEVE continuar gerando o banner
   (atividade/manual) como hoje.
