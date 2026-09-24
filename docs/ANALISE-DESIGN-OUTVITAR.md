# Análise de design do OutVitar — parecer sincero (24/09/2026)

> Pedido do usuário: parecer honesto sobre o que mudar no design para o app
> ficar competitivo, profissional e "viciante". Base: leitura das telas reais
> (Home, Explorar, Comunidade, Perfil, Rastrear/Gravar, Detalhe da atividade,
> Loja/ofertas) ao longo do desenvolvimento. Referências mentais: Strava,
> Komoot, AllTrails, Instagram, TrivLock.

## Resumo honesto

O app **já tem uma base sólida e bonita** (verde-floresta consistente, cards
arredondados, tipografia display, banners de oferta bem-feitos, mapas com
camadas). O que separa o OutVitar de "parece um app pro" hoje é: **consistência
de sistema visual**, **densidade/hierarquia de informação**, **micro-interações
e feedback**, e **momentos de recompensa** (o que vicia). Abaixo, o que eu
mudaria, em ordem de impacto x esforço.

## 1. Sistema de design (a base de tudo) — ALTO impacto

Hoje as telas foram construídas em momentos diferentes e há pequenas
inconsistências (tamanhos de raio, sombras, espaçamentos, pesos de fonte,
tons de verde). O maior ganho de "cara de profissional" vem de **unificar um
design system**:
- **Tokens**: definir escala fixa de espaçamento (4/8/12/16/24), raios
  (sm/md/lg/2xl/3xl), sombras (1 sombra "card" + 1 "float"), e uma paleta
  semântica única (primary/surface/muted/success/warning/danger) — e usar SÓ
  esses tokens. Eliminar cores/raios/sombras "soltos".
- **Tipografia**: 1 fonte display (títulos) + 1 sans (corpo), com escala clara
  (h1/h2/h3/body/caption). Padronizar pesos (evitar misturar semibold/bold/
  extrabold sem critério).
- **Componentização**: um `<SectionHeader>` (título + "ver todos"), um
  `<StatCard>`, um `<Chip>`, um `<EmptyState>` reutilizáveis. Hoje esses
  padrões estão repetidos inline em cada tela com variações.

## 2. Home — reorganizar densidade — ALTO impacto

A Home tem muita seção empilhada (stats, eventos, loja, categorias, destinos,
parceiros, slogan). Fica longa e sem ritmo. Sugestões:
- **Hero mais editorial** (já é bom): manter a saudação + busca, mas dar mais
  respiro e talvez um "destaque do dia" (1 card grande rotativo).
- **Ritmo de seções**: alternar seções de "scroll horizontal" (carrosséis) com
  1 seção de destaque grande — evita a sensação de "lista de listas".
- **Stats** (destinos/parceiros/verificados): hoje é discreto; ou vira um
  card com ícones e mais vida, ou sai da Home (é mais "sobre o app" que ação).
- **Categorias**: os chips estão ok; considerar ícones para cada categoria
  (mais escaneável e bonito).

## 3. Feed da Comunidade — o coração social — ALTÍSSIMO impacto (é o que vicia)

É a tela que mais influencia retenção. O card já ficou bom (estilo Strava).
Para "viciar":
- **Kudos/like com animação** (coração que "explode", contador que anima) —
  microrrecompensa. Hoje o like é funcional mas sem celebração.
- **Comentário rápido inline** (campo sempre visível ou 1 toque) reduz atrito.
- **Selos de conquista no card** com brilho/cor (KOM, recorde pessoal, subiu de
  nível) — o usuário quer mostrar. Já temos segmentos/níveis; falta destacar
  visualmente no feed.
- **"Pull to refresh"** com animação temática (folha/montanha).
- **Skeleton** consistente no carregamento (já existe em partes).

## 4. Momentos de recompensa (gamificação) — ALTO impacto na retenção

O que faz voltar todo dia:
- **Tela de "atividade concluída" comemorativa** (full-screen): confete/animação,
  "novo recorde!", km da semana, comparação com a última vez, botão compartilhar
  grande. Hoje o fim de atividade é funcional.
- **Streak** (dias seguidos ativo) visível no perfil/Home.
- **Progresso de nível** com animação quando sobe.
- **Metas semanais** simples (ex.: "faltam 5 km para sua meta").

## 5. Rastrear/Gravar — foco e legibilidade — MÉDIO/ALTO

A tela de gravar melhorou (estilo Strava). Refinos:
- Números **ainda maiores e mais contrastados** durante a atividade (é usada em
  movimento, sol, suor) — legibilidade é rei.
- **Modo tela cheia** durante a corrida (esconder nav/《status》).
- Botão de pausa/stop com **área de toque generosa** e confirmação de "finalizar"
  para evitar toque acidental.

## 6. Compartilhamento (viralização) — ALTO impacto de crescimento

Cada compartilhamento é marketing grátis. O TrivLock (referência do usuário)
faz **story vertical com o vídeo/mapa do percurso + métricas sobrepostas**.
- **Banner de compartilhamento premium** (9:16, story): foto/mapa + métricas
  grandes + marca OutVitar discreta. (Já existe `generateActivityBanner`;
  elevar o nível visual.)
- **Replay/vídeo do percurso em tela cheia** com métricas correndo (item 3 do
  usuário — ver roadmap). É o recurso de maior potencial viral.

## 7. Detalhes que elevam a percepção de qualidade — MÉDIO

- **Transições entre telas** (fade/slide suave) — TanStack Router permite.
- **Estados vazios** ilustrados e com CTA (não só texto cinza).
- **Toasts/erros** com identidade (ícone + cor semântica).
- **Dark mode** revisado tela a tela (contrastes, superfícies).
- **Ícones consistentes** (uma família — lucide já é; padronizar tamanhos).
- **Imagens**: placeholders/blur-up no carregamento (evita "pulo" do layout).

## 8. Onboarding — primeira impressão — ALTO impacto na ativação

- 3-4 telas de boas-vindas mostrando o valor (rastrear, comunidade, explorar,
  ofertas) + pedir permissões no contexto certo (localização quando for gravar,
  não de cara).
- Primeira experiência guiada: "faça sua primeira atividade" com recompensa.

## Prioridização sugerida (impacto x esforço)

1. **Design system/tokens** (base — destrava tudo). Médio esforço, alto retorno.
2. **Feed com microrrecompensas** (like animado, selos de conquista). Alto retorno.
3. **Tela de atividade concluída comemorativa** + streak. Alto retorno.
4. **Compartilhamento premium (story 9:16) + replay em tela cheia**. Viralização.
5. **Onboarding**. Ativação.
6. Refinos de rastrear, transições, estados vazios, dark mode.

## Observação
Nada disso é "reescrever o app" — é **polimento de sistema** sobre uma base que
já está boa. O maior salto de "amador → profissional" vem dos itens 1, 3 e 4.
