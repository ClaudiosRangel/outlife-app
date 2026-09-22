# Backlog — Grandes Funcionalidades (rodada pré-lançamento)

> Registro das 9 grandes demandas levantadas em 15/09/2026, antes de gerar as
> versões finais (APK Android + IPA App Store). Cada item é grande e vira um
> **spec próprio** em `.kiro/specs/` (ciclo requirements → design → tasks),
> implementado UMA FRENTE POR VEZ com build+commit por frente, na ordem de
> risco/dependência definida abaixo. Este arquivo é o índice; o detalhe fino
> de cada frente fica no spec correspondente.

**Fonte:** conversa com o usuário (15/09/2026), com screenshots de referência
do Strava (feed, tela de iniciar, tela de gravação, kudos, GPS 3D Mapbox).

---

## Ordem sugerida de execução (menor risco/dependência → maior)

A ordem prioriza itens que não dependem de integrações externas pagas/OAuth e
que reduzem risco de reprovação nas lojas (termos/exclusão de conta são
**bloqueadores de submissão** — vêm cedo).

| # | Frente | Spec | Risco | Depende de |
|---|--------|------|-------|-----------|
| 1 | Termos de uso + exclusão de conta + privacidade | `conta-privacidade-termos` ✅ CONCLUÍDA (15/09) | Médio (legal) | — (BLOQUEADOR de loja) |
| 2 | Frase/bio de perfil | `perfil-bio` ✅ CONCLUÍDA (15/09) | Baixo | — |
| 3 | Card da comunidade repaginado (estilo Strava) | `comunidade-card-strava` ✅ CONCLUÍDA (15/09) | Baixo | — |
| 4 | Likes com avatares + total no card | (junto do #3) ✅ CONCLUÍDA (15/09) | Baixo | #3 |
| 5 | Segmentos (ranking top 10 por tempo médio) | `segmentos` ✅ CONCLUÍDA (15/09) | Alto | motor de trajeto existente |
| 6 | Importar segmentos do Strava | (extensão do #5) | Alto | #5 + OAuth Strava |
| 7 | Conectar dispositivos (Garmin etc.) | `integracoes-dispositivos` | Alto | OAuth/API de terceiros |
| 8 | Repaginar Explorar (mapa moderno, 3D, "o que acontece agora") | `explorar-redesign` ✅ CONCLUÍDA (15/09) | Alto | Mapbox/token |
| 9 | Repaginar tela de Iniciar atividade (estilo Strava) | `iniciar-atividade-redesign` | Médio | mapa (compartilha com #8) |
| 10 | Loja virtual + propaganda no Iniciar + posts na comunidade | `loja-virtual-parceiros` | Alto | área admin de parceiros |

> A numeração das frentes não precisa ser rígida; itens de baixo risco (1–4)
> podem sair primeiro para destravar a submissão e dar ganho visível rápido.

---

## Detalhe das demandas (como o usuário descreveu)

### 1. Segmentos (estilo Strava) — spec `segmentos`
- Criar segmentos (trechos de percurso) e classificar os **10 melhores por
  média de tempo** no segmento (ranking/leaderboard).
- **Importar segmentos do Strava** (depende de OAuth/API Strava — ver #7).
- Mostrar a conquista de segmento no card da comunidade (ex.: "virou Local
  Legend"/"top 10 do segmento") — cruza com #3.
- Técnica: casar o trajeto gravado (GPS) contra a geometria do segmento
  (match espacial + janela de tempo). Base já existe em
  `use-activity-tracker.ts` + `activity-*.ts` + `haversine.ts` (estender, não
  reescrever — regra do roadmap).

### 2. Conectar dispositivos (Garmin e outros) — spec `integracoes-dispositivos`
- Conectar com Garmin e outros aparelhos (função do Strava).
- Provavelmente OAuth + APIs de cada fabricante (Garmin Connect, etc.),
  importação de atividades. Alto risco/escopo — spec dedicado, pesquisar
  disponibilidade de API pública de cada um.

### 3+4. Card da comunidade repaginado + likes com avatares — spec `comunidade-card-strava`
"Parecido, mas não igual" ao Strava. Estrutura desejada do card:
- Topo: **imagem + nome** do usuário; logo abaixo **ícone da atividade**,
  quando foi (data/hora), **lugar e cidade**.
- **Descrição da atividade destacada**.
- **Distância percorrida** + demais métricas conforme a atividade (já temos).
- Mostrar **conquista de segmento**, prêmios e **níveis** que já temos no app.
- **Várias imagens** lado a lado do percurso: mapa do trajeto, foto(s) e
  vídeo(s) se houver (carrossel).
- **Likes**: mostrar as **figurinhas (avatares) de quem deu like + o total**
  (ex.: 3 avatares + "96"), mantendo o nosso botão de like como é hoje.

### 5. Termo de uso + exclusão de conta + privacidade — spec `conta-privacidade-termos`
- Estudar os melhores termos de uso do mercado para app com **marketplace**.
- Aceite **obrigatório** no primeiro acesso (quem ainda não aceitou).
- Isenções necessárias: negociações entre usuários, conteúdo/postagens dos
  usuários, pagamentos em lojas virtuais que criaremos (não nos
  responsabilizamos pelo uso delas).
- Definir o que legalmente **precisamos** e o que **não precisamos** assumir.
- **Retenção de dados**: quanto tempo guardamos após a pessoa **excluir a
  conta** (criar essa possibilidade — exigência das lojas). Pesquisar como
  outros apps tratam dados/postagens (o que manter, por quanto tempo, como).
- Entregáveis: Termos de Uso + Política de Privacidade (PT + EN), tela de
  aceite no onboarding, tela "Excluir minha conta" (com fluxo de confirmação
  e retenção/soft-delete definido), URLs públicas para as lojas.

### 6. Explorar repaginado — spec `explorar-redesign`
- Mapa GPS **o mais moderno possível, até 3D** (Mapbox — ver screenshot com
  botão "3D", camadas, curvas de nível).
- Ao entrar: mostrar **tudo o que acontece na região agora** — eventos,
  parceiros próximos, amigos em atividade (e qual atividade), visão geral em
  tempo real.
- Depois, permitir as buscas por **Destinos / Trilhas / Parceiros** (já
  existe) — mas com visual moderno, bonito, chamativo, "viciante".

### 7. Frase de perfil (bio) — spec `perfil-bio`
- Usuário pode criar uma **frase de perfil** (bio curta). Campo em
  `profiles`, edição no perfil, exibição no ProfileView.

### 8. Tela de Iniciar atividade repaginada — spec `iniciar-atividade-redesign`
- Inspiração no Strava (mais moderna e limpa; a nossa está "embolada").
- Escolha por **ícone de atividade** (já gostamos).
- Encaixar o que temos no lugar de funcionalidades que ainda não temos;
  incluir o possível, como **GPS 3D** (se viável).
- Ao clicar em **Iniciar**, entrar numa tela de gravação limpa (Tempo /
  Veloc. média / Distância grandes, botão pause central) — "parecido, mas
  não igual", criativo.

### 9. Loja virtual dos parceiros — spec `loja-virtual-parceiros`
- Montar uma **loja virtual**: quando fechamos contrato com um usuário/parceiro
  (tudo pela **área administrativa**), as imagens/propaganda dele passam a
  aparecer na tela **Iniciar**; e, se configurado, as **postagens entram na
  comunidade**.
- Integra com o cadastro de parceiros/marketplace já existente (favoritos,
  perfil de parceiro). Alto escopo.

---

## Decisões do usuário (15/09/2026)

1. **Segmentos**: fazer **nativos nossos** (controlados 100% dentro do
   OutVitar). A importação do Strava / conexão Garmin fica como fase futura
   dependente de aprovação nos programas de parceiro deles (a API pública do
   Strava não permite mais importar segmentos de terceiros; Garmin exige
   aprovação). Não bloquear o lançamento por isso.
2. **Mapa**: o usuário **vai criar conta no Mapbox** (para 3D moderno). Ainda
   assim, manter um **fallback gratuito moderno** (MapLibre) para não depender
   só do Mapbox e não estourar custo. Arquitetar a camada de mapa com provider
   plugável (Mapbox quando houver token; MapLibre como default gratuito).
3. **Termos de uso / Política de Privacidade**: redigir o **mais próximo do
   padrão de mercado** (incluir o que é regra comum a todos: LGPD/GDPR, direito
   de exclusão, retenção, isenções de marketplace e conteúdo de usuário).
   Depois será enviado a um **advogado para validação** — deixar claro no
   documento que é minuta sujeita a revisão jurídica.

## Regras herdadas (não esquecer)
- Toda conversa/specs em **português**.
- Migrations **idempotentes**, aplicadas pelo agente em produção (2×),
  refletidas no consolidado `supabase/migrations-pendentes.sql`; `NOTIFY pgrst`
  após mudar funções/tabelas.
- Não reescrever a base de rastreamento — **estender** (Strava-level de
  confiabilidade é o padrão de qualidade).
- Rebranding técnico (`appId` → OutVitar) é bloco à parte; **não fazer antes**.
- Ao concluir cada frente: build (`build:native` → `cap sync` → `assembleDebug`),
  commit+push na `main`, atualizar o `ROADMAP-FINALIZACAO-APP.md`.
