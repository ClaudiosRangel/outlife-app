# Requirements Document

Requisitos — Segmentos nativos (estilo Strava)

## Introduction

O usuário quer segmentos como no Strava, porém **nativos do OutVitar** (não
importados do Strava, decisão registrada). Um segmento é um trecho de percurso
(ex.: uma subida, um trecho de trilha) que qualquer usuário pode percorrer; o
app registra o tempo de cada passagem (esforço) e mantém um ranking dos
**10 melhores** por tempo. O card da comunidade (frente #3/#4) já tem um slot
pronto para exibir a conquista de segmento.

Restrições do projeto: não reescrever a base de rastreamento
(`use-activity-tracker.ts` grava pontos `{lat,lng,ts}` e um `route_geojson`
LineString); estender. Confiabilidade estilo Strava é o padrão. Migrations
idempotentes aplicadas em produção.

## Glossary

- **Segmento**: trecho de percurso definido por uma polilinha (LineString) com
  pontos de início e fim, distância e dono/criador.
- **Esforço (effort)**: uma passagem de um usuário por um segmento, com o tempo
  gasto e a atividade de origem.
- **Ranking/leaderboard**: lista ordenada dos melhores esforços do segmento
  (top 10), um por usuário (o melhor tempo de cada um).
- **Matching**: detecção de que o trajeto de uma atividade percorreu um
  segmento (passou perto do início e do fim, na ordem).

## Requirements

### Requisito 1 — Criar segmento

**User Story:** Como usuário, quero criar um segmento a partir de um trecho,
para que outras pessoas possam competir nele.

#### Critérios de Aceitação
1. QUANDO o usuário criar um segmento ENTÃO DEVE informar nome, tipo de
   atividade e a geometria (polilinha) — na primeira versão, derivada de uma
   atividade já gravada (recorte do trajeto) ou do trajeto inteiro.
2. QUANDO o segmento for criado ENTÃO o sistema DEVE calcular e guardar seus
   pontos de início/fim e a distância.
3. QUANDO o segmento for criado ENTÃO DEVE ficar visível/consultável por outros
   usuários (leitura pública), com o criador registrado.

### Requisito 2 — Detecção de esforço ao concluir atividade

**User Story:** Como usuário, quero que ao terminar uma atividade o app
identifique automaticamente por quais segmentos passei e registre meu tempo.

#### Critérios de Aceitação
1. QUANDO uma atividade for finalizada ENTÃO o sistema DEVE verificar os
   segmentos candidatos (próximos ao trajeto) e, para cada um efetivamente
   percorrido, registrar um esforço com o tempo gasto no trecho.
2. QUANDO o trajeto passar perto do início e depois do fim do segmento (na
   ordem, dentro de um raio de tolerância) ENTÃO conta como percorrido; o tempo
   é a diferença entre os timestamps dos pontos mais próximos do início e do
   fim.
3. QUANDO o trajeto não cobrir o segmento (só início, ou fora de ordem, ou
   distância incompatível) ENTÃO NÃO DEVE registrar esforço (evitar falso
   positivo).
4. QUANDO o esforço for registrado ENTÃO DEVE vincular usuário, segmento,
   atividade, tempo (segundos) e data.
5. QUANDO a detecção rodar ENTÃO NÃO DEVE degradar/travar o salvamento da
   atividade (é complementar; falha na detecção não impede salvar a atividade).

### Requisito 3 — Ranking do segmento (top 10)

**User Story:** Como usuário, quero ver o ranking dos 10 melhores tempos de um
segmento, para saber minha colocação.

#### Critérios de Aceitação
1. QUANDO o ranking for exibido ENTÃO DEVE mostrar os 10 melhores tempos, um
   por usuário (o melhor tempo de cada), do menor para o maior.
2. QUANDO o ranking for exibido ENTÃO DEVE mostrar nome/avatar e o tempo de
   cada colocado, destacando a posição do usuário atual quando aplicável.
3. QUANDO houver empate/poucos esforços ENTÃO DEVE exibir apenas os existentes,
   sem quebrar.

### Requisito 4 — Isolamento e integridade dos dados

**User Story:** Como operador, quero que os dados de segmento/esforço sejam
consistentes e seguros.

#### Critérios de Aceitação
1. QUANDO um esforço for gravado ENTÃO DEVE ser do próprio usuário autenticado
   (não é possível gravar esforço em nome de outro).
2. QUANDO segmentos/esforços forem lidos ENTÃO a leitura é pública (ranking),
   mas a escrita é restrita ao dono do dado.
3. QUANDO uma atividade for excluída/conta excluída ENTÃO os esforços do
   usuário DEVEM ser removidos em cascata (integração com a exclusão de conta
   já existente).

### Requisito 5 — Exibição no app

**User Story:** Como usuário, quero acessar segmentos e ver conquistas.

#### Critérios de Aceitação
1. QUANDO eu concluir uma atividade que bateu recorde pessoal ou entrou no top
   10 de um segmento ENTÃO o app PODE exibir esse destaque (no card da
   comunidade — slot já existente — e/ou na tela do segmento).
2. QUANDO eu abrir um segmento ENTÃO DEVE mostrar seus dados (nome, distância,
   tipo) e o ranking.
