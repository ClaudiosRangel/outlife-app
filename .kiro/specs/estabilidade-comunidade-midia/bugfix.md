# Bugfix Document

Estabilidade da Comunidade — crash por estouro de memória em fotos

## Introduction

O aplicativo (OutVitar) fecha inesperadamente (crash) ao exibir ou selecionar
determinadas fotos na Comunidade. O sintoma relatado pelo usuário é que "em
determinadas fotos" o app fecha, o que indica dependência do **tamanho/
resolução** da imagem — imagens grandes estouram a memória do WebView.

Este documento aplica a metodologia de correção por **condição de bug**:
identificar a condição `C(X)` sob a qual o crash ocorre, corrigir para que a
condição deixe de causar crash (Fix), e garantir que os comportamentos
corretos existentes continuem preservados (Preservation).

## Glossary

- **Community_Feed**: a tela da Comunidade (`src/routes/comunidade.tsx`) que
  lista publicações (`community_posts`), cada uma podendo conter uma imagem.
- **Post_Image**: a imagem de uma publicação, referenciada por
  `community_posts.image_url` e exibida via `<img src=...>`.
- **Image_Preview**: a pré-visualização da foto selecionada no formulário de
  nova publicação, antes do upload.
- **Data_URL_Preview**: a técnica atual de preview via
  `FileReader.readAsDataURL`, que materializa a imagem inteira como string
  base64 em memória.
- **Object_URL_Preview**: preview via `URL.createObjectURL`, que referencia o
  arquivo sem copiá-lo para memória como base64.
- **Image_Resize_Pipeline**: o pipeline já existente
  (`src/lib/image-resize.ts`, aplicado em `src/lib/api.ts` no upload) que
  redimensiona/comprime imagens antes de enviá-las ao Supabase.
- **Decode_Dimension_Cap**: um teto de dimensão (largura/altura em pixels)
  aplicado à decodificação/exibição de imagens para limitar o uso de memória.
- **Crash_Condition C(X)**: a condição sob a qual o app fecha — decodificar
  em memória uma ou mais imagens cuja resolução (largura × altura em pixels)
  e/ou tamanho de arquivo excede o que o WebView do dispositivo suporta
  simultaneamente.

## Bug Condition

**C(X)** ocorre quando a Community_Feed (ou o Image_Preview) decodifica em
memória uma imagem `X` tal que:

1. `X` é exibida/pré-visualizada em resolução original (sem
   Decode_Dimension_Cap), e
2. a resolução de `X` (ou a soma das imagens decodificadas simultaneamente na
   viewport) excede o orçamento de memória do WebView do dispositivo,

resultando em encerramento inesperado do aplicativo. Um caso particular de
`C(X)` é o Image_Preview via Data_URL_Preview, que materializa `X` inteira
como base64 (custo de memória ~1.33× o arquivo) apenas para exibir a prévia.

## Bug Analysis

### Current Behavior (Defect)

Ao abrir a Comunidade ou selecionar uma foto grande, o app fecha
inesperadamente em determinados dispositivos/imagens. Duas causas concretas
no código atual:

1. **Preview via base64** — `comunidade.tsx` usa
   `FileReader.readAsDataURL(file)` para gerar o Image_Preview. Isso
   materializa a imagem inteira (original, potencialmente 10MB+) como string
   base64 em memória (custo ~1.33× o arquivo), além do próprio `File`. Uma
   foto grande aqui pode estourar o orçamento de memória do WebView.
2. **Exibição em resolução original** — as Post_Images do feed usam
   `<img src={p.img}>` apontando diretamente para `community_posts.image_url`
   (arquivo cheio no Supabase), sem Decode_Dimension_Cap. Decodificar várias
   imagens de alta resolução simultaneamente estoura a memória. O
   `loading="lazy"` existente reduz, mas não limita a resolução decodificada.

### Expected Behavior (Correct)

1. O Image_Preview deve usar Object_URL_Preview (`URL.createObjectURL`), que
   referencia o arquivo sem copiá-lo como base64, e revogar o URL quando não
   mais necessário.
2. As Post_Images devem ser exibidas com um Decode_Dimension_Cap que limita a
   resolução efetivamente decodificada no cliente, sem estourar memória, e
   sem alterar o arquivo persistido no Supabase.
3. O Image_Resize_Pipeline no upload permanece aplicado (já comprime para até
   5 MB) — reforçando que fotos novas entram já em tamanho seguro.

### Unchanged Behavior (Regression Prevention)

1. Publicar, curtir, comentar, seguir, excluir e compartilhar publicações
   continuam funcionando exatamente como antes.
2. O fallback de imagem padrão (`community1`) para posts sem imagem é
   preservado.
3. Posts de atividade (`activityId`) continuam abrindo o detalhe da atividade
   ao tocar na imagem.
4. O Image_Resize_Pipeline e seu fallback silencioso no upload permanecem
   inalterados.
5. O compartilhamento via Banner_Generator continua funcional.

## Requirements

### Requirement 1: Preview de imagem sem materializar base64 em memória

**User Story:** Como usuário selecionando uma foto grande para publicar,
quero que a pré-visualização não trave nem feche o app, para conseguir
publicar fotos de alta resolução com segurança.

#### Acceptance Criteria

1. QUANDO o usuário seleciona uma foto no formulário de nova publicação,
   ENTÃO a OutVitar_Application DEVE gerar o Image_Preview via
   Object_URL_Preview (`URL.createObjectURL`), NÃO via Data_URL_Preview
   (`readAsDataURL`).
2. QUANDO o Image_Preview deixa de ser necessário (formulário fechado, foto
   trocada, ou publicação concluída), ENTÃO a OutVitar_Application DEVE
   revogar o Object_URL correspondente (`URL.revokeObjectURL`), sem vazar
   referências de memória.
3. QUANDO uma nova foto é selecionada substituindo uma anterior, ENTÃO o
   Object_URL da foto anterior DEVE ser revogado antes de criar o novo.

### Requirement 2: Teto de dimensão na exibição de imagens do feed

**User Story:** Como usuário rolando a Comunidade, quero que fotos de alta
resolução sejam exibidas sem fechar o app, para navegar pelo feed sem
travamentos.

#### Acceptance Criteria

1. QUANDO a Community_Feed exibe uma Post_Image, ENTÃO a OutVitar_Application
   DEVE limitar a resolução efetivamente decodificada/renderizada a um
   Decode_Dimension_Cap definido, em vez da resolução original arbitrária.
2. QUANDO uma Post_Image tem resolução original menor ou igual ao
   Decode_Dimension_Cap, ENTÃO ela DEVE ser exibida normalmente sem
   degradação adicional.
3. QUANDO múltiplas Post_Images estão presentes no feed, ENTÃO a
   OutVitar_Application DEVE continuar carregando-as de forma preguiçosa
   (`loading="lazy"`), sem decodificar todas simultaneamente.
4. A exibição com Decode_Dimension_Cap NÃO DEVE alterar a imagem persistida
   no Supabase — o teto aplica-se apenas à decodificação/exibição no cliente.

### Requirement 3: Limites de validação no upload preservados e reforçados

**User Story:** Como usuário, quero que fotos enviadas sejam sempre
comprimidas para um tamanho seguro, para que nem eu nem outros usuários
tenham o app fechado ao ver minhas fotos.

#### Acceptance Criteria

1. QUANDO uma imagem é enviada (publicação, avaliação, atividade), ENTÃO o
   Image_Resize_Pipeline existente DEVE continuar sendo aplicado antes do
   upload, sem regressão.
2. SE o Image_Resize_Pipeline falhar, ENTÃO o comportamento de fallback já
   existente (retornar o arquivo original e deixar a validação de tamanho
   decidir) DEVE ser preservado.
3. QUANDO uma imagem excede o limite de tamanho após o pipeline, ENTÃO a
   validação de tamanho existente DEVE continuar rejeitando o upload com
   mensagem ao usuário, sem crash.

### Requirement 4: Preservação do comportamento correto da Comunidade

**User Story:** Como usuário, quero que todas as funções da Comunidade
(publicar, curtir, comentar, seguir, excluir, compartilhar) continuem
funcionando após a correção de estabilidade, para não perder nenhuma
funcionalidade.

#### Acceptance Criteria

1. QUANDO a correção de estabilidade é aplicada, ENTÃO publicar, curtir,
   comentar, seguir, excluir e compartilhar publicações DEVEM continuar
   funcionando exatamente como antes.
2. QUANDO uma publicação não tem imagem, ENTÃO a exibição do fallback de
   imagem padrão (`community1`) DEVE ser preservada.
3. QUANDO uma publicação foi gerada a partir de uma atividade
   (`activityId` presente), ENTÃO o comportamento de abrir o detalhe da
   atividade ao tocar na imagem DEVE ser preservado.
4. QUANDO a correção é aplicada, ENTÃO o compartilhamento via
   Banner_Generator (que também decodifica a imagem) DEVE permanecer
   funcional e NÃO DEVE reintroduzir a Crash_Condition.
