# Roadmap OutVitar — orientação obrigatória de toda sessão

Este arquivo é carregado automaticamente em toda sessão do Kiro neste
workspace. Ele existe para que NENHUMA sessão se perca no meio do plano de
finalização do app. **Antes de trabalhar em qualquer coisa do OutVitar, leia
o documento-mestre de roadmap** referenciado abaixo — ele é a fonte única de
verdade sobre o que já foi feito, o que está em andamento e o que falta.

## Documento-mestre (fonte de verdade)

#[[file:docs/ROADMAP-FINALIZACAO-APP.md]]

## Regras de continuidade entre sessões

1. **Sempre comece consultando** `docs/ROADMAP-FINALIZACAO-APP.md` para saber
   o bloco/tarefa atual antes de agir.
2. **Sempre atualize** o `docs/ROADMAP-FINALIZACAO-APP.md` ao concluir uma
   tarefa, spec ou bloco — marque o status, a data e um resumo do que foi
   feito. O roadmap deve refletir a realidade do código, não a intenção.
3. **Ordem dos blocos é deliberada** (reduz risco antes de subir pra Apple).
   Não pular blocos sem o usuário pedir explicitamente.
4. **Um spec por bloco**, em `.kiro/specs/`. Cada bloco tem seu próprio
   ciclo requirements → design → tasks. O roadmap lista o nome do spec de
   cada bloco.
5. **Rebranding**: o app está migrando de "OutLife" para **OutVitar** (slogan
   "VIVER É DIFERENTE DE ESTAR VIVO"). Textos novos voltados ao usuário usam
   OutVitar. O `appId` técnico atual ainda é `app.outlife.mobile` — a troca
   de identidade técnica está planejada no bloco de rebranding, não fazer
   antes.
6. **Idioma**: toda conversa com o usuário em português (regra já existente
   em `idioma-portugues.md`). Specs em português.
7. **Confiabilidade estilo Strava** é o padrão de qualidade para
   rastreamento (trajeto/tempo/velocidade). Nunca degradar a integridade de
   registro de atividades.

## Padrões técnicos do projeto (resumo — detalhe no roadmap)

- Stack: React 19 + TypeScript + Vite + TanStack Start/Router + Supabase +
  Tailwind + Shadcn UI. App nativo via Capacitor 8 (`android/`; `ios/` ainda
  não gerado — necessário Codemagic para build iOS, o usuário não tem Mac).
- Migrations Supabase: sempre criar arquivo novo timestampado em
  `supabase/migrations/`, idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`,
  `DROP ... IF EXISTS`). Nunca editar migration já aplicada.
- Rastreamento vive em `src/hooks/use-activity-tracker.ts` +
  `src/lib/activity-*.ts` + `src/lib/haversine.ts`. Não reescrever a base;
  estender.
- Testes: Vitest (unit + fast-check para property-based) e Playwright (E2E).
