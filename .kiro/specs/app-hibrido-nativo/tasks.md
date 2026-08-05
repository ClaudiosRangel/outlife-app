# Implementation Plan: app-hibrido-nativo

## Overview

Este plano converte o design em passos incrementais de código. A ordem segue a dependência técnica real: primeiro os dois alvos de build e o seletor de transporte (base para tudo que roda no shell nativo), depois o plugin nativo de localização e sua integração em `use-activity-tracker.ts`, em seguida a fila de sincronização, tipo de atividade/métricas, snapshot do mapa, banners de compartilhamento, categorias de comunidade, e por fim push nativo/Web Push e o proxy do Google Places. Cada correctness property do design.md é implementada como um teste de propriedade (fast-check) próximo da implementação que ela valida, referenciando o número da property e a cláusula de requirement correspondente. Linguagem: TypeScript (código compartilhado/web), Kotlin (Android) e Swift (iOS) para o plugin Capacitor, SQL (migrations Postgres/Supabase) — todas já em uso no `OutLife_Repository`, sem necessidade de escolha adicional de linguagem.

## Tasks

- [x] 1. Configurar os dois alvos de build e o seletor de transporte para server functions
  - [x] 1.1 Modificar `vite.config.ts` para alternar entre `SSR_Build_Target` e `SPA_Build_Target`
    - Ler `process.env.BUILD_TARGET` (`"ssr"` default | `"native-spa"`); quando `"native-spa"`, remover `tanstackStart`/`nitro` dos plugins e manter apenas `tsConfigPaths`, `tailwindcss`, `react`; definir `build.outDir = "dist/native-spa"` e injetar `import.meta.env.VITE_BUILD_TARGET` via `define`
    - _Requirements: 1.2, 1.6_
  - [x] 1.2 Adicionar script `build:native` e variáveis de ambiente
    - Adicionar `"build:native": "cross-env BUILD_TARGET=native-spa vite build"` e dependência `cross-env` (versão fixa) em `package.json`; adicionar `VITE_API_BASE_URL` e `VITE_BUILD_TARGET` de exemplo em `.env.example`
    - _Requirements: 1.2, 1.6_
  - [x] 1.3 Extrair lógica interna reutilizável do Google Places em `src/services/places.server.ts`
    - Renomear/expor `fetchDestinationsHandler`/`fetchPlacesPhotosHandler` já existentes como as funções internas reutilizadas tanto pela server function `createServerFn` quanto pelos futuros endpoints HTTP (task 13), sem duplicar lógica
    - _Requirements: 1.6, 12.1_
  - [x] 1.4 Implementar o branch de transporte em `src/services/external-api.ts`
    - `fetchDestinationsFromGoogle`/`fetchPlacesPhotos` passam a checar `import.meta.env.VITE_BUILD_TARGET === "native"`: nesse caso chamam `fetch()` contra `${VITE_API_BASE_URL}/api/places/search` ou `/api/places/photos` com timeout de 10s via um helper `fetchWithTimeoutAndFallback` (resolve sempre com `[]` em timeout/erro, nunca lança); caso contrário, mantêm a chamada local já existente à server function
    - _Requirements: 1.6, 1.7, 12.5_
  - [ ]* 1.5 Escrever property test para equivalência de transporte
    - **Property 1: Chamada remota equivalente à server function local**
    - **Validates: Requirements 1.6**
    - Arquivo `tests/property/places-proxy-transport.property.test.ts`; mockar `fetch` para retornar a mesma fonte de dados usada por `fetchDestinationsHandler`/`fetchPlacesPhotosHandler` e comparar estrutura do resultado entre as duas estratégias
  - [ ]* 1.6 Escrever property test para resiliência do lado cliente do proxy
    - **Property 32: Falha ou timeout do proxy do Google Places sempre resolve com resultado vazio**
    - **Validates: Requirements 12.5**
    - Arquivo `tests/property/places-proxy-transport.property.test.ts` (mesmo arquivo da task 1.5); simular timeout acima de 10s, erro de rede e erro HTTP, sempre resolvendo com `[]` sem lançar
  - [x] 1.7 Implementar modelo puro de estado de tela para preservação em falha
    - `src/lib/destination-search-state.ts`: função pura `applySearchOutcome(previousState, outcome)` que, dado um estado de tela válido (resultados já carregados) e um resultado de busca (sucesso ou erro), retorna o novo estado — em caso de erro, retorna o mesmo estado anterior acrescido apenas de um campo de erro observável, nunca descartando os resultados já carregados
    - _Requirements: 1.7_
  - [ ]* 1.8 Escrever property test para preservação de estado em falha de rede
    - **Property 2: Falha de rede preserva estado da tela anterior**
    - **Validates: Requirements 1.7**
    - Arquivo `tests/property/places-proxy-error-state.property.test.ts`

- [x] 2. Criar o plugin Capacitor `Native_Location_Tracking_Module`
  - [x] 2.1 Inicializar o pacote `native/capacitor-location-tracking` seguindo o template `@capacitor/plugin`
    - `native/capacitor-location-tracking/package.json` (nome `@outlife/capacitor-location-tracking`, versões fixas), `src/definitions.ts` com a interface `LocationTrackingPlugin` (`requestBackgroundPermission`, `checkBackgroundPermission`, `startTracking`, `stopTracking`, eventos `locationUpdate`/`permissionRevoked`), `src/index.ts` registrando o plugin via `registerPlugin`, `src/web.ts` com uma implementação web de fallback baseada em `navigator.geolocation` (usada apenas fora do shell nativo, nunca chamada quando `Capacitor.isNativePlatform()` é `true`)
    - _Requirements: 2.1, 2.5_
  - [x] 2.2 Implementar o módulo Android (Kotlin) do plugin
    - `native/capacitor-location-tracking/android/.../LocationTrackingPlugin.kt` e um `ForegroundService` dedicado (`foregroundServiceType="location"`), usando `FusedLocationProviderClient` com `PRIORITY_HIGH_ACCURACY`, intervalo mínimo de 5s/10m, notificação persistente em canal "Rastreamento ativo" enquanto o serviço roda, e emissão do evento `locationUpdate`; declarar permissões `ACCESS_BACKGROUND_LOCATION`/`FOREGROUND_SERVICE_LOCATION` no `AndroidManifest.xml`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_
  - [x] 2.3 Implementar o módulo iOS (Swift) do plugin
    - `native/capacitor-location-tracking/ios/Plugin/LocationTrackingPlugin.swift`, usando `CLLocationManager` com `allowsBackgroundLocationUpdates = true`, `desiredAccuracy` alta, distância/intervalo mínimos equivalentes (5s/10m), e emissão dos eventos `locationUpdate`/`permissionRevoked`; adicionar `NSLocationAlwaysAndWhenInUseUsageDescription` e a capability `Background Modes → Location updates` no `Info.plist`
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 2.7_
  - [x] 2.4 Registrar o plugin no monorepo e inicializar o shell Capacitor
    - Adicionar `@outlife/capacitor-location-tracking` (workspace local), `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios`, `@capacitor/push-notifications`, `@capacitor/app` (versões fixas) em `package.json`; criar `capacitor.config.ts` na raiz apontando `webDir` para `dist/native-spa`
    - _Requirements: 1.3, 2.1_

- [x] 3. Integrar o rastreamento nativo, checkpoint de persistência e recuperação em `use-activity-tracker.ts`/`activity-storage.ts`
  - [x] 3.1 Extrair a lógica pura do Location_Persistence_Checkpoint
    - `src/lib/location-checkpoint.ts`: função pura `shouldCheckpoint({ lastCheckpointTs, lastCheckpointDistanceAccum, nowTs, distanceAccum })` que retorna `true` se e somente se ao menos 10s ou 50m tiverem transcorrido desde o último checkpoint
    - _Requirements: 3.1_
  - [ ]* 3.2 Escrever property test do checkpoint de persistência
    - **Property 6: Checkpoint de persistência dispara exatamente a cada 10s ou 50m**
    - **Validates: Requirements 3.1**
    - Arquivo `tests/property/location-checkpoint.property.test.ts`
  - [x] 3.3 Ramificar a fonte de localização em `use-activity-tracker.ts` por `Capacitor.isNativePlatform()`
    - `startWatch`/`stopWatch` passam a chamar `LocationTracking.startTracking`/`stopTracking` (mockável via `vi.mock("@outlife/capacitor-location-tracking")`) quando nativo, registrando o listener `locationUpdate` que alimenta o mesmo `pointsRef`/`setPoints`/`distanceRef` já existentes; fora do shell, mantém `navigator.geolocation.watchPosition` inalterado; usar `shouldCheckpoint` (task 3.1) para decidir quando chamar `persist()` em vez do `points.length % 10 === 0` atual
    - _Requirements: 2.1, 2.5, 3.1_
  - [ ]* 3.4 Escrever property test da seleção exclusiva de estratégia de localização
    - **Property 3: Seleção exclusiva de estratégia de localização**
    - **Validates: Requirements 2.5**
    - Arquivo `tests/property/location-tracking-strategy.property.test.ts`
  - [x] 3.5 Implementar checagem/bloqueio de permissão de localização em segundo plano antes do início do rastreamento
    - Em `use-activity-tracker.ts`/`atividade.rastrear.tsx`: quando nativo, `start()` chama `checkBackgroundPermission()`; se não concedida, chama `requestBackgroundPermission()`; se ainda não concedida, bloqueia o início e expõe um estado (`permissionDenied`, já existente) para exibir a mensagem explicativa antes de qualquer tentativa
    - _Requirements: 2.6_
  - [ ]* 3.6 Escrever property test de permissão de localização
    - **Property 4: Início de rastreamento respeita o estado de permissão de localização**
    - **Validates: Requirements 2.6**
    - Arquivo `tests/property/location-tracking-strategy.property.test.ts` (mesmo arquivo da task 3.4)
  - [x] 3.7 Implementar o listener `permissionRevoked` interrompendo a captura sem descartar pontos
    - Registrar `LocationTracking.addListener("permissionRevoked", ...)` em `use-activity-tracker.ts`: interrompe a captura de novos pontos (sem chamar `stopTracking` destrutivamente sobre os pontos já em `pointsRef`), expõe um novo estado `revokedDuringTracking` consumido por `atividade.rastrear.tsx` para informar o usuário, preservando os pontos já persistidos
    - _Requirements: 2.7_
  - [ ]* 3.8 Escrever property test de revogação de permissão durante rastreamento
    - **Property 5: Revogação de permissão durante rastreamento preserva pontos já persistidos**
    - **Validates: Requirements 2.7**
    - Arquivo `tests/property/location-tracking-strategy.property.test.ts` (mesmo arquivo das tasks 3.4/3.6)
  - [x] 3.9 Adicionar validação de schema em `loadActive` (`activity-storage.ts`) para dados corrompidos
    - Validar o formato de `ActivePersisted` lido (`points`/`distance`/`duration`/`status`); se malformado, retornar um valor sinalizando estado "não recuperável" (ex.: `{ corrupted: true }` em vez do objeto original) em vez de lançar ou retornar dados parciais
    - _Requirements: 3.4_
  - [ ]* 3.10 Escrever property test de dados corrompidos
    - **Property 9: Dados corrompidos nunca produzem métricas derivadas**
    - **Validates: Requirements 3.4**
    - Arquivo `tests/property/activity-recovery.property.test.ts`
  - [ ]* 3.11 Escrever property test de round-trip de persistência da atividade ativa
    - **Property 8: Round-trip de persistência de atividade ativa**
    - **Validates: Requirements 3.3**
    - Arquivo `tests/property/activity-recovery.property.test.ts` (mesmo arquivo da task 3.10)
  - [x] 3.12 Ajustar o fluxo de atividade órfã em `use-activity-tracker.ts`/`atividade.rastrear.tsx` para expor estado de decisão pendente
    - Garantir que `hasOrphan`/`restoreOrphan`/`discard` (já existentes) preservem os pontos persistidos inalterados até uma ação explícita do usuário, e que o estado "não recuperável" da task 3.9 leve a UI a oferecer apenas descartar (sem exibir distância/duração/trajeto)
    - _Requirements: 3.4, 3.5_
  - [ ]* 3.13 Escrever property test de atividade recuperada com decisão pendente
    - **Property 10: Atividade recuperada expõe estado de decisão pendente sem alterar os pontos**
    - **Validates: Requirements 3.5**
    - Arquivo `tests/property/activity-recovery.property.test.ts` (mesmo arquivo das tasks 3.10/3.11)
  - [ ]* 3.14 Escrever property test de distância/duração nunca maiores que os pontos persistidos
    - **Property 11: Distância/duração exibidas nunca excedem os pontos persistidos**
    - **Validates: Requirements 3.6**
    - Arquivo `tests/property/activity-recovery.property.test.ts` (mesmo arquivo das tasks 3.10/3.11/3.13)
  - [ ]* 3.15 Escrever property test de falha intercalada na persistência local
    - **Property 7: Falha de persistência local nunca perde pontos capturados**
    - **Validates: Requirements 3.2**
    - Arquivo `tests/property/location-checkpoint.property.test.ts` (mesmo arquivo da task 3.2); simular `saveActive` falhando em checkpoints intercalados e verificar que todo ponto capturado aparece na próxima tentativa bem-sucedida

- [x] 4. Checkpoint — Garantir que todos os testes passam
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Estender a `Activity_Sync_Queue` com timeout, retry e indicador visual
  - [x] 5.1 Adicionar timeout explícito de 15s em `flushQueue` (`activity-storage.ts`)
    - Implementar `withTimeout<T>(p, ms)` e envolver as chamadas a `startActivity`/`finishActivity` dentro de `flushQueue` com `SYNC_TIMEOUT_MS = 15_000`; timeout deve contar como falha (mantém item na fila, incrementa `attempts`)
    - _Requirements: 5.2, 5.3_
  - [x] 5.2 Adicionar retry de até 3 tentativas em `enqueueActivity` (`activity-storage.ts`)
    - Envolver `queueStore.setItem` em um laço de até 3 tentativas; lançar erro somente após a 3ª falha, para a UI chamadora exibir a mensagem de erro
    - _Requirements: 5.9_
  - [x] 5.3 Implementar `useSyncQueueSize()` (`src/hooks/use-sync-queue-size.ts`)
    - Hook que lê `listQueued().length` e faz polling leve (5s) enquanto a fila não estiver vazia, expondo `{ size, isPending }`
    - _Requirements: 5.6_
  - [x] 5.4 Exibir o indicador visual de fila pendente na UI global
    - Consumir `useSyncQueueSize()` em `src/components/StatusBar.tsx` (ou `BottomNav.tsx`, componente já renderizado em todas as telas autenticadas), exibindo um badge/indicador quando `size > 0`
    - _Requirements: 5.6_
  - [ ]* 5.5 Escrever property test de falha na finalização sempre enfileirando
    - **Property 15: Falha na finalização sempre resulta em enfileiramento, nunca em perda**
    - **Validates: Requirements 5.1**
    - Arquivo `tests/property/activity-sync-queue.property.test.ts`
  - [ ]* 5.6 Escrever property test do comportamento determinístico de `flushQueue`
    - **Property 16: Comportamento de `flushQueue` por item é determinístico**
    - **Validates: Requirements 5.2, 5.3, 5.4**
    - Arquivo `tests/property/activity-sync-queue.property.test.ts` (mesmo arquivo da task 5.5)
  - [ ]* 5.7 Escrever property test do indicador de fila pendente
    - **Property 17: Indicador de fila pendente reflete exatamente o estado da fila**
    - **Validates: Requirements 5.6**
    - Arquivo `tests/property/activity-sync-queue.property.test.ts` (mesmo arquivo das tasks 5.5/5.6)
  - [ ]* 5.8 Escrever property test de recuperação pós-interrupção sem exigir novo rastreamento
    - **Property 18: Recuperação pós-interrupção conclui persistência sem exigir novo rastreamento**
    - **Validates: Requirements 5.7**
    - Arquivo `tests/property/activity-sync-queue.property.test.ts` (mesmo arquivo das tasks 5.5/5.6/5.7)
  - [ ]* 5.9 Escrever property test do limite de 3 tentativas no enfileiramento
    - **Property 19: Retry de enfileiramento é limitado a 3 tentativas**
    - **Validates: Requirements 5.9**
    - Arquivo `tests/property/activity-sync-queue.property.test.ts` (mesmo arquivo das tasks 5.5/5.6/5.7/5.8)
  - [ ]* 5.10 Escrever unit test do listener `online` chamando `flushQueue` exatamente uma vez
    - Reaproveitar `tests/integration/signup-flow.test.ts` como referência de padrão; testar `useActivitySync` (`src/hooks/use-activity-sync.ts`) disparando o evento `online` do `window` e verificando exatamente uma chamada a `flushQueue`
    - _Requirements: 5.8_

- [x] 6. Implementar Activity_Type e métricas de pace/velocidade
  - [x] 6.1 Criar migration `activity_type` + `map_snapshot_url` e estender `finish_user_activity`/criar `start_user_activity`
    - `supabase/migrations/<timestamp>_activity-type-and-map-snapshot.sql`: `ALTER TABLE user_activities ADD COLUMN activity_type TEXT` com `CHECK (activity_type IN ('caminhada','pedalada','trilha','outro'))`, `ADD COLUMN map_snapshot_url TEXT`; estender `finish_user_activity` com `_activity_type`/`_map_snapshot_url` opcionais (mesmo padrão incremental de `20260719090000_activity-description-and-image.sql`); persistir `activity_type` também no `INSERT` feito por `startActivity` (via novo parâmetro opcional em vez de RPC, já que hoje é um `insert` direto)
    - _Requirements: 4.3, 6.1_
  - [x] 6.2 Implementar `src/lib/activity-metrics.ts`
    - Função pura `computeActivityMetrics({ activityType, distanceMeters, durationSeconds })` retornando `{ averageSpeedKmh: string | null, averagePaceLabel: string | null }`: `averageSpeedKmh` sempre calculado (1 casa decimal) quando `durationSeconds > 0` e distância válida; `averagePaceLabel` (`mm:ss/km`) apenas quando `activityType` for `caminhada`/`pedalada`; ambos retornam indicador tipado de indisponível (nunca `NaN`/`Infinity`) quando `durationSeconds === 0` ou distância inválida
    - _Requirements: 4.4, 4.5, 4.6, 4.7_
  - [ ]* 6.3 Escrever property test do cálculo de métricas
    - **Property 14: Cálculo de pace/velocidade é correto e exibido condicionalmente**
    - **Validates: Requirements 4.4, 4.5, 4.6, 4.7**
    - Arquivo `tests/property/activity-metrics.property.test.ts`
  - [x] 6.4 Adicionar seletor de Activity_Type obrigatório em `atividade.rastrear.tsx`
    - Novo `<Select>` (mesmo padrão do seletor de categoria em `comunidade.tsx`) exibido antes do botão "Iniciar"; `start()` só é chamado quando um valor válido (`caminhada`/`pedalada`/`trilha`/`outro`) estiver selecionado, exibindo mensagem obrigatória caso contrário
    - _Requirements: 4.1, 4.2_
  - [ ]* 6.5 Escrever property test da exigência de Activity_Type válido
    - **Property 12: Início de rastreamento exige Activity_Type válido**
    - **Validates: Requirements 4.1, 4.2**
    - Arquivo `tests/property/activity-type-selection.property.test.ts`
  - [x] 6.6 Ligar `activity_type` em `startActivity`/`finishActivity` (`src/lib/api.ts`) e no fluxo de `atividade.rastrear.tsx`
    - `startActivity(destinationId, activityType)` grava a coluna no `insert`; `finishActivity` passa `_activity_type`/`_map_snapshot_url` para a RPC; `UserActivity` (tipo) ganha os dois novos campos
    - _Requirements: 4.3_
  - [ ]* 6.7 Escrever property test de round-trip de persistência do Activity_Type
    - **Property 13: Round-trip de persistência do Activity_Type**
    - **Validates: Requirements 4.3**
    - Arquivo `tests/property/activity-type-selection.property.test.ts` (mesmo arquivo da task 6.5); mockar o cliente Supabase para validar que o valor gravado é o mesmo lido de volta, mesmo padrão de mock já usado em `tests/property/user-data-functions.property.test.ts`
  - [x] 6.8 Exibir Average_Pace/Average_Speed em tempo real (`atividade.rastrear.tsx`) e final (`atividade.$activityId.tsx`)
    - Consumir `computeActivityMetrics` a cada 1s durante o rastreamento (live) e a partir dos totais persistidos na `Activity_Detail_Screen`; exibir indicador textual distinto ("—" ou similar) quando indisponível, em vez de um valor calculado
    - _Requirements: 4.4, 4.5, 4.6, 4.7_
  - [ ]* 6.9 Escrever unit test de presença/ordem do seletor de Activity_Type
    - Verificar que as opções Caminhada/Pedalada/Trilha/Outro aparecem no formulário de início do rastreamento
    - _Requirements: 4.1_

- [x] 7. Implementar o Activity_Map_Snapshot
  - [x] 7.1 Implementar `src/lib/activity-map-snapshot.ts`
    - `generateActivityMapSnapshot(points)`: retorna `null` se `points.length < 2`; caso contrário calcula bounding box/zoom, desenha os tiles OSM correspondentes e a polyline do trajeto (mesma lógica visual de `ActivityMap.tsx`) num `<canvas>` offscreen, retornando `canvas.toBlob("image/webp", 0.85)`
    - _Requirements: 6.1_
  - [x] 7.2 Implementar `uploadActivityMapSnapshot` em `src/lib/api.ts`
    - Mesmo padrão de `uploadActivityImage`: valida tipo/tamanho, faz upload para o bucket `activity-images` já existente, retorna a URL pública
    - _Requirements: 6.1_
  - [x] 7.3 Integrar geração/upload do snapshot em `atividade.rastrear.tsx` (`finishMut`)
    - Após `tracker.finalize()` e antes/em paralelo ao upload da foto: `try { const blob = await generateActivityMapSnapshot(result.points); if (blob) map_snapshot_url = await uploadActivityMapSnapshot(blob); } catch { /* Requirement 6.3 */ }`; `finishActivity` prossegue mesmo se a geração falhar
    - _Requirements: 6.1, 6.3_
  - [ ]* 7.4 Escrever property test de resiliência do snapshot
    - **Property 20: Ausência ou falha de Activity_Map_Snapshot nunca bloqueia persistência ou exibição**
    - **Validates: Requirements 6.3, 6.4**
    - Arquivo `tests/property/activity-map-snapshot-resilience.property.test.ts`
  - [x] 7.5 Exibir o Activity_Map_Snapshot na `Activity_Detail_Screen` (`atividade.$activityId.tsx`)
    - Renderização condicional: quando `activity.map_snapshot_url` presente e carregável, exibir junto com métricas/descrição/foto; quando ausente/corrompido, exibir o restante normalmente sem mensagem de erro
    - _Requirements: 6.2, 6.4_
  - [ ]* 7.6 Escrever unit test de renderização condicional do snapshot
    - Testar `atividade.$activityId.tsx` com/sem `map_snapshot_url`
    - _Requirements: 6.2, 6.4_

- [x] 8. Checkpoint — Garantir que todos os testes passam
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implementar o Banner_Generator (atividade e publicação da comunidade)
  - [x] 9.1 Estender `shareContent` (`src/lib/share.ts`) para aceitar arquivos
    - Novo tipo de união `ShareContentInput` (`{ url }` existente | `{ file: Blob; fileName: string }` novo); quando `file`, chamar `navigator.share({ files: [new File([file], fileName, { type: file.type })] })`; fallback via `navigator.canShare({ files })` falso → download por `<a download>` + toast, preservando o comportamento de sucesso/erro/cancelamento já existente
    - _Requirements: 7.6_
  - [x] 9.2 Implementar `src/lib/banner-generator.ts` — composição pura e truncamento
    - `truncateForBanner(text, maxLength = 200)`; helper interno `withRenderTimeout(promise, ms)` retornando/rejeitando com `BannerTimeoutError` tipado; funções `generateActivityBanner(input, { timeoutMs: 5000 })` e `generatePostBanner(input, { timeoutMs: 10000 })` compondo camadas em `<canvas>` (mapa/foto de fundo + textos de métricas ou categoria/texto), com fallback de imagem padrão quando `photoUrl` ausente
    - _Requirements: 7.2, 7.3, 7.7, 10.2, 10.4, 10.5_
  - [ ]* 9.3 Escrever property test de composição do banner de atividade dentro do prazo
    - **Property 21: Geração de banner de atividade compõe todas as camadas disponíveis dentro do prazo**
    - **Validates: Requirements 7.2, 7.3**
    - Arquivo `tests/property/banner-generator.property.test.ts`
  - [ ]* 9.4 Escrever property test de falha na geração nunca acionando compartilhamento incompleto
    - **Property 22: Falha na geração de banner nunca aciona compartilhamento com resultado incompleto**
    - **Validates: Requirements 7.7, 10.4**
    - Arquivo `tests/property/banner-generator.property.test.ts` (mesmo arquivo da task 9.3)
  - [ ]* 9.5 Escrever property test de truncamento de texto do banner de publicação
    - **Property 23: Truncamento de texto do banner de publicação respeita o limite de 200 caracteres**
    - **Validates: Requirements 10.2**
    - Arquivo `tests/property/banner-generator.property.test.ts` (mesmo arquivo das tasks 9.3/9.4)
  - [ ]* 9.6 Escrever property test de isolamento de falha não relacionada durante compartilhamento de post
    - **Property 24: Falha em funcionalidade não relacionada nunca impede o compartilhamento do banner de publicação**
    - **Validates: Requirements 10.3**
    - Arquivo `tests/property/banner-generator.property.test.ts` (mesmo arquivo das tasks 9.3/9.4/9.5)
  - [x] 9.7 Adicionar ação de compartilhar banner na `Activity_Detail_Screen` (`atividade.$activityId.tsx`)
    - Botão que chama `generateActivityBanner` com os dados da atividade, exibe indicador de progresso durante a geração, e em sucesso chama `shareContent({ file, fileName, title })`; em falha exibe toast de erro reexecutável
    - _Requirements: 7.1, 7.2, 7.4, 7.5, 7.7_
  - [x] 9.8 Adaptar `handleShare` em `comunidade.tsx` para gerar e compartilhar o banner do post
    - Reaproveitar o botão de compartilhar já existente no card: chamar `generatePostBanner` com foto/categoria/texto do post, e `shareContent` com o blob resultante; qualquer função não relacionada (ex.: registro de estatística futura) deve ser envolta em `try/catch` isolado, sem impedir a chamada a `shareContent`
    - _Requirements: 10.1, 10.3_
  - [ ]* 9.9 Escrever unit tests de indicador de progresso e integração com `shareContent`
    - Indicador visual durante geração do banner de atividade (7.4); spy de `shareContent` confirmando chamada com o `Blob` gerado após sucesso (7.5); botão de compartilhar presente no card de post (10.1)
    - _Requirements: 7.4, 7.5, 10.1_

- [x] 10. Estender Community_Post_Category com Pedalada e Caminhada
  - [x] 10.1 Criar migration estendendo o CHECK constraint de `community_posts.category`
    - `supabase/migrations/<timestamp>_community-post-category-pedalada-caminhada.sql`, seguindo o mesmo padrão incremental de `20260720090000_community-post-category.sql`: `DROP CONSTRAINT`/`ADD CONSTRAINT community_posts_category_check CHECK (category IN ('trilha','camping','relato','outro','pedalada','caminhada'))`
    - _Requirements: 8.1_
  - [x] 10.2 Estender `CommunityPostCategory` (`src/lib/api.ts`) e o formulário/abas em `comunidade.tsx`
    - `CommunityPostCategory` ganha `"pedalada" | "caminhada"`; `CommunityTab` ganha `"biking" | "walking"`; `TAB_TO_CATEGORY` ganha `biking: "pedalada"`, `walking: "caminhada"`; adicionar as duas novas `<SelectItem>` (nessa ordem) no formulário de criação e as duas novas abas (nessa ordem, após as existentes) no menu de filtro
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6_
  - [ ]* 10.3 Escrever property test de validação do conjunto de categorias válidas
    - **Property 25: Validação de Community_Post_Category aceita exatamente o conjunto de valores válidos**
    - **Validates: Requirements 8.1**
    - Arquivo `tests/property/community-post-category-filter.property.test.ts`
  - [ ]* 10.4 Escrever property test do filtro exclusivo por aba
    - **Property 26: Filtro por aba retorna exclusivamente posts da categoria correspondente**
    - **Validates: Requirements 8.4, 8.5, 8.6**
    - Arquivo `tests/property/community-post-category-filter.property.test.ts` (mesmo arquivo da task 10.3); testar `filterPostsByTab` diretamente
  - [x] 10.5 Implementar `src/lib/community-category-label.ts` e a chave i18n de categoria não especificada
    - `communityCategoryTranslationKey(category)` retornando `community.categories.<valor>` para os 6 valores conhecidos, ou `community.categories.unspecified` para ausente/desconhecido; adicionar a nova chave `community.categories.unspecified` (e `community.categories.pedalada`/`community.categories.caminhada`) em `public/locales/pt-BR/translation.json` e `public/locales/en/translation.json`
    - _Requirements: 9.2, 9.3_
  - [ ]* 10.6 Escrever property test de consistência do rótulo de categoria
    - **Property 27: Rótulo de categoria no card é consistente com o seletor e nunca fica vazio**
    - **Validates: Requirements 9.1, 9.2, 9.3**
    - Arquivo `tests/property/community-category-label.property.test.ts`
  - [x] 10.7 Renderizar o rótulo de categoria no card de post (`comunidade.tsx`)
    - Adicionar `<span>{t(communityCategoryTranslationKey(p.category))}</span>` em posição fixa/visível do card, usando `SelectItem` do formulário como mesma fonte de tradução
    - _Requirements: 9.1_
  - [ ]* 10.8 Escrever unit test de presença/ordem das novas opções e abas
    - Verificar Pedalada/Caminhada nessa ordem no formulário de criação e no menu de abas
    - _Requirements: 8.2, 8.3_

- [x] 11. Checkpoint — Garantir que todos os testes passam
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implementar push nativo, Web Push e o disparo centralizado no Postgres
  - [x] 12.1 Criar migration das tabelas `native_push_tokens`/`web_push_subscriptions` com RLS
    - `supabase/migrations/<timestamp>_native-and-web-push-tokens.sql`: as duas tabelas exatamente como especificado no design (`UNIQUE (user_id, device_id)` / `UNIQUE (user_id, endpoint)`, RLS restrita a `auth.uid() = user_id`)
    - _Requirements: 11.1, 11.2_
  - [x] 12.2 Criar migration de `fn_dispatch_push_notification` + trigger em `notifications`
    - Mesmo arquivo ou um novo `supabase/migrations/<timestamp>_fn-dispatch-push-notification.sql`: função `SECURITY DEFINER` que itera tokens/subscriptions ativos do `NEW.recipient_id`, cada envio em bloco `BEGIN...EXCEPTION WHEN OTHERS THEN NULL`, chamando stubs `fn_send_native_push`/`fn_send_web_push` (implementados como funções Postgres que disparam a chamada HTTP via `pg_net` para FCM/APNs/Web Push); `CREATE TRIGGER trg_dispatch_push_notification AFTER INSERT ON public.notifications`
    - _Requirements: 11.3, 11.4, 11.6_
  - [x] 12.3 Implementar `src/lib/push-registration.ts`
    - `registerPushForCurrentPlatform()`: nativo (via `@capacitor/push-notifications`) solicita permissão, registra, e no listener `registration` chama `registerNativePushToken`; fora do shell, checa `isIosBrowserWithoutInstalledPwa()` (nova função pura de detecção de plataforma/instalação) antes de solicitar permissão Web Push e assinar via `pushManager.subscribe`
    - _Requirements: 11.1, 11.2, 11.7_
  - [ ]* 12.4 Escrever property test de elegibilidade de registro de Web Push
    - **Property 28: Registro de Web_Push_Subscription respeita a restrição de iOS sem PWA instalada**
    - **Validates: Requirements 11.2, 11.7**
    - Arquivo `tests/property/push-registration-eligibility.property.test.ts`; testar a função pura de decisão (plataforma × instalação × suporte × permissão) extraída de `registerPushForCurrentPlatform`
  - [x] 12.5 Implementar os endpoints `src/routes/api.push.register-native.ts` e `api.push.register-web.ts`
    - TanStack Start API routes que validam a sessão autenticada e fazem upsert em `native_push_tokens`/`web_push_subscriptions` associado ao `user_id`; funções `registerNativePushToken`/`registerWebPushSubscription` em `push-registration.ts` chamam esses endpoints via `fetch` quando `VITE_BUILD_TARGET === "native"`, mesmo padrão do proxy do Google Places (task 13)
    - _Requirements: 11.1, 11.2_
  - [x] 12.6 Implementar `invalidatePushRegistration` e ligá-la a logout/revogação de permissão
    - `push-registration.ts`: `invalidatePushRegistration()` faz `UPDATE ... SET is_active = false` restrito ao `user_id`+dispositivo corrente (nunca `DELETE`); chamar em `handleSignOut` (`src/routes/perfil.tsx`) e no listener de permissão revogada do plugin de push
    - _Requirements: 11.8_
  - [ ]* 12.7 Escrever property test de isolamento do disparo de push por destino
    - **Property 29: Disparo de push é isolado por destino e nunca impede a Notification in-app**
    - **Validates: Requirements 11.3, 11.6**
    - Arquivo `tests/property/push-dispatch-and-invalidation.property.test.ts`; espelhar a lógica de `fn_dispatch_push_notification` como função pura testável em TypeScript (mesmo padrão de `tests/property/achievement-rules.property.test.ts`, documentando a limitação de não executar a função SQL real quando não houver Postgres local disponível)
  - [ ]* 12.8 Escrever property test de invalidação isolada por registro
    - **Property 30: Invalidação de token/subscription afeta exclusivamente o registro correspondente**
    - **Validates: Requirements 11.8**
    - Arquivo `tests/property/push-dispatch-and-invalidation.property.test.ts` (mesmo arquivo da task 12.7)
  - [x] 12.9 Implementar navegação por deep-link ao selecionar uma Push_Notification
    - Registrar listener de `@capacitor/push-notifications` (ação de toque) e do evento de clique do Web Push (`notificationclick` no service worker) navegando para `/notificacoes`, tanto em cold start quanto em background
    - _Requirements: 11.5_
  - [ ]* 12.10 Escrever unit test de navegação por deep-link de push
    - Verificar que o clique na notificação (nativa e Web Push) navega para `/notificacoes`
    - _Requirements: 11.5_

- [x] 13. Implementar o proxy remoto do Google Places para o `SPA_Build_Target`
  - [x] 13.1 Implementar `requireSupabaseAuthFromRequest`
    - Helper em `src/services/places.server.ts` (ou novo `src/lib/require-supabase-auth.ts`) que valida o header `Authorization: Bearer <token>` contra o Supabase Auth, retornando o usuário autenticado ou lançando/rejeitando com 401
    - _Requirements: 12.4_
  - [x] 13.2 Implementar `src/routes/api.places.search.ts` e `src/routes/api.places.photos.ts`
    - TanStack Start API routes (`POST`) que chamam `requireSupabaseAuthFromRequest`, então delegam para `fetchDestinationsHandler`/`fetchPlacesPhotosHandler` (task 1.3), respondendo com cabeçalhos CORS permitindo a origem do shell nativo e timeout interno de 10s
    - _Requirements: 12.1, 12.2, 12.3_
  - [ ]* 13.3 Escrever property test de autorização do endpoint
    - **Property 31: Autorização do endpoint de proxy do Google Places é estritamente por sessão válida**
    - **Validates: Requirements 12.4**
    - Arquivo `tests/property/places-proxy-authorization.property.test.ts`
  - [ ]* 13.4 Escrever smoke test de ausência da credencial no bundle e cabeçalhos CORS
    - Reaproveitando o padrão já usado em `outlife-production-plan` (busca por `GOOGLE_PLACES_API_KEY`/valor real no bundle estático gerado por `build:native`); verificar que a resposta dos endpoints inclui os cabeçalhos CORS esperados
    - _Requirements: 12.2, 12.3_

- [x] 14. Checkpoint final — Garantir que todos os testes passam
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tarefas marcadas com `*` são de teste, opcionais para um MVP rápido, e não devem ser implementadas pelo agente de codificação automaticamente — apenas as tarefas sem `*` são de implementação obrigatória.
- Cada property test referencia o número da Correctness Property do `design.md` e a(s) cláusula(s) de requirement que ela valida, para rastreabilidade.
- Os testes nativos reais (Kotlin/Swift em dispositivo/emulador) ficam fora da suíte automatizada de CI, conforme já registrado na seção "Testing Strategy" do design — a lógica JS do plugin é mockada em todos os testes de `use-activity-tracker.ts`.
- Migrations seguem o padrão incremental já usado no repositório (`ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`, `CREATE POLICY`), nunca removendo dados existentes.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1.1", "1.2", "1.3", "1.7", "2.1", "3.1", "3.9", "5.3", "6.1", "6.2", "7.1", "9.1", "9.2", "10.1", "10.5", "12.1", "12.3", "13.1"]
    },
    {
      "id": 1,
      "tasks": ["1.4", "1.8", "2.2", "2.3", "3.2", "3.3", "3.10", "5.1", "5.4", "6.3", "6.6", "9.3", "9.8", "10.3", "10.6", "12.2", "12.4", "12.5", "13.2"]
    },
    {
      "id": 2,
      "tasks": ["1.5", "2.4", "3.4", "3.5", "3.11", "3.15", "5.2", "5.10", "7.2", "9.4", "12.6", "12.7", "13.3", "13.4"]
    },
    {
      "id": 3,
      "tasks": ["1.6", "3.6", "3.7", "5.5", "6.4", "9.5", "10.2", "12.8", "12.9"]
    },
    {
      "id": 4,
      "tasks": ["3.8", "3.12", "5.6", "6.5", "6.9", "9.6", "10.4", "10.7", "12.10"]
    },
    {
      "id": 5,
      "tasks": ["3.13", "5.7", "6.7", "6.8", "10.8"]
    },
    {
      "id": 6,
      "tasks": ["3.14", "5.8", "7.3", "7.5"]
    },
    {
      "id": 7,
      "tasks": ["5.9", "7.4", "7.6", "9.7"]
    },
    {
      "id": 8,
      "tasks": ["9.9"]
    }
  ]
}
```
