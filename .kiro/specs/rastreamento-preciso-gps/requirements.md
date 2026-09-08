# Requirements Document

Rastreamento Preciso de GPS (confiabilidade estilo Strava)

## Introduction

Este documento especifica melhorias na precisão e confiabilidade do
rastreamento GPS de atividades do aplicativo (OutVitar), com o objetivo de
que distância, trajeto, velocidade e tempo registrados correspondam ao
movimento real do usuário — com qualidade comparável à de aplicativos de
referência do segmento (ex.: Strava). O foco são dois problemas concretos
observados:

1. **Velocidade incompatível com o movimento**: ao caminhar, o app exibe
   velocidade típica de corrida/pedalada. A causa é o ruído do sinal GPS,
   que infla a distância acumulada (e, por consequência, a velocidade média
   derivada da distância).
2. **Trajeto não fiel ao percurso real**: pontos GPS imprecisos ("saltos"
   e deriva quando parado) entram no cálculo, distorcendo o trajeto e as
   métricas que dependem dele.

A base atual de rastreamento já existe e **não deve ser reescrita**: o hook
`src/hooks/use-activity-tracker.ts` gerencia captura de pontos, distância,
elevação, timer e auto-pause; `src/lib/haversine.ts` calcula distância entre
pontos; `src/lib/activity-metrics.ts` (`computeActivityMetrics`) deriva
Average_Speed/Average_Pace a partir da distância total e do tempo total;
`src/components/ActivityMap.tsx` desenha o trajeto; a captura vem da Web
Geolocation API (fora do shell nativo) ou do
`@outlife/capacitor-location-tracking` (dentro do shell nativo). Este spec
introduz uma **camada de filtragem/validação de pontos** entre a captura
bruta e a acumulação de distância/trajeto, além de tornar a velocidade
exibida coerente com o movimento — sem alterar o modelo de dados persistido
nem o fluxo de finalização/sincronização já existentes.

Comportamentos já cobertos por outros specs e **fora do escopo** deste:
persistência de elevação, auto-pause (feedback visual), compartilhamento na
comunidade, notificações e bloqueio de logout (spec
`atividade-rastreada-melhorias`, concluído).

## Glossary

- **Activity_Tracker**: o hook `use-activity-tracker.ts`, responsável por
  capturar pontos GPS, acumular distância/elevação, controlar timer e
  pausas, e persistir o estado local.
- **Raw_Location_Sample**: uma leitura bruta de localização entregue pela
  fonte de captura (Web Geolocation API ou Native_Location_Tracking_Module),
  contendo latitude, longitude, timestamp, e opcionalmente acurácia
  horizontal (`accuracy`, em metros), altitude e velocidade do sensor
  (`speed`, em m/s).
- **Accuracy_Radius**: a acurácia horizontal estimada de uma
  Raw_Location_Sample, em metros (raio de confiança do sensor). Quanto menor,
  melhor o sinal.
- **Accepted_Point**: uma Raw_Location_Sample que passou por todos os
  critérios de validação (Point_Validation) e é incorporada ao trajeto e à
  distância acumulada.
- **Rejected_Point**: uma Raw_Location_Sample descartada por Point_Validation
  (não incorporada à distância nem ao trajeto).
- **Point_Validation**: o conjunto de critérios aplicados a cada
  Raw_Location_Sample antes de aceitá-la (acurácia, deslocamento mínimo,
  velocidade implausível, salto/teleporte).
- **Activity_Type**: classificação da atividade — `caminhada`, `pedalada`,
  `trilha` ou `outro` — usada para calibrar os limiares de Point_Validation
  e de velocidade plausível.
- **Speed_Ceiling**: velocidade máxima plausível para um determinado
  Activity_Type, acima da qual um deslocamento entre dois pontos é
  considerado salto de GPS (Rejected_Point).
- **Instant_Speed**: velocidade instantânea estimada a partir dos pontos
  recentes aceitos (não a média total), usada para exibição ao vivo.
- **Smoothed_Speed**: Instant_Speed após suavização (média móvel sobre uma
  janela curta de pontos aceitos), para evitar oscilações bruscas típicas
  do sensor a baixas velocidades.
- **Average_Speed**: velocidade média da atividade (distância total ÷ tempo
  decorrido), já calculada por `computeActivityMetrics`.
- **Warmup_Period**: intervalo inicial após iniciar o rastreamento durante o
  qual o GPS ainda está estabilizando a fixação (fix) e as primeiras
  amostras costumam ser imprecisas.
- **GPS_Signal_State**: estado observável da qualidade do sinal
  (`aquisitando`, `bom`, `fraco`, `sem_sinal`), derivado do Accuracy_Radius
  das amostras recentes, exibível ao usuário.

---

## Requirements

### Requirement 1: Validação de acurácia da amostra de localização

**User Story:** Como usuário rastreando uma atividade, quero que leituras de
GPS imprecisas sejam descartadas, para que minha distância e trajeto não
sejam inflados por ruído de sinal.

#### Acceptance Criteria

1. QUANDO uma Raw_Location_Sample é recebida com Accuracy_Radius estritamente
   maior que o Limiar_Acuracia configurado, ENTÃO o Activity_Tracker DEVE
   marcá-la como Rejected_Point e NÃO DEVE incorporá-la à distância
   acumulada, ao trajeto exibido nem ao cálculo de elevação, mantendo esses
   três agregados idênticos aos valores anteriores ao recebimento da amostra.
2. QUANDO uma Raw_Location_Sample é recebida com Accuracy_Radius menor ou
   igual ao Limiar_Acuracia configurado, ENTÃO o Activity_Tracker DEVE
   submetê-la aos demais critérios de Point_Validation antes de decidir
   aceitá-la ou marcá-la como Rejected_Point.
3. SE uma Raw_Location_Sample é recebida sem valor de Accuracy_Radius
   disponível (ausente ou nulo), ENTÃO o Activity_Tracker DEVE aplicar a
   Politica_Acuracia_Ausente configurada, que assume exatamente um de dois
   valores — ACEITAR ou REJEITAR — produzindo, para amostras equivalentes,
   resultado idêntico e repetível a cada execução, sem qualquer caminho de
   comportamento indefinido.
4. O Limiar_Acuracia DEVE ser um parâmetro de configuração de valor único em
   metros, cujo valor default DEVE ser estritamente menor que 20 metros e
   DEVE permanecer dentro da faixa configurável definida na fase de design
   (limites mínimo e máximo em metros), rejeitando na configuração qualquer
   valor fora dessa faixa.

### Requirement 2: Descarte de deslocamentos implausíveis (saltos de GPS)

**User Story:** Como usuário, quero que "saltos" de posição causados por erro
de GPS não sejam contados como distância percorrida, para que o trajeto
registrado seja fiel ao caminho real.

#### Acceptance Criteria

1. QUANDO uma nova Raw_Location_Sample é recebida e existe uma Accepted_Point
   anterior, ENTÃO o Activity_Tracker DEVE estimar a velocidade do
   deslocamento como a distância entre a última Accepted_Point e a nova
   amostra dividida pelo intervalo de tempo entre os respectivos timestamps,
   e DEVE tratar a amostra como Rejected_Point QUANDO essa velocidade
   estimada for maior que o Speed_Ceiling do Activity_Type atual.
2. QUANDO a velocidade estimada do deslocamento é menor ou igual ao
   Speed_Ceiling do Activity_Type atual, ENTÃO o Activity_Tracker DEVE
   submeter a amostra aos demais critérios de Point_Validation (não
   rejeitando-a pelo critério de Speed_Ceiling).
3. QUANDO uma amostra é rejeitada por exceder o Speed_Ceiling, ENTÃO a
   distância acumulada e o trajeto NÃO DEVEM ser alterados por essa amostra.
4. SE o intervalo de tempo entre a última Accepted_Point e a nova
   Raw_Location_Sample for menor ou igual a zero (timestamps iguais, ausentes
   ou fora de ordem), ENTÃO o Activity_Tracker DEVE aplicar uma política
   determinística e consistente (tratar a amostra como Rejected_Point pelo
   critério de Speed_Ceiling), nunca um comportamento indefinido nem uma
   divisão por intervalo nulo.
5. O Speed_Ceiling DEVE ser definido para cada Activity_Type (`caminhada`,
   `pedalada`, `trilha` e `outro`), de modo que o limiar de `caminhada` seja
   estritamente menor que o de `pedalada`.
6. QUANDO não há Accepted_Point anterior (primeira amostra válida da
   atividade), ENTÃO o Activity_Tracker NÃO DEVE aplicar o critério de
   Speed_Ceiling a essa amostra (não há deslocamento a avaliar).
7. QUANDO uma amostra é rejeitada por qualquer critério de Point_Validation,
   ENTÃO a referência de "última posição" usada para avaliar a próxima
   amostra DEVE permanecer a última Accepted_Point (a amostra rejeitada NÃO
   DEVE redefinir essa referência), de modo que a próxima Raw_Location_Sample
   seja avaliada contra essa mesma Accepted_Point.

### Requirement 3: Deslocamento mínimo calibrado por tipo de atividade

**User Story:** Como usuário parado ou andando devagar, quero que a deriva do
GPS não seja contada como movimento, para que minha atividade não acumule
distância que eu não percorri.

#### Acceptance Criteria

1. QUANDO o deslocamento entre a última Accepted_Point e uma nova
   Raw_Location_Sample é estritamente menor que o limiar de deslocamento
   mínimo vigente para o Activity_Type, ENTÃO o Activity_Tracker DEVE
   classificar a amostra como Rejected_Point.
2. QUANDO o deslocamento entre a última Accepted_Point e uma nova
   Raw_Location_Sample é maior ou igual ao limiar de deslocamento mínimo
   vigente para o Activity_Type, ENTÃO o Activity_Tracker DEVE classificar a
   amostra como Accepted_Point (sujeita aos demais critérios de
   Point_Validation).
3. O Activity_Tracker DEVE permitir um limiar de deslocamento mínimo distinto
   por Activity_Type.
4. SE não houver limiar de deslocamento mínimo configurado para o
   Activity_Type corrente, ENTÃO o Activity_Tracker DEVE aplicar um limiar de
   deslocamento mínimo padrão definido.
5. QUANDO o Activity_Type é `caminhada`, ENTÃO o limiar de deslocamento
   mínimo aplicado DEVE ser estritamente menor que o limiar fixo atual de 2
   metros e menor ou igual ao menor deslocamento esperado entre duas
   Accepted_Point consecutivas de uma caminhada em progresso.
6. QUANDO uma Raw_Location_Sample é classificada como Rejected_Point por
   deslocamento mínimo, ENTÃO o Activity_Tracker NÃO DEVE substituir a última
   Accepted_Point de referência pela amostra rejeitada.
7. QUANDO uma Raw_Location_Sample é classificada como Rejected_Point por
   deslocamento mínimo, ENTÃO o Activity_Tracker PODE atualizar a posição
   atual exibida no mapa para a localização da amostra, mas NÃO DEVE alterar
   a distância acumulada nem o trajeto registrado da atividade.

### Requirement 4: Velocidade coerente com o movimento

**User Story:** Como usuário caminhando, quero ver uma velocidade compatível
com uma caminhada, para confiar que o app mede meu esforço corretamente.

#### Acceptance Criteria

1. QUANDO a distância acumulada é computada, ENTÃO o Activity_Tracker DEVE
   derivá-la exclusivamente de Accepted_Points, e nenhum Rejected_Point DEVE
   contribuir para a distância usada no cálculo do Average_Speed.
2. QUANDO o app exibe uma velocidade instantânea ao vivo, ENTÃO ele DEVE
   exibir a Smoothed_Speed calculada por média móvel sobre a janela de
   Accepted_Points definida no design, e NÃO DEVE exibir o valor cru de
   `speed` de uma única Raw_Location_Sample.
3. SE não há Accepted_Points suficientes para calcular a Smoothed_Speed
   conforme a janela mínima definida no design, ENTÃO o app DEVE exibir um
   indicador de indisponibilidade e NÃO DEVE exibir `NaN`, `Infinity` nem um
   valor numérico de velocidade.
4. ENQUANTO a atividade está em Auto_Pause, o app DEVE exibir a velocidade
   instantânea como zero ou como indicador de pausa, de forma consistente com
   o cronômetro parado.
5. ENQUANTO a atividade está em pausa manual, o app DEVE exibir a velocidade
   instantânea como zero ou como indicador de pausa, de forma consistente com
   o cronômetro parado.
6. QUANDO a atividade é finalizada, ENTÃO o Average_Speed exibido no resumo
   final DEVE ser calculado a partir da mesma distância validada
   (Accepted_Points) e do mesmo tempo decorrido usados durante o
   rastreamento, e o valor do resumo DEVE ser igual ao último Average_Speed
   exibido ao vivo antes da finalização, exceto por diferença de
   arredondamento de exibição.
7. SE nenhuma nova Accepted_Point é incorporada durante o intervalo de
   validade da Smoothed_Speed definido no design enquanto a atividade está
   ativa e não pausada, ENTÃO o app DEVE exibir a velocidade instantânea como
   zero ou como indicador de indisponibilidade, e NÃO DEVE continuar exibindo
   a última Smoothed_Speed calculada.

### Requirement 5: Estabilização inicial do sinal (warmup)

**User Story:** Como usuário que acabou de iniciar uma atividade, quero que
as primeiras leituras imprecisas de GPS não estraguem o começo do meu
trajeto, para que minha distância inicial não comece "torta".

#### Acceptance Criteria

1. QUANDO o rastreamento é iniciado, ENTÃO o Activity_Tracker DEVE avaliar
   cada Raw_Location_Sample recebida durante o Warmup_Period sob os mesmos
   critérios de acurácia do Point_Validation, descartando toda amostra cuja
   Accuracy_Radius exceda o limiar de acurácia configurado.
2. ENQUANTO nenhuma Raw_Location_Sample tiver atingido o limiar de acurácia
   após o início do rastreamento, o Activity_Tracker NÃO DEVE fixar uma
   primeira Accepted_Point nem contabilizar distância no trajeto.
3. QUANDO a primeira Raw_Location_Sample que satisfaz o limiar de acurácia é
   recebida dentro do Warmup_Period, ENTÃO o Activity_Tracker DEVE fixá-la
   como a primeira Accepted_Point, definindo-a como origem do trajeto.
4. ENQUANTO o Activity_Tracker estiver no Warmup_Period sem uma Accepted_Point
   fixada, o Activity_Tracker DEVE exibir ao usuário um indicador de estado
   "aguardando sinal de GPS".
5. SE o Warmup_Period exceder a duração máxima configurada sem que nenhuma
   Raw_Location_Sample atinja o limiar de acurácia, ENTÃO o Activity_Tracker
   DEVE manter o trajeto sem origem fixada e apresentar ao usuário uma
   indicação de que o sinal de GPS não foi obtido, preservando a atividade em
   andamento para nova tentativa de fixação assim que uma amostra válida
   chegar.

### Requirement 6: Indicador de qualidade do sinal GPS

**User Story:** Como usuário, quero saber quando o sinal de GPS está fraco ou
ainda estabilizando, para entender por que a distância pode não estar sendo
registrada naquele instante.

#### Acceptance Criteria

1. QUANDO uma Raw_Location_Sample é recebida durante o rastreamento ativo,
   ENTÃO o Activity_Tracker DEVE recalcular o GPS_Signal_State a partir do
   Accuracy_Radius das amostras contidas na janela recente configurada
   (número máximo de amostras ou duração máxima definidos na configuração) e
   expô-lo ao app.
2. QUANDO nenhuma Raw_Location_Sample é recebida por um intervalo maior que o
   limiar de ausência de sinal configurado durante o rastreamento ativo,
   ENTÃO o GPS_Signal_State DEVE indicar `sem_sinal`.
3. QUANDO todas as amostras da janela recente têm Accuracy_Radius maior que o
   limiar de acurácia aceitável configurado, ENTÃO o GPS_Signal_State DEVE
   indicar `fraco`.
4. QUANDO o app está no Warmup_Period e ainda não há nenhuma Accepted_Point
   fixada, ENTÃO o GPS_Signal_State DEVE indicar `aquisitando`.
5. QUANDO ao menos uma amostra da janela recente tem Accuracy_Radius menor ou
   igual ao limiar de acurácia aceitável configurado, já existe pelo menos
   uma Accepted_Point fixada, e não há condição de `sem_sinal` ativa, ENTÃO o
   GPS_Signal_State DEVE indicar `bom`.
6. QUANDO mais de uma condição de GPS_Signal_State é satisfeita
   simultaneamente, ENTÃO o Activity_Tracker DEVE aplicar a seguinte ordem
   determinística de precedência: `sem_sinal`, depois `aquisitando`, depois
   `fraco`, depois `bom`.
7. QUANDO o GPS_Signal_State indica `aquisitando`, `fraco` ou `sem_sinal`,
   ENTÃO o app DEVE apresentar ao usuário, durante o rastreamento, um
   indicador visual distinto e específico para o estado corrente.
8. QUANDO o GPS_Signal_State transita para `bom`, ENTÃO o app DEVE remover o
   indicador visual dos demais estados durante o rastreamento.

### Requirement 7: Preservação da confiabilidade de dados existente

**User Story:** Como usuário, quero que a nova filtragem não introduza perda
de dados nem regressões nos fluxos de salvamento e sincronização, para
continuar confiando que minhas atividades são registradas de forma íntegra.

#### Acceptance Criteria

1. O formato do trajeto persistido (`route_geojson` LineString) e o modelo de
   dados de `user_activities` DEVEM permanecer idênticos aos existentes antes
   da introdução da filtragem de pontos.
2. QUANDO uma atividade com pelo menos uma Accepted_Point é finalizada, ENTÃO
   o trajeto persistido e a distância persistida DEVEM ser compostos
   exclusivamente por Accepted_Points, sem incluir nenhum Rejected_Point.
3. SE uma atividade é finalizada sem nenhuma Accepted_Point fixada, ENTÃO o
   Activity_Tracker DEVE persistir a atividade com distância zero e sem
   trajeto (ou tratá-la conforme a regra de atividade demasiado curta já
   existente), nunca com `NaN` nem trajeto inválido.
4. QUANDO a atividade é retomada após restauração do estado local
   (navegação/relançamento) e há uma última Accepted_Point persistida, ENTÃO
   a referência de "última posição" para Point_Validation DEVE ser
   restabelecida a partir dessa última Accepted_Point, sem contabilizar um
   salto artificial entre a última posição antes de sair e a primeira amostra
   ao voltar.
5. SE a atividade é retomada e não há última Accepted_Point persistida
   disponível, ENTÃO o Activity_Tracker DEVE tratar a próxima amostra válida
   como nova origem de referência, sem contabilizar deslocamento contra uma
   posição inexistente.
6. QUANDO a atividade é finalizada offline e enfileirada na Sync_Queue, ENTÃO
   os dados enfileirados DEVEM ter distância e trajeto iguais aos valores já
   validados (Accepted_Points) no momento da finalização, e a sincronização
   posterior NÃO DEVE reprocessar nem alterar esses valores.
7. Os critérios de Point_Validation DEVEM produzir resultado idêntico com ou
   sem disponibilidade de rede, sem realizar nenhuma chamada de rede para
   classificar uma amostra.
