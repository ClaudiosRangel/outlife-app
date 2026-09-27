# Requirements Document

Gravar rota pelo Explorar → destino para aprovação (substitui "Sugerir")

## Introduction

Hoje o Explorar tem um card "Sugerir destino" (formulário) e um botão "Criar
rota". A ideia (inspirada no concorrente, adaptada à cara do OutVitar) é que o
usuário **grave a rota indo ao local** e, ao finalizar, envie essa rota como um
**destino `pending`** para o admin conferir/aprovar — passando a ser o caminho
principal de criação de destinos pela comunidade, no lugar do "Sugerir".

A gravação em si já existe (`useActivityTracker`, auto-pausa, calibração parcial
de sinal, pontos, finalize com trajeto). O que esta feature acrescenta:
1. Uma **experiência de início melhor**: calibração de GPS explícita + contagem
   regressiva antes de começar.
2. Um **modo "gravar para virar destino"**: ao finalizar, em vez de (ou além de)
   salvar a atividade, o usuário pode **enviar a rota gravada como destino
   pendente** com nome/descrição/dificuldade/foto, indo para aprovação do admin.
3. Substituir o card "Sugerir destino" por esse fluxo.

Nada da confiabilidade do rastreamento pode ser degradado (padrão Strava).

## Glossary

- **Recording_Screen:** tela de gravação (`src/routes/atividade.rastrear.tsx`).
- **Activity_Tracker:** hook `useActivityTracker`.
- **GPS_Calibration:** etapa que aguarda o sinal de GPS ficar preciso o
  suficiente (ex.: acurácia < ~25 m) antes de começar, com opção "iniciar mesmo
  assim". Já há base (`gpsSignalState`/`smoothedSpeed`).
- **Countdown:** contagem regressiva curta (3-2-1) antes de iniciar a captura.
- **Route_Destination_Draft:** a rota gravada que o usuário decide transformar
  em destino; vira uma linha em `destinations` com `status = 'pending'`.
- **Admin_Approval:** fluxo já existente de moderação de destinos
  (`/admin/destinos`, aprovar/rejeitar + `notify_destination_approved`).
- **Suggest_Card:** o card atual "Conhece um destino incrível? Sugerir" no
  Explorar, a ser substituído.

## Requirements

### Requisito 1: Início da gravação com calibração + contagem

**User Story:** Como usuário, quero que o app garanta um bom sinal de GPS e me
dê uma contagem antes de começar, para a rota sair precisa e eu me preparar.

#### Critérios de Aceitação

1. WHEN o usuário aciona iniciar a gravação, THE Recording_Screen SHALL exibir
   uma etapa de GPS_Calibration mostrando a precisão atual e a meta, com opção
   de "iniciar mesmo assim".
2. WHEN o sinal atinge a meta de precisão OR o usuário escolhe "iniciar mesmo
   assim", THE Recording_Screen SHALL exibir uma Countdown (3-2-1) e então
   iniciar a captura.
3. THE GPS_Calibration e a Countdown SHALL NÃO alterar a lógica de captura/
   validação de pontos, apenas anteceder o início.
4. WHERE o dispositivo não fornece acurácia, THE etapa de calibração SHALL
   permitir iniciar sem bloquear (degradação segura).

### Requisito 2: Modo "gravar para virar destino"

**User Story:** Como usuário, quero gravar uma trilha indo até lá e enviá-la
como destino, para que ela apareça no app depois de aprovada.

#### Critérios de Aceitação

1. THE Explore_Screen SHALL oferecer iniciar uma gravação **em modo destino**
   (a partir do botão "Criar rota").
2. WHEN uma gravação em modo destino é finalizada com trajeto válido (>= 2
   pontos), THE app SHALL apresentar um formulário para o usuário informar
   nome, descrição, dificuldade, categoria e (opcional) foto do destino.
3. WHEN o usuário confirma, THE app SHALL criar um registro em `destinations`
   com `status = 'pending'`, a rota gravada (`route_geojson`), distância e
   ponto inicial derivados do trajeto, e `created_by` = usuário.
4. THE destino pendente criado SHALL entrar no fluxo de Admin_Approval já
   existente (aparecer em `/admin/destinos`, aprovar/rejeitar, notificar autor).
5. WHERE a gravação em modo destino é descartada, THE app SHALL NÃO criar
   destino nem atividade.
6. THE gravação em modo destino PODE também salvar a atividade normal do usuário
   (decisão de design), mas isso não é obrigatório para o fluxo do destino.

### Requisito 3: Substituir o card "Sugerir"

**User Story:** Como usuário, quero um caminho claro para criar destinos
gravando a rota, em vez do formulário "Sugerir".

#### Critérios de Aceitação

1. THE Suggest_Card ("Sugerir destino") SHALL ser substituído por uma chamada
   para o fluxo de gravar rota (modo destino).
2. WHERE ainda for desejável sugerir sem gravar (ex.: destino conhecido sem ir
   agora), THE decisão de manter um atalho secundário é opcional (design).

### Requisito 4: Qualidade e conformidade do destino

**User Story:** Como administrador, quero receber destinos gravados com dados
mínimos para conferir o padrão antes de publicar.

#### Critérios de Aceitação

1. THE criação de destino a partir de gravação SHALL exigir ao menos nome e um
   trajeto válido (>= 2 pontos).
2. THE admin SHALL ver a rota gravada no mapa ao revisar (reuso do preview de
   traçado).
3. THE destino só SHALL aparecer no Explorar após aprovação (RLS atual:
   `approved`).

### Requisito 5: Integridade e reuso

#### Critérios de Aceitação

1. THE feature SHALL reutilizar `useActivityTracker` (não reescrever) e a
   estrutura de `destinations` + `createDestinationFull` já existentes.
2. THE cálculo de distância/elevação da rota gravada SHALL usar as mesmas
   funções já usadas (haversine/elevation), sem duplicar lógica divergente.
3. THE textos ao usuário SHALL ter i18n pt-BR/en.
