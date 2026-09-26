# Requirements Document

Explorar repaginado + Destinos ricos com rota (GPX) (Bloco 3 pré-lojas)

## Introduction

Este bloco moderniza o **Explorar** e transforma o **Destino** de um simples
ponto no mapa em uma ficha rica (estilo Trivlock/AllTrails), mantendo a
identidade visual do app (verde-floresta + acento laranja). Os destinos default
passam a ser criados na **administração** a partir de um arquivo **GPX** (o
traçado real da trilha) + foto + dados, seguindo o fluxo de aprovação já
existente. Destinos criados por usuários a partir de segmento real também
entram para aprovação.

Decisões técnicas já validadas com o usuário:
- **Rota vem de GPX/KML/KMZ** (não de imagem). O parser de GPX foi validado com
  a Cachoeira Alta (36 pontos, 0,771 km — bate com o concorrente).
- **Clima/previsão via Open-Meteo** (gratuita, sem chave); elevação via
  Open-Meteo Elevation API quando o GPX não traz `<ele>`.
- **Descrições reais** vêm do GPX/usuário (não inventadas).
- **Amigos e parceiros** na trilha/região cruzados por proximidade geográfica
  com dados já existentes.

## Glossary

- **Destination:** registro em `destinations` (nome, descrição, lat/lng, região,
  UF, dificuldade, tipo, imagem, status pending/approved/rejected). Ganha novos
  campos: **rota** (`route_geojson`), perfil de elevação, entrada paga/valor,
  horários, pet-friendly, categoria.
- **Destination_Route:** o traçado real da trilha (LineString) importado do GPX,
  usado no mapa e no "Iniciar navegação".
- **GPX_Import:** processo que parseia um arquivo GPX/KML/KMZ e extrai
  nome/descrição/pontos → distância, bbox, ponto inicial e `route_geojson`.
- **Explore_Screen:** tela `/explorar` (repaginada).
- **Destination_Screen:** nova tela de detalhe do destino
  (`/destino/$destinationId`).
- **Weather_Panel:** clima atual + previsão horária + alertas ("situações
  agravantes": chuva forte, UV alto, vento), via Open-Meteo.
- **Elevation_Profile:** gráfico de perfil de elevação da rota.
- **Friends_On_Trail:** amigos que estão/estiveram na trilha (cruzando rotas de
  atividades concluídas com a região do destino).
- **Partners_Nearby:** parceiros próximos do destino (por proximidade).
- **Admin_Destination_Form:** tela de administração para criar/editar destinos,
  com upload de GPX + imagem + dados, e aprovação.

## Requirements

### Requisito 1: Importar rota de arquivo GPX (admin)

**User Story:** Como administrador, quero criar um destino enviando o GPX da
trilha, para que a rota real fique gravada no banco.

#### Critérios de Aceitação

1. THE Admin_Destination_Form SHALL aceitar upload de arquivo **GPX** (mínimo),
   e opcionalmente KML/KMZ, extraindo nome, descrição, pontos do trajeto,
   distância total, ponto inicial e bounding box.
2. WHEN um GPX é enviado, THE GPX_Import SHALL preencher automaticamente os
   campos sugeridos (nome, descrição, distância, ponto inicial/lat-lng) para o
   admin revisar/ajustar antes de salvar.
3. WHERE o GPX não contém elevação (`<ele>`), THE sistema SHALL obter a
   elevação dos pontos via Open-Meteo Elevation API para compor o
   Elevation_Profile (best-effort; se falhar, o perfil fica indisponível sem
   bloquear o cadastro).
4. THE Destination_Route (LineString) SHALL ser persistido no destino
   (`route_geojson`) e usado no mapa e no "Iniciar navegação".
5. WHERE o usuário NÃO tem GPX, THE sistema SHALL permitir criar a rota a partir
   de um segmento real / desenho no mapa (reuso do "Criar rota" existente) —
   sem depender de imagem.
6. THE importação a partir de **imagem** NÃO SHALL ser oferecida como fonte de
   traçado (não é confiável); imagens servem apenas como foto do destino.

### Requisito 2: Tela de destino rica

**User Story:** Como usuário, quero abrir um destino e ver tudo sobre ele, para
decidir e me preparar.

#### Critérios de Aceitação

1. WHEN o usuário toca em um destino no Explorar, THE app SHALL abrir a
   Destination_Screen com: foto/hero, nome, dificuldade, categoria, badges
   (pago/grátis, pet-friendly), distância, favoritar.
2. THE Destination_Screen SHALL exibir o Weather_Panel (clima atual + previsão
   horária) do local do destino, com um indicador de "situações agravantes"
   quando aplicável.
3. THE Destination_Screen SHALL exibir o Elevation_Profile quando houver dados
   de elevação, com métricas (alt. mínima/máxima, ganho, tempo estimado).
4. THE Destination_Screen SHALL exibir uma descrição ("Sobre a trilha") e, no
   mapa, o Destination_Route (traçado), com camadas (satélite/relevo).
5. THE Destination_Screen SHALL listar Friends_On_Trail (amigos que estão/
   estiveram) e Partners_Nearby (parceiros da região).
6. THE Destination_Screen SHALL ter um aviso de segurança ("pratique com
   segurança") e um botão "Iniciar navegação" que inicia o rastreamento
   associado ao destino.
7. WHERE não há dado de uma seção (ex.: sem amigos, sem parceiros, sem
   elevação), THE seção SHALL exibir um estado vazio discreto ou ser omitida,
   sem erro.

### Requisito 3: Explorar repaginado (busca + filtros + criar rota)

**User Story:** Como usuário, quero um Explorar moderno com busca e filtros,
para achar o destino ideal.

#### Critérios de Aceitação

1. THE Explore_Screen SHALL ter uma busca com um botão de **filtros** que abre
   um painel com: região/cidade, dificuldade, categoria (cachoeira/pico/parque/
   trilha/etc.), pet-friendly, pago/grátis, "apenas baixadas (offline)", "rotas
   que curti", "usar minha localização".
2. THE Explore_Screen SHALL ter um botão destacado **"Criar rota"** que leva ao
   fluxo de criação (segmento/desenho) — resultando num destino que entra para
   aprovação.
3. THE cards de destino SHALL exibir dificuldade, categoria, distância, e
   (quando localização disponível) a distância aproximada até o início.
4. THE Explore_Screen SHALL manter os elementos que já funcionam bem (mapa de
   amigos ao vivo, panorama/clima da região, parceiros), modernizados.
5. THE identidade visual SHALL permanecer (verde-floresta + acento laranja),
   sem "fugir da característica do app".

### Requisito 4: Criação por usuário + aprovação (mantém fluxo atual)

#### Critérios de Aceitação

1. WHERE um usuário cria um destino/rota, THE registro SHALL nascer com
   `status = 'pending'` e só aparecer no Explorar após aprovação por admin
   (fluxo já existente de `destinations`).
2. THE admin SHALL poder aprovar/rejeitar, e o autor SHALL ser notificado na
   aprovação (reuso de `notify_destination_approved`).

### Requisito 5: Migrations, dados e conteúdo

#### Critérios de Aceitação

1. THE alterações de banco SHALL ser migrations novas timestampadas e
   idempotentes (ADD COLUMN IF NOT EXISTS etc.), aplicadas 2× + reload
   PostgREST, refletidas em `migrations-pendentes.sql`.
2. THE novos campos do destino (route_geojson, elevation_profile, is_paid,
   price_text, opening_hours, pet_friendly, category, start_lat/lng) SHALL ser
   nullable (retrocompat com destinos existentes).
3. THE textos ao usuário SHALL ter i18n pt-BR/en com `defaultValue`.
4. THE primeiro destino real **Cachoeira Alta** (GPX fornecido) SHALL ser
   cadastrado e aprovado, aparecendo no Explorar com rota, descrição, dados de
   entrada (R$ 10, fins de semana/feriados 8h–17h) e foto.

### Requisito 6: Segurança e integridade

#### Critérios de Aceitação

1. THE leitura pública de destinos SHALL continuar restrita a `approved` (ou
   próprio autor/admin), como hoje.
2. THE parsing de GPX SHALL validar tamanho e conteúdo (mínimo de 2 pontos,
   coordenadas válidas), rejeitando arquivos malformados com mensagem clara.
3. THE "Iniciar navegação" a partir do destino SHALL reutilizar o rastreamento
   existente sem degradar sua integridade.
