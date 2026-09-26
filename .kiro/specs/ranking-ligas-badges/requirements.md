# Requirements Document

Ranking: Ligas Semanais + Badges (Bloco 2 pré-lojas)

## Introduction

O Ranking atual já tem abas por tipo de atividade, métrica
(distância/altimetria/tempo), escopo (global/seguindo) e período. Este bloco
adiciona os dois recursos de maior retenção do padrão de mercado (Strava +
Duolingo), **segmentáveis por tipo de atividade**, sem quebrar o ranking atual:

1. **Ligas/Divisões semanais:** o usuário compete numa divisão (Bronze → Prata
   → Ouro → Diamante) acumulando pontos na semana pela sua atividade; ao fechar
   a semana, os melhores SOBEM de divisão e os piores DESCEM, e o ranking
   reinicia. É o "loop semanal" que faz voltar.
2. **Badges/Conquistas:** o app já concede `achievement_records` (primeira
   atividade, 100/500 km, explorador, destinos, KOM de segmento, streak). Falta
   uma **tela de conquistas** que as exiba com destaque (obtidas x a obter) e
   ampliar o catálogo com marcos por tipo de atividade e streak.

O projeto reforça: **não degradar a integridade de registro de atividades**;
migrations idempotentes; leitura entre usuários só via RPC `SECURITY DEFINER`
(a RLS de `user_activities` não permite leitura cruzada); conteúdo em pt-BR/en.

## Glossary

- **Ranking_Screen:** tela `/ranking` (`src/routes/ranking.tsx`).
- **Activity_Type:** modalidade (caminhada/pedalada/trilha/corrida/etc.), do
  catálogo `activity_types`. As ligas e o ranking são segmentáveis por ela.
- **League_Division:** divisão da liga: `bronze`, `prata`, `ouro`, `diamante`
  (ordenadas). Todo participante tem uma divisão por Activity_Type.
- **League_Week:** janela semanal (segunda 00:00 → domingo 23:59, fuso
  America/Sao_Paulo) em que os pontos são acumulados e ao fim promovidos/rebaixados.
- **League_Points:** pontos do usuário na League_Week corrente, derivados da
  sua atividade concluída no período (fórmula definida no design; base:
  distância + elevação, por Activity_Type).
- **League_Standing:** a posição do usuário dentro da sua League_Division na
  League_Week, entre os pares da mesma divisão.
- **Promotion/Relegation:** ao fechar a League_Week, os N primeiros da divisão
  sobem (Promotion) e os M últimos descem (Relegation); demais permanecem.
- **Achievement_Record:** conquista já existente (`achievement_records`,
  `rule_code` único por usuário).
- **Badge_Catalog:** catálogo de badges (código, título, descrição, ícone,
  critério, tipo/threshold), incluindo as regras já existentes + novas por
  Activity_Type e streak.
- **Achievements_Screen:** nova tela que lista as badges obtidas e as a obter
  (com progresso), acessível do Perfil e/ou do Ranking.

## Requirements

### Requisito 1: Ligas/Divisões semanais por tipo de atividade

**User Story:** Como usuário, quero competir numa liga semanal que sobe e desce
de divisão, para ter um motivo de voltar toda semana.

#### Critérios de Aceitação

1. THE sistema SHALL manter, para cada usuário e cada Activity_Type participada,
   uma League_Division atual (default `bronze` na primeira participação).
2. WHILE a League_Week corrente está aberta, THE sistema SHALL acumular
   League_Points do usuário a partir das suas atividades concluídas no período,
   segmentadas por Activity_Type.
3. WHEN o usuário abre o Ranking na aba de Ligas, THE Ranking_Screen SHALL
   exibir a divisão atual, a lista de participantes da mesma divisão ordenada
   por League_Points (League_Standing), destacando a posição do próprio
   usuário, e as zonas de promoção (topo) e rebaixamento (base).
4. WHEN uma League_Week fecha, THE sistema SHALL promover os primeiros e
   rebaixar os últimos de cada divisão conforme as faixas definidas, e reiniciar
   os League_Points para a nova semana.
5. WHERE o usuário não teve atividade na semana, THE sistema SHALL manter sua
   divisão sem promover, aplicando rebaixamento apenas conforme a regra de
   inatividade definida no design (sem punir indevidamente quem entrou agora).
6. THE leitura do ranking de liga entre usuários SHALL ocorrer via RPC
   `SECURITY DEFINER` (a RLS não permite leitura cruzada de atividades).
7. THE fechamento/rollover da League_Week SHALL ser idempotente (rodar o
   rollover duas vezes na mesma semana não duplica promoções nem zera pontos
   novos indevidamente).

### Requisito 2: Pontuação e integridade

**User Story:** Como usuário, quero que a pontuação da liga seja justa e
consistente com minha atividade real.

#### Critérios de Aceitação

1. THE League_Points SHALL ser derivado apenas de atividades concluídas
   (`status = 'completed'`) do próprio usuário dentro da League_Week.
2. THE cálculo de League_Points SHALL NÃO alterar nem depender de mudanças na
   captura/validação de pontos, distância, velocidade ou elevação existentes.
3. WHERE uma atividade é do tipo X, THE seus pontos SHALL contar somente para a
   liga do tipo X (e para a liga "geral", se existir a modalidade "Todos").
4. THE pontuação SHALL ser recalculável de forma determinística a partir das
   atividades do período (sem estado acumulado frágil que possa divergir).

### Requisito 3: Tela de Conquistas (Badges)

**User Story:** Como usuário, quero ver minhas conquistas e as que ainda posso
obter, para me sentir recompensado e motivado.

#### Critérios de Aceitação

1. THE Achievements_Screen SHALL listar todas as badges do Badge_Catalog,
   separando as OBTIDAS das A OBTER, com título, descrição e ícone.
2. WHERE uma badge tem critério mensurável (ex.: 100 km, 7 dias de streak), THE
   Achievements_Screen SHALL exibir o progresso atual rumo ao critério.
3. THE Achievements_Screen SHALL ser acessível a partir do Perfil e/ou do
   Ranking.
4. WHEN o usuário obtém uma nova badge, THE sistema SHALL concedê-la via o
   mecanismo `SECURITY DEFINER` já existente (nunca por escrita direta do
   cliente).
5. THE Badge_Catalog SHALL incluir as regras já existentes
   (`first_activity`, `km_100`, `km_500`, `explorer`, `top_reviewer`,
   `destinos_*`, troféus de segmento, streak) e novas badges por marcos de
   Activity_Type e de streak (thresholds definidos no design).

### Requisito 4: Preservar o ranking atual e a navegação

**User Story:** Como usuário, quero que o ranking que já uso continue
funcionando e a navegação não mude.

#### Critérios de Aceitação

1. THE ranking existente (métrica/escopo/período/abas por tipo) SHALL continuar
   funcionando sem regressão.
2. THE barra de navegação inferior SHALL ser mantida (Início/Explorar/Gravar/
   Comunidade/Você) — as Ligas entram como uma aba/seção dentro do Ranking.
3. WHERE não há dados de liga ainda (nenhuma atividade na semana), THE
   Ranking_Screen SHALL exibir um estado vazio claro, sem erro.
4. THE novos elementos visuais SHALL seguir a identidade do app (verde-floresta
   + acento laranja), coerentes com o restante.

### Requisito 5: Migrations e conteúdo

#### Critérios de Aceitação

1. THE alterações de banco SHALL ser migrations novas timestampadas e
   idempotentes, aplicadas 2× + reload PostgREST, refletidas no consolidado
   `migrations-pendentes.sql`.
2. THE textos voltados ao usuário SHALL ter chaves i18n pt-BR e en com
   `defaultValue`.
3. THE rollover semanal SHALL ter um mecanismo de disparo definido no design
   (ex.: RPC chamada sob demanda na abertura do ranking com trava de
   idempotência por semana, evitando dependência de cron não disponível).
