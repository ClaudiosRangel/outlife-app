# Requirements Document

Gamificação: Níveis e Rankings

## Introduction

Este documento especifica dois recursos de gamificação do aplicativo
(OutVitar), sobre as atividades reais registradas por GPS:

- **Item 10 — Nível do usuário**: classificar cada usuário em um Nível
  (Iniciante / Intermediário / Avançado) conforme suas atividades concluídas,
  exibido no perfil. Um Nível geral (somando todos os tipos) e, como detalhe,
  um Nível por tipo de atividade (caminhada / pedalada / trilha).
- **Item 12 — Rankings**: classificações por maior distância (km), menor tempo
  e maior altimetria, com escopo global ou entre seguidos, filtro de período
  (semana / mês / ano / sempre), e um ranking por destino específico.

Contexto técnico: as atividades vivem em `public.user_activities`
(`distance_meters`, `duration_seconds`, `elevation_gain`, `activity_type`,
`destination_id`, `status`). Só contam atividades `status = 'completed'`
registradas de verdade (Requisito de integridade estilo Strava — Bloco A). Já
existe o padrão de **VIEW agregada + função `SECURITY DEFINER`** em
`achievement-records.sql` (view `user_achievement_stats`), que este bloco
estende. A RLS de `user_activities` só permite o dono ler as próprias
atividades — portanto qualquer ranking entre usuários precisa de uma
VIEW/RPC `SECURITY DEFINER` agregada, nunca leitura direta cliente-a-cliente.

Os campos `profiles.level` / `progress_to_next_level` existem mas nunca são
alimentados hoje; o Nível pode ser derivado das estatísticas agregadas, sem
depender de manter esses campos sincronizados.

## Glossary

- **User_Activity**: registro de atividade em `public.user_activities`. Só as
  com `status = 'completed'` contam para nível e ranking.
- **Activity_Type**: tipo da atividade — `caminhada | pedalada | trilha | outro`.
- **User_Level**: classificação do usuário — `iniciante | intermediario |
  avancado` — derivada das atividades reais.
- **Level_Thresholds**: limiares (faixas) que definem cada User_Level,
  definidos como constantes de configuração no design.
- **Level_Progress**: percentual (0–100) de progresso do usuário rumo ao
  próximo User_Level, para a barra de progresso do perfil.
- **Ranking_Metric**: métrica de ranqueamento — `distancia` (maior km),
  `tempo` (menor duração), `altimetria` (maior ganho de elevação).
- **Ranking_Scope**: escopo do ranking — `global` (todos os usuários) ou
  `seguidos` (o usuário logado + quem ele segue).
- **Ranking_Period**: janela temporal — `semana | mes | ano | sempre`,
  aplicada sobre `start_time` da atividade.
- **Ranking_Entry**: uma linha do ranking (posição, usuário, valor da métrica).
- **Destination_Ranking**: ranking restrito às atividades de um
  `destination_id` específico.
- **Leaderboard_Screen**: a tela/aba que exibe os rankings.
- **Level_Card**: o cartão de nível no perfil (hoje mostra `profiles.level`).

## Requirements

### Requirement 1: Classificação de nível do usuário

**User Story:** Como usuário, quero ver meu nível (iniciante, intermediário ou
avançado) com base nas minhas atividades reais, para acompanhar minha evolução.

#### Acceptance Criteria

1. QUANDO o perfil é exibido, ENTÃO a OutVitar_Application DEVE calcular o
   User_Level geral do usuário a partir apenas de User_Activity com
   `status = 'completed'`, usando os Level_Thresholds definidos no design.
2. QUANDO o User_Level é determinado, ENTÃO ele DEVE ser um de três valores
   determinísticos: `iniciante`, `intermediario` ou `avancado`.
3. O cálculo do User_Level DEVE ser uma função pura e determinística das
   estatísticas agregadas (atividades concluídas, km totais, altimetria
   total), sem depender de estado externo — nunca retornar valor indefinido.
4. QUANDO o usuário não tem nenhuma atividade concluída, ENTÃO o User_Level
   DEVE ser `iniciante` (piso), nunca um erro nem estado vazio.
5. QUANDO o Level_Card é exibido, ENTÃO ele DEVE mostrar o rótulo traduzido do
   User_Level e o Level_Progress (0–100%) rumo ao próximo nível; no nível
   máximo (`avancado`), o progresso DEVE ser exibido como completo (100%) sem
   sugerir um próximo nível inexistente.

### Requirement 2: Nível por tipo de atividade

**User Story:** Como usuário, quero ver meu nível separado por tipo (caminhada,
pedalada, trilha), para saber em qual modalidade evoluí mais.

#### Acceptance Criteria

1. QUANDO o perfil exibe níveis por tipo, ENTÃO a OutVitar_Application DEVE
   calcular um User_Level para cada Activity_Type relevante (`caminhada`,
   `pedalada`, `trilha`), usando os mesmos Level_Thresholds aplicados só às
   atividades daquele tipo.
2. QUANDO um Activity_Type não tem nenhuma atividade concluída, ENTÃO seu
   User_Level DEVE ser `iniciante` (piso), sem quebrar a exibição.
3. O nível por tipo DEVE reutilizar a mesma função pura de classificação do
   Requirement 1 (uma única fonte de verdade da regra de faixas).

### Requirement 3: Rankings por métrica

**User Story:** Como usuário, quero ver rankings por distância, tempo e
altimetria, para me comparar com outros aventureiros e me motivar.

#### Acceptance Criteria

1. QUANDO a Leaderboard_Screen é aberta, ENTÃO a OutVitar_Application DEVE
   oferecer as três Ranking_Metric: `distancia` (maior km), `tempo` (menor
   duração) e `altimetria` (maior ganho de elevação).
2. QUANDO um ranking por `distancia` ou `altimetria` é montado, ENTÃO as
   Ranking_Entry DEVEM ser ordenadas de forma decrescente pelo valor da
   métrica; QUANDO por `tempo`, DEVEM ser ordenadas de forma crescente (menor
   tempo primeiro).
3. QUANDO os rankings agregam dados de vários usuários, ENTÃO a agregação DEVE
   usar uma VIEW/RPC `SECURITY DEFINER` (padrão de `user_achievement_stats`),
   já que a RLS de `user_activities` não permite leitura cliente-a-cliente —
   nunca expondo dados além de nome, avatar e o valor da métrica.
4. QUANDO um ranking é montado, ENTÃO só User_Activity com `status =
   'completed'` DEVE ser considerada (nunca atividades em andamento).
5. QUANDO o ranking é exibido, ENTÃO cada Ranking_Entry DEVE mostrar posição,
   nome/avatar do usuário e o valor formatado da métrica (km, tempo mm:ss ou
   hh:mm:ss, metros de altimetria).
6. QUANDO o usuário logado aparece no ranking, ENTÃO sua Ranking_Entry DEVE ser
   destacada visualmente.

### Requirement 4: Escopo do ranking (global e entre seguidos)

**User Story:** Como usuário, quero alternar entre o ranking global e o ranking
só entre quem eu sigo, para comparações mais relevantes.

#### Acceptance Criteria

1. QUANDO a Leaderboard_Screen é exibida, ENTÃO ela DEVE oferecer os dois
   Ranking_Scope: `global` (todos os usuários) e `seguidos` (o usuário logado
   mais os autores que ele segue).
2. QUANDO o Ranking_Scope é `seguidos`, ENTÃO só as atividades do usuário
   logado e dos autores seguidos por ele DEVEM entrar no ranking.
3. QUANDO o usuário não segue ninguém e o escopo é `seguidos`, ENTÃO o ranking
   DEVE conter ao menos o próprio usuário (se ele tiver atividades), sem
   quebrar nem exibir erro.

### Requirement 5: Filtro de período

**User Story:** Como usuário, quero filtrar o ranking por semana, mês, ano ou
todos os tempos, para ver quem está mais ativo em cada janela.

#### Acceptance Criteria

1. QUANDO a Leaderboard_Screen é exibida, ENTÃO ela DEVE oferecer os
   Ranking_Period: `semana`, `mes`, `ano` e `sempre`.
2. QUANDO um Ranking_Period diferente de `sempre` é selecionado, ENTÃO só
   User_Activity cujo `start_time` cai dentro da janela correspondente DEVE ser
   considerada.
3. O cálculo dos limites da janela (início da semana/mês/ano) DEVE ser
   determinístico e documentado (fuso e regra de início), para o mesmo
   resultado no cliente e no servidor.

### Requirement 6: Ranking por destino

**User Story:** Como usuário, quero ver o ranking de um destino específico
(ex.: melhor tempo na Pedra do Sino), para me comparar naquele local.

#### Acceptance Criteria

1. QUANDO a tela de detalhe de um destino é exibida (ou uma seção de ranking
   por destino), ENTÃO a OutVitar_Application DEVE oferecer um
   Destination_Ranking daquele `destination_id`, com as mesmas Ranking_Metric.
2. QUANDO um Destination_Ranking é montado, ENTÃO só User_Activity com aquele
   `destination_id` e `status = 'completed'` DEVE ser considerada.
3. QUANDO uma User_Activity não tem `destination_id` (atividade livre), ENTÃO
   ela NÃO DEVE aparecer em nenhum Destination_Ranking, mas DEVE continuar
   contando nos rankings gerais (Requirement 3) e no nível (Requirement 1).
4. QUANDO um destino não tem nenhuma atividade concluída, ENTÃO o
   Destination_Ranking DEVE exibir um estado vazio claro, sem erro.

### Requirement 7: Integridade e desempenho

**User Story:** Como usuário, quero que níveis e rankings reflitam dados reais
e carreguem rápido, para confiar nos números e navegar com fluidez.

#### Acceptance Criteria

1. QUANDO níveis ou rankings são calculados, ENTÃO valores nulos de
   `distance_meters`, `duration_seconds` ou `elevation_gain` DEVEM ser tratados
   como zero/ausentes de forma determinística, nunca gerando `NaN`/`Infinity`
   nem quebrando a ordenação.
2. QUANDO um ranking é consultado, ENTÃO o resultado DEVE ser limitado a um
   número máximo de linhas (Top N definido no design) para não sobrecarregar a
   rede/rendição.
3. QUANDO uma migração adiciona VIEW/RPC de nível/ranking, ENTÃO ela DEVE ser
   idempotente (`CREATE OR REPLACE`, `CREATE ... IF NOT EXISTS`) e não alterar
   migrações já aplicadas.
4. QUANDO o build de produção é gerado, ENTÃO ele DEVE compilar sem novos erros
   de tipo introduzidos por esta feature (além dos pré-existentes conhecidos).

### Requirement 8: Preservação dos fluxos existentes

**User Story:** Como usuário, quero que a gamificação não quebre nada do perfil,
das atividades ou das conquistas que já funcionam.

#### Acceptance Criteria

1. QUANDO os níveis são adicionados ao perfil, ENTÃO as seções existentes
   (estatísticas, conquistas, seguidores, abas) DEVEM permanecer funcionando
   sem regressão.
2. QUANDO o ranking é adicionado, ENTÃO o sistema de conquistas
   (`achievement_records`, `grant_pending_achievements`) e os fluxos de
   atividade (iniciar/finalizar/sincronizar) DEVEM permanecer inalterados.
3. QUANDO o cálculo de nível reutiliza estatísticas agregadas, ENTÃO ele NÃO
   DEVE depender de manter `profiles.level`/`progress_to_next_level`
   sincronizados por trigger, evitando um novo ponto de falha.
