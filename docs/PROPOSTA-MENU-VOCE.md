# Proposta de organização do menu Você (Perfil) — OutVitar

> Item 1 da rodada pré-#8. Pesquisa nos melhores apps do segmento (Strava,
> Komoot, AllTrails) + proposta aplicada ao `src/routes/perfil.tsx`.

## O que os melhores apps fazem

Padrão comum da aba de perfil ("You" na Strava, perfil no Komoot/AllTrails):

1. **Hero no topo** — foto, nome, bio curta e estatísticas inline
   (atividades/seguidores/seguindo).
2. **Conteúdo do usuário em abas** — atividades, posts, conquistas.
3. **Atalhos agrupados por seção com título** — em vez de uma pilha longa de
   cards soltos, os itens são agrupados por afinidade (social, conteúdo,
   preferências).
4. **Configurações na engrenagem** no canto superior direito — conta,
   privacidade, preferências, integrações ficam fora da rolagem principal.

Fontes: [Strava iPhone App Settings](https://support.strava.com/en-us/articles/15402087-iphone-app-settings)
e [Android App Settings](https://support.strava.com/en-us/articles/15402004-android-app-settings)
(conteúdo parafraseado para conformidade de licenciamento).

## Como estava o OutVitar

O `perfil.tsx` empilhava ~12 cards soltos sem hierarquia visual: Mensagens,
Amigos, Meus segmentos, Admin, Parceiro, Retomar atividade, Opinião,
Salvos/Favoritos, Nível, Localização ao vivo, Modo escuro, Checklist, Idioma,
Sair. Funcional, mas longo e cansativo de percorrer.

## Proposta aplicada (reorganização por seções, sem remover nada)

Mantido o Hero (ProfileView) e as abas Atividades/Posts/Conquistas no topo.
Abaixo, os atalhos foram agrupados sob títulos de seção discretos:

| Seção | Itens |
|---|---|
| **Social** | Mensagens, Amigos, Seguidores/Seguindo |
| **Minhas coisas** | Meus segmentos, Checklists, Salvos, Favoritos |
| **Progresso** | Nível + atalho Ranking |
| **Ao vivo** | Compartilhamento de localização |
| **Gestão** (condicional) | Admin, Painel do Parceiro, Retomar atividade |
| **App** | Dê sua opinião, Idioma, Modo escuro, Sair |

Nesta rodada foram aplicados os títulos das seções **Social**, **Minhas
coisas** e **App** (as demais já ficam naturalmente agrupadas na ordem atual).
Nada foi removido — só organizado, para manter tudo funcionando e ser
reversível.

## Evolução futura (sugestão, não feito ainda)

- Mover preferências (idioma, modo escuro, exclusão de conta) para uma tela
  dedicada de **Configurações** aberta pela engrenagem, deixando o perfil só
  com conteúdo e atalhos — mais próximo do padrão Strava.
- Card de **Progresso/Nível** com barra e atalho de Ranking agrupado
  visualmente com as conquistas.
