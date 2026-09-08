# Requirements Document

Vídeo na Atividade e na Comunidade

## Introduction

Este documento especifica o suporte a **vídeo** no aplicativo (OutVitar):
gravar/anexar um vídeo curto ao publicar na comunidade (e ao finalizar uma
atividade), e exibi-lo no feed da comunidade. Corresponde ao item 6 solicitado
pelo usuário ("Poder gravar vídeo na atividade e aparecer na comunidade").

Contexto técnico: a comunidade já suporta **imagem** por publicação
(`community_posts.image_url`, upload via `uploadCommunityPostImage` para o
bucket `community-post-images`, com o `Image_Resize_Pipeline` comprimindo a
≤5 MB). O feed exibe mídia via o componente `SafeImage` (criado no Bloco B para
evitar crash de memória). **Não há suporte a vídeo hoje.**

Lição do Bloco B (estabilidade): mídia pesada estoura a memória do WebView.
Vídeo é substancialmente maior que imagem, então **limites de tamanho e
duração são requisito de primeira classe**, não um detalhe. O vídeo deve ser
opcional e nunca degradar a estabilidade nem os fluxos já existentes.

## Glossary

- **Community_Post**: publicação da comunidade (`public.community_posts`), hoje
  com `image_url`; passará a ter `video_url` opcional.
- **Post_Video**: o vídeo anexado a um Community_Post, armazenado no Supabase
  Storage e referenciado por `video_url`.
- **Video_Bucket**: bucket dedicado no Supabase Storage para vídeos da
  comunidade (separado de `community-post-images`).
- **Max_Video_Bytes**: tamanho máximo permitido para um Post_Video.
- **Max_Video_Duration_Seconds**: duração máxima permitida para um Post_Video.
- **Allowed_Video_Types**: formatos de vídeo aceitos (ex.: MP4/WebM/QuickTime).
- **Video_Player**: o componente de reprodução de vídeo no feed, com
  atributos seguros de memória (equivalente ao `SafeImage` para vídeo).
- **Video_Poster**: imagem de pré-visualização (thumbnail) exibida antes de o
  vídeo ser reproduzido, para não decodificar o vídeo inteiro no scroll.
- **Activity_Finish_Sheet**: o formulário exibido ao finalizar uma atividade
  (`atividade.rastrear.tsx`), hoje com descrição e foto opcionais.

## Requirements

### Requirement 1: Anexar vídeo ao publicar na comunidade

**User Story:** Como usuário, quero anexar um vídeo curto à minha publicação na
comunidade, para compartilhar momentos da aventura em movimento.

#### Acceptance Criteria

1. QUANDO o usuário cria uma publicação na comunidade, ENTÃO ele DEVE poder
   selecionar/gravar um vídeo opcional, além da imagem já existente.
2. QUANDO um vídeo é selecionado, ENTÃO a OutVitar_Application DEVE gerar uma
   pré-visualização via Object_URL (`URL.createObjectURL`), nunca via base64
   (mesma regra de memória do Bloco B), revogando o Object_URL ao trocar/
   limpar/publicar/desmontar.
3. QUANDO uma publicação tem vídeo E imagem, ENTÃO a OutVitar_Application DEVE
   definir uma regra determinística de precedência de exibição (o vídeo é a
   mídia principal; a imagem serve de Video_Poster quando presente).
4. QUANDO o usuário publica sem selecionar vídeo, ENTÃO o comportamento atual
   (texto + imagem opcional) DEVE permanecer inalterado.

### Requirement 2: Limites de tamanho e duração do vídeo

**User Story:** Como usuário, quero que vídeos muito grandes ou longos sejam
recusados com uma mensagem clara, para que o app não trave nem consuma dados/
memória em excesso.

#### Acceptance Criteria

1. QUANDO o usuário seleciona um vídeo maior que o Max_Video_Bytes, ENTÃO a
   OutVitar_Application DEVE recusar o upload e exibir uma mensagem clara, sem
   travar.
2. QUANDO o usuário seleciona um vídeo com duração maior que o
   Max_Video_Duration_Seconds, ENTÃO a OutVitar_Application DEVE recusá-lo com
   mensagem clara, sem travar.
3. QUANDO o usuário seleciona um arquivo cujo tipo não está em
   Allowed_Video_Types, ENTÃO a OutVitar_Application DEVE recusá-lo com
   mensagem clara.
4. O Max_Video_Bytes e o Max_Video_Duration_Seconds DEVEM ser definidos como
   constantes de configuração (valores concretos decididos no design),
   consistentes entre a validação do cliente e a política do Video_Bucket.
5. SE a duração do vídeo não puder ser determinada no cliente antes do upload,
   ENTÃO a OutVitar_Application DEVE aplicar uma política determinística
   (recusar por segurança ou validar só por tamanho), nunca comportamento
   indefinido.

### Requirement 3: Upload e armazenamento do vídeo

**User Story:** Como usuário, quero que meu vídeo seja enviado com segurança e
associado à minha publicação, para que apareça para a comunidade.

#### Acceptance Criteria

1. QUANDO um vídeo válido é enviado, ENTÃO a OutVitar_Application DEVE
   armazená-lo no Video_Bucket, em um caminho isolado por usuário
   (`{auth.uid()}/...`), e persistir a URL em `community_posts.video_url`.
2. QUANDO o Video_Bucket é configurado, ENTÃO suas políticas DEVEM permitir
   leitura pública dos vídeos e restringir upload/alteração/remoção à pasta do
   próprio usuário, limitando tipos MIME e tamanho — espelhando o padrão já
   usado no bucket de imagens.
3. SE o upload do vídeo falhar, ENTÃO a criação da publicação DEVE falhar de
   forma clara (sem publicar um post com vídeo quebrado) OU permitir publicar
   sem o vídeo, conforme decisão determinística documentada no design — nunca
   deixar um `video_url` inválido persistido.
4. QUANDO a coluna `video_url` é adicionada a `community_posts`, ENTÃO a
   migração DEVE ser idempotente e não quebrar posts existentes (coluna
   opcional/nullable).

### Requirement 4: Exibição de vídeo no feed sem estourar memória

**User Story:** Como usuário rolando a comunidade, quero ver publicações com
vídeo sem que o app trave, para navegar pelo feed com fluidez.

#### Acceptance Criteria

1. QUANDO o feed exibe um Community_Post com Post_Video, ENTÃO a
   OutVitar_Application DEVE renderizá-lo com um Video_Player que NÃO faz
   autoplay nem pré-carrega o vídeo inteiro (`preload="none"` ou equivalente),
   exibindo o Video_Poster até o usuário iniciar a reprodução.
2. QUANDO múltiplas publicações com vídeo estão no feed, ENTÃO apenas o vídeo
   que o usuário iniciar deve ser decodificado/reproduzido — nunca todos
   simultaneamente.
3. QUANDO um Community_Post tem vídeo com Video_Poster (imagem), ENTÃO o poster
   DEVE ser exibido via a mesma estratégia segura de imagem do Bloco B
   (`SafeImage`/container de dimensão fixa).
4. QUANDO um Community_Post não tem vídeo, ENTÃO a exibição atual (imagem via
   `SafeImage`, ou fallback) DEVE permanecer inalterada.
5. SE o Post_Video falhar ao carregar, ENTÃO o feed DEVE exibir o Video_Poster
   (ou o fallback de imagem) sem quebrar o layout nem entrar em loop de erro.

### Requirement 5: Vídeo ao finalizar uma atividade

**User Story:** Como usuário que acabou de finalizar uma trilha, quero poder
anexar um vídeo curto ao compartilhar a atividade, para registrar o momento.

#### Acceptance Criteria

1. QUANDO o Activity_Finish_Sheet é exibido ao finalizar uma atividade, ENTÃO
   ele DEVE oferecer a opção de anexar um vídeo opcional, sob as mesmas regras
   de limite (Requirement 2) e memória (Requirement 1.2) da comunidade.
2. QUANDO uma atividade finalizada com vídeo gera um Community_Post
   automático (fluxo já existente), ENTÃO o `video_url` DEVE ser incluído no
   post correspondente.
3. QUANDO a atividade é finalizada sem vídeo, ENTÃO o fluxo atual de
   finalização (descrição/foto opcionais, snapshot do mapa) DEVE permanecer
   inalterado.
4. QUANDO a atividade é finalizada offline, ENTÃO o vídeo, SE anexado, DEVE ser
   tratado pela fila offline sem bloquear a sincronização dos demais dados da
   atividade — ou, se o suporte offline a vídeo não for incluído nesta
   entrega, o vídeo DEVE ser desabilitado no fluxo offline com aviso claro
   (decisão determinística documentada no design).

### Requirement 6: Preservação da estabilidade e dos fluxos existentes

**User Story:** Como usuário, quero que adicionar vídeo não quebre nada do que
já funciona na comunidade e na atividade, para manter a confiabilidade do app.

#### Acceptance Criteria

1. QUANDO o suporte a vídeo é adicionado, ENTÃO publicar/curtir/comentar/
   seguir/excluir/compartilhar e o upload de imagem existentes DEVEM continuar
   funcionando sem regressão.
2. QUANDO o suporte a vídeo é adicionado, ENTÃO o `Image_Resize_Pipeline` e o
   `SafeImage` do Bloco B DEVEM permanecer inalterados e continuar aplicados às
   imagens.
3. QUANDO o build de produção é gerado após a adição de vídeo, ENTÃO ele DEVE
   compilar sem novos erros de tipo introduzidos por esta feature.
4. QUANDO o compartilhamento (Banner_Generator) é acionado em um post com
   vídeo, ENTÃO ele DEVE continuar funcionando usando o Video_Poster/imagem
   como base, sem tentar processar o vídeo em si.
