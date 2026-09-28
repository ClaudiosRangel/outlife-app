# Implementation Plan

## Overview

Tela/fluxo próprios para "Criar rota" (Rota-Destino da comunidade), separada da
atividade diária. Reusa tracker, createDestinationFull e a moderação existente.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3", "4"] },
    { "wave": 4, "tasks": ["5"] }
  ]
}
```

## Tasks

- [x] 1. Lib pura `adventure-route.ts` + testes
  - `ADVENTURE_CATEGORIES`, `TRAVEL_MODES`, `toActivityType(mode)`,
    `buildAdventureDraft(points)` (delega a `buildDestinationDraft`).
  - Testes Vitest + fast-check (sem importar o hook/Capacitor).
  - _Requisitos: 2.1, 2.2, 2.4; Properties 1, 2_

- [x] 2. Tela `/rota-nova.tsx` (config → gravar/escolher → form) + routeTree
  - Passo 1 (categoria/deslocamento/modo), Passo 2a (gravar ao vivo com
    calibração+contagem), Passo 2b (escolher atividade), Passo 3 (form aventura)
    → `createDestinationFull(status:'pending')`.
  - Registrar a rota flat `/rota-nova` manualmente no `routeTree.gen.ts` (8
    pontos) e verificar pós-build.
  - _Requisitos: 1.1, 1.2, 2.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 3. Explorar: FAB → `/rota-nova`
  - Atualizar navegação do FAB "Criar rota".
  - _Requisitos: 1.1_

- [x] 4. Limpar `atividade.rastrear.tsx` (remover modo destino)
  - Remover `?mode=destino`, sheet de destino e estados relacionados; manter a
    atividade diária intacta (não regredir).
  - _Requisitos: 1.3, 5.3_

- [x] 5. i18n + verificação + build/APK + roadmap
  - i18n pt-BR/en (`rotaNova.*`), get_diagnostics, testes, build:native + cap
    sync + APK, commit/push, atualizar roadmap.
  - _Requisitos: 5.1, 5.2, 5.4_

## Notes

- Reusar tracker/createDestinationFull/buildDestinationDraft; sem migration
  prevista.
- Rota com hífen (`rota-nova`) → registro manual no routeTree em 8 pontos;
  verificar que sobreviveu ao build.
- Testes puros em src/lib (sem Capacitor).
- Entregar funcionando: build + APK validados no fim.
