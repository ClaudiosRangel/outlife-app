# Requirements Document

## Introduction

Repaginar o **perfil** do OutVitar num único perfil unificado, moderno,
bonito, organizado e "inteligente", inspirado em Instagram/Strava, dentro da
proposta outdoor. **Decisão do usuário:** existe UM só perfil — a rota de
perfil público separada (`/u/$userId`, `src/routes/u.$userId.tsx`) é
**descontinuada**, e todo o conteúdo (dados públicos, atividades, posts,
conquistas, botão de mensagem privada para outros usuários) passa a viver no
perfil principal (`/perfil`, aba "Você"). Ao clicar no nome/avatar de um
usuário na Comunidade, abre-se o MESMO perfil parametrizado pelo id daquele
usuário; quando o perfil é o do próprio usuário logado, mostram-se as ações de
edição/administração em vez de "Seguir/Mensagem".

Como parte deste bloco, também trocamos o ícone do tipo de atividade **Voo
livre** (hoje um avião — `Plane`) por um ícone de **parapente/asa-delta**
customizado, mais fiel à modalidade, tanto no app quanto no PNG usado nos
banners. E reforça-se o uso de **ícones em todas as atividades**.

## Glossary

- **Perfil**: a tela única de perfil (`/perfil`), que passa a aceitar um
  parâmetro opcional de usuário para exibir o perfil de outra pessoa. Substitui
  a antiga rota separada `/u/$userId`.
- **Perfil_Próprio**: o Perfil quando o usuário exibido é o usuário logado
  (mostra ações de editar/configurar/administrar, sem "Seguir/Mensagem").
- **Perfil_De_Outro**: o Perfil quando o usuário exibido é outra pessoa
  (mostra "Seguir/Seguindo" e "Enviar mensagem", sem ações administrativas).
- **Selo_Ao_Vivo**: indicador visual (anel colorido no avatar + selo textual)
  exibido quando o usuário do perfil está com uma atividade sendo rastreada e
  compartilhada ao vivo neste momento.
- **Aba_Perfil**: abas de conteúdo do perfil (Atividades, Posts, Conquistas,
  Salvos, Favoritos).
- **Card_Atividade**: item da aba Atividades, sempre com o ícone do tipo de
  atividade (Icon_Model_Set) + métricas resumidas.
- **Icon_Model_Set**: mapa `icon_key → ícone lucide` em `src/lib/activity-icons.ts`.
- **Icon_Parapente**: ícone customizado (SVG) de parapente/asa-delta usado
  para o tipo `voo_livre`, substituindo o `Plane`.

## Requirements

### Requirement 1: Perfil unificado (uma tela só)

**User Story:** Como usuário, quero um único perfil que sirva tanto para o meu
quanto para o de outras pessoas, para não haver duas telas de perfil diferentes.

#### Acceptance Criteria

1. WHEN o usuário abre `/perfil` sem parâmetro de usuário THEN o Perfil SHALL
   exibir o Perfil_Próprio do usuário logado.
2. WHEN o usuário toca no nome/avatar de outra pessoa (Comunidade, comentários,
   amigos, ranking) THEN o app SHALL abrir o MESMO Perfil parametrizado pelo id
   daquele usuário (Perfil_De_Outro).
3. WHEN o Perfil_De_Outro é aberto para o id do próprio usuário logado THEN o
   Perfil SHALL se comportar como Perfil_Próprio (sem ações de Seguir/Mensagem
   a si mesmo).
4. WHEN a antiga rota `/u/$userId` for acessada THEN o app SHALL redirecionar/
   renderizar o Perfil unificado equivalente (sem tela órfã).

### Requirement 2: Cabeçalho moderno do perfil

**User Story:** Como usuário, quero um cabeçalho bonito e claro, para
reconhecer rapidamente de quem é o perfil e suas informações principais.

#### Acceptance Criteria

1. WHEN o Perfil é aberto THEN o cabeçalho SHALL exibir avatar (grande), nome,
   @username e a descrição/bio quando existirem.
2. WHERE a bio ou o @username estiverem ausentes THEN o cabeçalho SHALL omitir
   esses elementos sem deixar espaço quebrado (layout permanece coeso).
3. WHEN o Perfil_Próprio é exibido THEN o cabeçalho SHALL oferecer "Editar
   perfil" e acesso a configurações (e área administrativa quando o usuário é
   admin), SEM botões de Seguir/Mensagem.
4. WHEN o Perfil_De_Outro é exibido THEN o cabeçalho SHALL exibir o botão
   "Enviar mensagem" (abre `/chat/$userId`) e um botão de relação
   (Seguir/Seguindo).

### Requirement 3: Selo de atividade ao vivo

**User Story:** Como usuário, quero saber se a pessoa está em uma atividade
rastreada agora, para acompanhá-la ao vivo.

#### Acceptance Criteria

1. WHEN o usuário do perfil está com atividade ao vivo (presente na fonte de
   Live_Friends / posição pública recente) THEN o avatar SHALL exibir um anel
   destacado (Selo_Ao_Vivo) e um selo textual "Em atividade agora" com o tipo.
2. WHERE o dado ao vivo depender de internet e o dispositivo estiver offline
   THEN o Selo_Ao_Vivo SHALL simplesmente não aparecer (sem erro).
3. WHEN o usuário NÃO está ao vivo THEN o avatar SHALL ser exibido sem o anel
   de destaque.
4. WHEN o Selo_Ao_Vivo está visível e há um destino de acompanhamento
   disponível THEN tocar no selo SHALL levar o usuário à tela de acompanhamento
   (Explorar/mapa).

### Requirement 4: Barra de estatísticas

**User Story:** Como usuário, quero ver os números do perfil de forma clara e
navegável, para explorar seguidores, seguindo e a produção da pessoa.

#### Acceptance Criteria

1. WHEN o Perfil é exibido THEN a barra de estatísticas SHALL mostrar, no
   mínimo: quantidade de atividades, seguidores e seguindo.
2. WHERE houver dados de quilometragem total e/ou conquistas THEN a barra SHALL
   poder exibi-los como estatística adicional.
3. WHEN qualquer contagem for indisponível THEN a barra SHALL exibir 0 (nunca
   NaN nem vazio).
4. WHEN o usuário toca em "seguidores"/"seguindo" no Perfil_Próprio THEN SHALL
   abrir a lista correspondente (comportamento já existente preservado).

### Requirement 5: Abas de conteúdo com ícones

**User Story:** Como usuário, quero navegar entre atividades, posts, conquistas
e coleções da pessoa em abas organizadas, estilo Instagram.

#### Acceptance Criteria

1. WHEN o Perfil é exibido THEN SHALL apresentar abas com ícones: Atividades,
   Posts e Conquistas (no Perfil_Próprio, também Salvos e Favoritos).
2. WHEN a aba Atividades está ativa THEN cada Card_Atividade SHALL exibir SEMPRE
   o ícone do tipo de atividade (Icon_Model_Set) + métricas resumidas
   (distância, duração e data).
3. WHEN a aba Posts está ativa THEN SHALL exibir as publicações da comunidade
   do usuário (foto/vídeo-poster) em grade; ao tocar, abre o item.
4. WHEN a aba Conquistas está ativa THEN SHALL exibir as conquistas do usuário
   com ícone e rótulo.
5. WHERE uma aba não tiver conteúdo THEN SHALL exibir um estado vazio claro
   (mensagem amigável), sem quebrar o layout.

### Requirement 6: Ícone de parapente para Voo livre

**User Story:** Como usuário, quero que o Voo livre tenha um ícone de
parapente/asa-delta em vez de avião, para representar melhor a modalidade.

#### Acceptance Criteria

1. WHEN o tipo de atividade `voo_livre` é exibido (seletor de rastreamento,
   cards, banners, perfil) THEN o ícone SHALL ser um Icon_Parapente (não mais
   `Plane`).
2. WHEN o banner de compartilhamento usa o ícone de `voo_livre` THEN o PNG do
   ícone SHALL corresponder ao Icon_Parapente.
3. WHERE o Icon_Parapente não puder ser resolvido THEN o sistema SHALL usar o
   ícone genérico de atividade como fallback, sem lançar erro.

### Requirement 7: Preservar comportamento e não quebrar nada

**User Story:** Como usuário, quero que o redesenho não quebre o que já
funciona.

#### Acceptance Criteria

1. WHEN o Perfil_Próprio é exibido THEN as ações já existentes (editar perfil,
   configurações, área administrativa quando admin, painel do parceiro,
   rastrear nova atividade, dê sua opinião, dark mode, nível, checklist,
   próxima aventura) SHALL permanecer acessíveis.
2. WHEN qualquer consulta de dados do perfil falhar THEN a tela SHALL degradar
   graciosamente (skeleton/estado vazio), nunca tela branca ou erro não
   tratado.
3. WHEN o build de verificação roda THEN `tsc --noEmit` SHALL manter apenas os
   6 erros pré-existentes de `use-local-push.ts` (nenhum novo).
