# Requirements Document

Atividade: Tempo em Movimento vs. Tempo Total

## Introduction

Hoje o OutVitar exibe, durante e após o rastreamento, um único cronômetro
(`durationSeconds`) que já **pausa** automaticamente por inatividade
(auto-pause após 15s sem deslocamento > 2m) e na pausa manual — comportamento
próximo ao "tempo em movimento" do Strava/Garmin. Falta, porém, a distinção
explícita entre dois conceitos consagrados no mercado:

- **Tempo em Movimento (Moving_Time):** cronômetro que conta apenas enquanto o
  usuário está de fato se movendo; congela na pausa manual e na auto-pausa por
  inatividade. É a métrica de esforço e a base da velocidade média.
- **Tempo Total (Elapsed_Time):** tempo corrido do início ao fim da atividade,
  contando TODAS as paradas (pausas manuais e paradas por inatividade). É uma
  métrica informativa.

Esta funcionalidade define que, **durante a gravação**, a tela mostra somente o
**Tempo em Movimento**; o **Tempo Total** fica oculto e é apresentado **apenas
no resumo ao finalizar**, como informação. Nada da confiabilidade de
rastreamento (trajeto/distância/velocidade/elevação) pode ser degradado — o
padrão de qualidade "estilo Strava" é mandatório.

## Glossary

- **Activity_Tracker:** o hook `useActivityTracker` (`src/hooks/use-activity-tracker.ts`)
  que gerencia o ciclo de vida do rastreamento.
- **Moving_Time (Tempo em Movimento):** duração em segundos que avança somente
  enquanto `status = "tracking"` e não há auto-pausa nem pausa manual.
  Corresponde ao atual `durationSeconds`/`durationRef` (o contador que já
  congela em pausa/auto-pausa).
- **Elapsed_Time (Tempo Total):** duração em segundos entre o início e o fim da
  atividade, contando todas as paradas. Derivado do tempo de relógio entre o
  primeiro ponto/instante de início e o instante de finalização.
- **Auto_Pause:** pausa automática por inatividade já existente (15s sem
  deslocamento > 2m), que congela o Moving_Time e é retomada ao detectar
  movimento.
- **Manual_Pause:** pausa acionada pelo usuário (botão), que congela o
  Moving_Time até o usuário retomar.
- **Recording_Screen:** a tela de gravação de atividade
  (`src/routes/atividade.rastrear.tsx`).
- **Activity_Summary:** o resumo apresentado ao finalizar a atividade (tela de
  atividade concluída comemorativa `/atividade/concluida/$activityId` e/ou a
  tela de detalhe `/atividade/$activityId`).
- **User_Activity:** o registro da atividade persistido no Supabase
  (`user_activities`).

## Requirements

### Requisito 1: Exibir apenas o Tempo em Movimento durante a gravação

**User Story:** Como usuário rastreando uma atividade, quero ver na tela apenas
o tempo em movimento, para que o cronômetro reflita meu esforço real e não
inclua as paradas.

#### Critérios de Aceitação

1. WHILE uma User_Activity está com `status = "tracking"`, THE Recording_Screen
   SHALL exibir o Moving_Time como o cronômetro principal, rotulado de forma
   inequívoca como tempo em movimento (ex.: "Em movimento").
2. WHILE uma User_Activity está sendo gravada (tracking ou pausada), THE
   Recording_Screen SHALL NÃO exibir o Elapsed_Time (tempo total) em nenhum
   lugar da tela.
3. WHEN ocorre Auto_Pause por inatividade, THE Activity_Tracker SHALL congelar
   o Moving_Time enquanto durar a inatividade.
4. WHEN o usuário aciona Manual_Pause, THE Activity_Tracker SHALL congelar o
   Moving_Time até o usuário retomar.
5. WHEN o movimento é retomado após Auto_Pause, OR WHEN o usuário retoma após
   Manual_Pause, THE Activity_Tracker SHALL voltar a incrementar o Moving_Time
   a partir do valor congelado (sem saltos nem reinício).

### Requisito 2: Calcular e persistir o Tempo Total

**User Story:** Como usuário, quero que o app registre o tempo total do início
ao fim da atividade, para que eu possa ver essa informação depois.

#### Critérios de Aceitação

1. THE Activity_Tracker SHALL calcular o Elapsed_Time como o tempo de relógio
   decorrido entre o início da atividade e o instante da finalização,
   incluindo todas as paradas (Manual_Pause e Auto_Pause).
2. WHEN o app fica em segundo plano e o cronômetro do sistema é suspenso, THE
   Activity_Tracker SHALL ainda assim computar o Elapsed_Time corretamente a
   partir de timestamps de relógio (não do contador incremental), de modo que
   o valor não seja subestimado.
3. THE Elapsed_Time SHALL ser sempre maior ou igual ao Moving_Time para a mesma
   atividade (invariante).
4. WHEN a atividade é finalizada, THE Activity_Tracker SHALL fornecer tanto o
   Moving_Time quanto o Elapsed_Time ao fluxo de salvamento.
5. WHEN a User_Activity é salva, THE sistema SHALL persistir o Moving_Time e o
   Elapsed_Time de forma distinta e recuperável.

### Requisito 3: Exibir o Tempo Total apenas no resumo final

**User Story:** Como usuário, ao finalizar a atividade, quero ver o tempo total
como informação, para comparar com o tempo em movimento.

#### Critérios de Aceitação

1. WHEN a atividade é finalizada e o Activity_Summary é exibido, THE sistema
   SHALL apresentar o Moving_Time e o Elapsed_Time de forma distinta e
   rotulada (ex.: "Em movimento" e "Tempo total").
2. WHERE o Elapsed_Time é igual ao Moving_Time (nenhuma parada ocorreu), THE
   Activity_Summary SHALL ainda assim exibir ambos sem inconsistência (valores
   iguais são válidos).
3. THE tela de detalhe da atividade (`/atividade/$activityId`) SHALL exibir o
   Moving_Time e o Elapsed_Time a partir dos valores persistidos.
4. THE cálculo de velocidade média SHALL continuar usando o Moving_Time como
   base (mantendo o comportamento atual que evita inflar a velocidade).

### Requisito 4: Preservar a integridade do rastreamento

**User Story:** Como usuário, quero que essa mudança não afete a precisão do
trajeto, distância, velocidade e elevação já existentes.

#### Critérios de Aceitação

1. THE mudança SHALL NÃO alterar a lógica de captura/validação de pontos,
   cálculo de distância, velocidade instantânea suavizada ou ganho de
   elevação.
2. THE mudança SHALL preservar o comportamento de auto-pausa e pausa manual já
   existentes (thresholds, precedência de ação manual sobre auto-pausa).
3. WHERE existirem atividades salvas antes desta funcionalidade (sem
   Elapsed_Time persistido), THE tela de detalhe SHALL exibir o tempo
   disponível sem erro (retrocompatibilidade), tratando a ausência de
   Elapsed_Time de forma graciosa.
4. THE mudança SHALL NÃO exigir reescrita do `useActivityTracker`; deve
   estendê-lo, conforme a diretriz do projeto de não reescrever o rastreamento.
