# Requirements Document

## Introduction

Hoje o app trata "gravar uma atividade do dia a dia" (caminhada, corrida,
pedalada, natação, surf, trilha) e "criar uma rota-destino para a comunidade"
com a MESMA tela (o "modo destino" da tela de rastrear). Conceitualmente são
coisas diferentes:

- **Atividade diária**: pessoal, cotidiana, registrada quantas vezes o usuário
  quiser; gera segmentos e KOM; vive no perfil/feed.
- **Rota-Destino da comunidade**: um lugar/desafio curado (montanhismo,
  cachoeira, pico, parque, trilha, travessia, escalada), com pegada de
  aventura/férias/lazer, feito para OUTRAS pessoas usarem como roteiro/desafio.
  Passa por aprovação antes de virar destino público no Explorar.

Este spec cria uma tela e um fluxo com IDENTIDADE PRÓPRIA para "Criar rota"
(Rota-Destino), separando os dois objetivos, reaproveitando o rastreador de GPS
existente (`useActivityTracker`) por baixo, sem quebrar a atividade diária. A
Rota-Destino resultante entra no fluxo de aprovação já existente
(`destinations` com `status='pending'` → `/admin/destinos`).

## Glossary

- **Rota-Destino**: um registro de `destinations` criado por um usuário a partir
  de um trajeto (gravado ao vivo OU derivado de uma atividade já feita),
  destinado a virar sugestão pública de aventura após aprovação.
- **Categoria de Aventura**: o tipo de lugar/experiência da Rota-Destino —
  cachoeira, pico, montanha, parque, trilha, travessia, escalada.
- **Modo de Deslocamento**: como a Rota-Destino é percorrida — a pé OU de
  bicicleta (exclusivo; sem "misto").
- **Atividade Diária**: `user_activities` normal (caminhada/corrida/pedalada/
  etc.), fora do escopo de mudança deste spec exceto como ORIGEM opcional de uma
  Rota-Destino.
- **Aprovação**: fluxo administrativo existente que muda o `status` do
  `destinations` de `pending` para `approved` (tela `/admin/destinos`).
- **Modo de Criação**: como a Rota-Destino é originada — "ao vivo" (grava indo
  até o lugar) OU "a partir de atividade" (reaproveita o trajeto de uma
  `user_activities` já concluída do próprio usuário).

## Requirements

### Requirement 1: Entrada e identidade própria da tela

**User Story:** Como usuário, quero que "Criar rota" abra uma tela com cara de
"publicar uma aventura" (não de treino), para entender que estou contribuindo
com um destino para a comunidade.

#### Acceptance Criteria

1. WHEN o usuário toca no FAB "Criar rota" no Explorar, THE App SHALL abrir a
   tela de Rota-Destino com título e textos próprios (aventura/desafio), NÃO a
   tela de atividade diária.
2. THE tela de Rota-Destino SHALL deixar explícito, por texto/rótulo, que o
   resultado será enviado para aprovação e poderá ser usado por outras pessoas.
3. THE tela de atividade diária (aba "Gravar") SHALL permanecer inalterada em
   aparência e comportamento para atividades normais.

### Requirement 2: Escolha de Categoria de Aventura e Modo de Deslocamento

**User Story:** Como usuário, quero classificar minha Rota-Destino pelo tipo de
lugar e como se percorre, para que outros filtrem e entendam a experiência.

#### Acceptance Criteria

1. THE App SHALL oferecer as Categorias de Aventura: cachoeira, pico, montanha,
   parque, trilha, travessia, escalada.
2. THE App SHALL oferecer o Modo de Deslocamento: a pé OU bicicleta (seleção
   única, exclusiva).
3. WHEN o usuário tenta prosseguir sem escolher Categoria de Aventura E Modo de
   Deslocamento, THE App SHALL bloquear e exibir mensagem indicando o que falta.
4. THE Modo de Deslocamento escolhido SHALL ser usado como o `activity_type`
   técnico da gravação (a pé → "trilha"/"caminhada"; bicicleta → "pedalada"),
   de modo que o rastreamento e eventuais segmentos permaneçam coerentes.

### Requirement 3: Dois modos de criação (ao vivo e a partir de atividade)

**User Story:** Como usuário, quero poder criar uma Rota-Destino gravando ao
vivo OU reaproveitando uma atividade que já fiz, para não precisar refazer o
trajeto.

#### Acceptance Criteria

1. THE App SHALL oferecer o Modo de Criação "ao vivo" (calibra GPS → contagem →
   grava o trajeto real).
2. THE App SHALL oferecer o Modo de Criação "a partir de atividade", listando as
   atividades concluídas do próprio usuário com trajeto válido (>= 2 pontos).
3. WHEN o usuário escolhe "a partir de atividade" e seleciona uma atividade, THE
   App SHALL usar o trajeto dessa atividade como a rota da Rota-Destino, sem
   exigir nova gravação.
4. WHERE o trajeto (gravado ou reaproveitado) tem menos de 2 pontos, THE App
   SHALL impedir a criação e exibir mensagem clara.

### Requirement 4: Finalização — dados da aventura e envio para aprovação

**User Story:** Como usuário, quero descrever bem o lugar (nome, descrição,
dificuldade, foto, informações úteis) para que a sugestão seja aprovada e útil.

#### Acceptance Criteria

1. WHEN o trajeto está pronto, THE App SHALL apresentar um formulário de
   finalização com: nome (obrigatório), descrição, dificuldade (Fácil/Moderada/
   Difícil/Avançada), Categoria de Aventura (já escolhida, editável), foto
   (opcional) e campos úteis de aventura (pago/gratuito e valor, horário de
   visitação, pet-friendly) — todos opcionais exceto o nome.
2. WHEN o usuário confirma o envio com nome preenchido e trajeto válido, THE App
   SHALL criar um `destinations` com `status='pending'`, a rota (`route_geojson`),
   `distance_km`, `start_lat/lng`, `category`, `difficulty` e os campos
   preenchidos, via a função existente `createDestinationFull`.
3. WHEN a Rota-Destino é criada com sucesso, THE App SHALL exibir confirmação de
   "enviado para aprovação" e NÃO SHALL criar uma atividade no feed.
4. WHERE o upload da foto falha, THE App SHALL criar a Rota-Destino sem foto (não
   bloquear).
5. WHEN o usuário descarta/fecha o fluxo antes de confirmar, THE App SHALL não
   criar nenhum `destinations`.

### Requirement 5: Reuso técnico e não-regressão

**User Story:** Como mantenedor, quero reaproveitar o que já existe sem quebrar a
gravação diária nem a moderação.

#### Acceptance Criteria

1. THE feature SHALL reutilizar `useActivityTracker` (gravação ao vivo) sem
   reescrevê-lo, e `createDestinationFull` + `buildDestinationDraft` para montar
   o payload.
2. THE feature SHALL usar o fluxo de moderação já existente (`/admin/destinos` +
   notificação de aprovação), sem duplicar.
3. THE gravação de Atividade Diária (aba "Gravar") e o KOM/segmentos NÃO SHALL
   sofrer regressão de comportamento.
4. THE navegação (routeTree) SHALL usar rota flat/param existente; nova rota, se
   necessária, deve ser registrada corretamente e sobreviver ao build.

## Correctness Properties

### Property 1: Rota-Destino pendente exige nome e trajeto válido
`createDestinationFull` a partir deste fluxo só é chamado quando o nome não é
vazio E o trajeto tem >= 2 pontos.
**Validates: Requirements 3.4, 4.2**

### Property 2: Modo destino nunca cria atividade no feed
Nenhum caminho do fluxo de Rota-Destino chama `finishActivity`/persiste
`user_activities` como resultado da criação da Rota-Destino.
**Validates: Requirements 4.3**

### Property 3: Deslocamento mapeia para activity_type coerente
O Modo de Deslocamento "bicicleta" sempre resulta em `activity_type = "pedalada"`
e "a pé" em um tipo de caminhada/trilha — nunca em uma Categoria de Aventura
(cachoeira/pico/…) como activity_type.
**Validates: Requirements 2.4**
