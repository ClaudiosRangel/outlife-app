# Design Document

## Overview

Unificar o perfil do OutVitar numa **única tela** (`/perfil`) que serve tanto
o Perfil_Próprio quanto o Perfil_De_Outro, com visual moderno estilo
Instagram/Strava: cabeçalho com avatar + Selo_Ao_Vivo, barra de estatísticas
navegável, faixa de conquistas e abas com ícones (Atividades/Posts/Conquistas
e, no próprio, Salvos/Favoritos). A rota separada `/u/$userId` é descontinuada
(passa a redirecionar para o perfil unificado). Também troca o ícone de
`voo_livre` de avião para um parapente/asa-delta customizado.

O redesenho **estende** a base existente (não reescreve os dados): reaproveita
`fetchMyProfile`, `fetchPublicProfile`, `fetchUserActivities`/
`fetchUserPublicActivities`, `fetchUserAchievements`, `fetchLiveActivityFriends`,
`fetchCommunityPosts`, e a navegação/rotas já criadas (`/chat/$userId`).

## Architecture

O perfil vira um componente único parametrizado por `userId`:

```
/perfil                → ProfileScreen (userId = logado)  [Perfil_Próprio]
/u/$userId (legado)    → redireciona para o perfil unificado do userId
Comunidade/comentários → navega para o perfil unificado com o userId do autor
```

Decisão de rota: manter `/perfil` como a rota principal e reaproveitar o
`search`/estado para o `userId` alvo NÃO é trivial no TanStack Router sem
param. Para simplicidade e URLs compartilháveis, o **Perfil_De_Outro continua
tendo URL própria** por meio da rota já existente `/u/$userId`, mas ela passa a
renderizar **o mesmo componente visual** do perfil (mesmo layout/abas),
apenas com `viewedUserId = params.userId`. O `/perfil` renderiza o mesmo
componente com `viewedUserId = authUid`. Ou seja: **um componente
compartilhado (`ProfileView`)**, duas rotas finas que só definem de quem é o
perfil. Isso satisfaz "um perfil só" (mesma experiência/visual) sem quebrar
deep links já compartilhados de `/u/:id`.

```
ProfileView({ viewedUserId })
├── isSelf = viewedUserId === authUid
├── Header (avatar + Selo_Ao_Vivo + nome + @ + bio + ações condicionais)
├── StatsBar (atividades · seguidores · seguindo [· km/conquistas])
├── AchievementsStrip (carrossel horizontal)
└── Tabs (ícones)
    ├── Atividades  → Card_Atividade[] (ícone do tipo + métricas)
    ├── Posts       → grade de posts do usuário
    ├── Conquistas  → grade de medalhas
    └── (isSelf) Salvos · Favoritos
```

## Components and Interfaces

### `src/routes/profile-view.tsx` (novo — componente compartilhado)
`ProfileView({ viewedUserId }: { viewedUserId: string })`. Reúne todo o layout
novo. Usado por `/perfil` (self) e `/u/$userId` (outro).

### `src/routes/perfil.tsx` (existente — passa a delegar)
Mantém a rota `/perfil` e o guard de logout/atividade em andamento já
existente; renderiza `<ProfileView viewedUserId={authUid} />`. As seções
exclusivas do dono (dark mode, checklist, próxima aventura, painel parceiro,
área admin, dê sua opinião, rastrear atividade) permanecem, exibidas quando
`isSelf`.

### `src/routes/u.$userId.tsx` (existente — vira fino)
Passa a renderizar `<ProfileView viewedUserId={params.userId} />` (remove o
layout antigo próprio). Deep links preservados (Req 1.4).

### Camada de dados (api.ts) — adições mínimas
- `fetchUserPostsByAuthor(userId, limit)`: posts da comunidade de um autor
  (para a aba Posts). Reaproveita `community_posts` (RLS leitura pública).
- `fetchProfileHeader(userId)`: consolida nome/username/avatar/bio/contadores
  (usa `fetchPublicProfile`; para self pode usar `fetchMyProfile`).
- Reuso: `fetchUserPublicActivities`, `fetchUserAchievements` (own),
  `fetchLiveActivityFriends` (para o Selo_Ao_Vivo — cruza `id === viewedUserId
  && is_live`).

### Icon_Model_Set / Icon_Parapente
- `voo_livre` deixa de usar `Plane`. Como o lucide não tem parapente/asa-delta,
  cria-se um componente SVG local `ParagliderIcon` (`src/components/icons/
  paraglider.tsx`) com a mesma assinatura visual do lucide (stroke, size),
  e o `ICON_MODEL_SET` passa a referenciá-lo para `flight`.
- O gerador de PNGs (`scripts/gen-activity-icons.mjs`) passa a produzir o PNG
  de `flight` a partir do mesmo path do parapente (não mais do `plane`).

## Data Models

Sem novas tabelas. Usa os modelos existentes:
- `profiles` (nome/username/avatar/description/followers_count/following_count).
- `user_activities` (atividades concluídas do usuário; `activity_type` alimenta
  o ícone via Icon_Model_Set + `metric-forms`).
- `community_posts` (posts do autor para a aba Posts).
- `achievement_records` (conquistas — leitura própria via RLS).
- `public_user_locations_live` (Selo_Ao_Vivo via `fetchLiveActivityFriends`).

## Correctness Properties

### Property 1: Perfil unificado resolve o usuário certo
`ProfileView` exibe sempre os dados do `viewedUserId`; quando `viewedUserId ===
authUid`, comporta-se como Perfil_Próprio (sem ações de Seguir/Mensagem a si
mesmo).
**Validates: Requirements 1.1, 1.2, 1.3, 2.3, 2.4**

### Property 2: Ações condicionais por dono
O botão "Enviar mensagem"/"Seguir" aparece se e somente se `!isSelf`; as ações
administrativas/edição aparecem se e somente se `isSelf`.
**Validates: Requirements 2.3, 2.4**

### Property 3: Selo ao vivo coerente e resiliente
O Selo_Ao_Vivo aparece se e somente se existir, na fonte Live, uma entrada com
`id === viewedUserId && is_live === true`; offline/sem dado → não aparece
(nunca erro).
**Validates: Requirements 3.1, 3.2, 3.3**

### Property 4: Estatísticas nunca NaN
Toda contagem exibida na StatsBar é um inteiro ≥ 0 (0 quando o dado é
ausente/indisponível), nunca NaN nem string vazia.
**Validates: Requirements 4.1, 4.3**

### Property 5: Atividades sempre com ícone
Todo Card_Atividade renderiza um ícone do Icon_Model_Set resolvido pelo
`activity_type` (com fallback `activity`), nunca sem ícone.
**Validates: Requirements 5.2, 6.3**

### Property 6: Voo livre usa parapente
Para `icon_key = 'flight'`, `getActivityIcon` retorna o Icon_Parapente (não o
avião), e o PNG gerado para `flight` corresponde ao parapente; chave
desconhecida cai no ícone genérico.
**Validates: Requirements 6.1, 6.2, 6.3**

### Property 7: Estado vazio não quebra
Qualquer aba sem conteúdo renderiza um estado vazio textual, sem exceção e sem
layout quebrado.
**Validates: Requirements 5.5, 7.2**

## Error Handling

- **Falha de query** (perfil/atividades/posts/conquistas): cada seção usa seu
  próprio `useQuery` com skeleton no `isLoading` e estado vazio no erro/vazio
  — a tela nunca fica branca (Req 7.2).
- **Selo ao vivo**: derivado de `fetchLiveActivityFriends`, que já é resiliente
  a offline; ausência de dado = sem selo (Req 3.2).
- **Conquistas de outro usuário**: `achievement_records` tem RLS de leitura
  própria; no Perfil_De_Outro a aba Conquistas pode vir vazia — trata como
  estado vazio normal (sem erro).
- **Icon_Parapente ausente**: `getActivityIcon` mantém fallback para
  `activity` (Req 6.3).
- **tsc**: manter só os 6 erros pré-existentes de `use-local-push.ts` (Req 7.3).

## Testing Strategy

- **Lógica pura (Vitest + fast-check)**: `getActivityIcon` (Property 6 — flight
  resolve parapente; desconhecido → genérico) e um helper puro de normalização
  de contagens `safeCount(n)` (Property 4 — sempre inteiro ≥ 0).
- **Verificação manual/visual**: abas, selo ao vivo, ações condicionais
  (self vs outro), estados vazios — via APK no aparelho.
- **Build**: `tsc --noEmit` (só os 6 erros conhecidos) → `build:native` →
  `cap sync android` → `assembleDebug`.
- **i18n**: chaves novas em pt-BR e en, validadas com `JSON.parse`.
