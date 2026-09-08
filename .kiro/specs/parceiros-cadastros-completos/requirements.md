# Requirements Document

Parceiros e Cadastros Completos

## Introduction

Este documento especifica o Bloco F do plano de finalização do OutVitar,
cobrindo cinco frentes solicitadas pelo usuário:

- **Item 2 — Parceiro tem cadastro de usuário**: todo parceiro é uma conta de
  usuário com o papel `partner` (já é estrutural — `profiles.role = 'partner'`
  ligado a `auth.users`). Este documento garante e documenta essa invariante.
- **Item 3 — Avaliações**: hoje é nota única 0–5 + comentário/foto opcionais +
  XP. Decisão do usuário: manter como está (sem multicritério nem mensageria
  neste bloco). Documentado como preservação.
- **Item 8 — Seção de parceiros em Explorar**: concentrar a descoberta de
  parceiros na tela Explorar, com abas Destinos/Parceiros, mantendo as rotas
  antigas (`/marketplace`, `/mercado`) funcionando.
- **Item 9 — Busca na Home**: já existe (atalho no hero → busca unificada de
  destinos/parceiros/posts). Documentado como preservação.
- **Item 13 — Cadastros completos**: campos de documento (CPF/CNPJ), tipo
  Pessoa Física / Pessoa Jurídica, e endereço estruturado (CEP, logradouro,
  número, complemento, bairro, cidade, UF) e telefone(s), para usuário e
  parceiro, inspirado nos padrões do segmento.

Contexto técnico (do levantamento): `profiles` tem role/username/full_name/
avatar/description/category/location(texto)/website/gallery/tags/price/lat/lng/
xp e campos de confiança protegidos por trigger. Dados sensíveis de contato
vivem em `profile_contacts` (owner-only): `phone`, `instagram`, `cnpj`,
`cadastur_number`. **Faltam**: `cpf`, `person_type` (PF/PJ) e endereço
estruturado. Não há validação de dígito verificador de CPF/CNPJ hoje (só
regex de formato no compliance). A verificação CADASTUR já existe
(`cadastur_verification_requests` + selo `is_verified`).

## Glossary

- **User_Profile**: linha em `public.profiles` (todo usuário tem uma).
- **Profile_Contacts**: linha owner-only em `public.profile_contacts` com dados
  sensíveis (telefone, cnpj, cadastur, cpf a ser adicionado).
- **Person_Type**: tipo do cadastro — `pf` (Pessoa Física) ou `pj` (Pessoa
  Jurídica).
- **Structured_Address**: endereço em campos separados — CEP, logradouro,
  número, complemento, bairro, cidade, UF.
- **Partner_Account**: uma conta de usuário com `profiles.role = 'partner'`.
- **Document_Validation**: validação de CPF/CNPJ com dígito verificador (não
  apenas formato).
- **Cadastur_Request**: solicitação de verificação em
  `cadastur_verification_requests` (fluxo já existente que concede o selo
  `is_verified`).
- **Explore_Screen**: a tela Explorar (`explorar.tsx`), hoje só de destinos.
- **Partner_List**: a listagem de parceiros (hoje em `marketplace.tsx`).
- **Settings_Screen**: a tela de configurações (`configuracoes.tsx`).

## Requirements

### Requirement 1: Parceiro é uma conta de usuário (item 2)

**User Story:** Como plataforma, quero que todo parceiro seja uma conta de
usuário com papel de parceiro, para unificar identidade, login e permissões.

#### Acceptance Criteria

1. QUANDO um parceiro existe na plataforma (fora as linhas de demonstração
   pré-cadastradas), ENTÃO ele DEVE ser um User_Profile com
   `role = 'partner'` associado a uma conta em `auth.users`.
2. QUANDO um usuário se torna parceiro por verificação (fluxo Cadastur_Request/
   promoção), ENTÃO seu User_Profile DEVE passar a `role = 'partner'`
   preservando a mesma conta/login (nunca criar uma conta separada).
3. QUANDO a documentação/onboarding referencia "parceiro", ENTÃO NÃO DEVE
   existir um cadastro de parceiro desacoplado de conta de usuário para novos
   parceiros (as linhas de seed de demonstração são a única exceção conhecida e
   documentada).

### Requirement 2: Tipo de pessoa (PF/PJ) e documentos (item 13)

**User Story:** Como usuário/parceiro, quero informar se sou pessoa física ou
jurídica e meu documento correspondente, para um cadastro completo e válido.

#### Acceptance Criteria

1. QUANDO o cadastro completo é preenchido, ENTÃO o usuário DEVE poder
   selecionar o Person_Type (`pf` ou `pj`).
2. QUANDO o Person_Type é `pf`, ENTÃO o CPF DEVE ser o documento aplicável e o
   campo de CNPJ NÃO DEVE ser exigido.
3. QUANDO o Person_Type é `pj`, ENTÃO o CNPJ DEVE ser o documento aplicável e o
   CPF do responsável DEVE ser opcional.
4. QUANDO um CPF é informado, ENTÃO ele DEVE ser validado por dígito
   verificador (não apenas formato); um CPF inválido DEVE ser recusado com
   mensagem clara.
5. QUANDO um CNPJ é informado, ENTÃO ele DEVE ser validado por dígito
   verificador (não apenas formato); um CNPJ inválido DEVE ser recusado com
   mensagem clara.
6. A Document_Validation DEVE ser uma função pura e determinística (testável
   sem DOM), tratando entrada nula/vazia/malformada sem lançar exceção.
7. QUANDO documentos (CPF/CNPJ) são persistidos, ENTÃO eles DEVEM ficar em
   armazenamento owner-only (Profile_Contacts), nunca em campos publicamente
   legíveis do User_Profile.

### Requirement 3: Endereço estruturado (item 13)

**User Story:** Como usuário/parceiro, quero informar meu endereço completo em
campos estruturados, para um cadastro alinhado aos melhores apps do segmento.

#### Acceptance Criteria

1. QUANDO o cadastro completo é preenchido, ENTÃO o usuário DEVE poder informar
   um Structured_Address: CEP, logradouro, número, complemento (opcional),
   bairro, cidade e UF.
2. QUANDO um CEP é informado, ENTÃO ele DEVE ser validado quanto ao formato
   (8 dígitos) de forma determinística, sem lançar exceção em entrada
   malformada.
3. QUANDO o Structured_Address é persistido, ENTÃO ele NÃO DEVE quebrar o campo
   `location` (texto livre) já usado em telas existentes — os dois DEVEM
   coexistir, com o texto livre podendo ser derivado do estruturado quando
   fizer sentido.
4. QUANDO a migração adiciona colunas de documento/endereço, ENTÃO ela DEVE ser
   idempotente e não afetar perfis existentes (colunas nullable).

### Requirement 4: Obrigatoriedade e momento do cadastro completo (item 13)

**User Story:** Como usuário que só quer usar o app, quero que o cadastro
completo não me bloqueie; e como parceiro, quero preenchê-lo quando pedir
verificação.

#### Acceptance Criteria

1. QUANDO um aventureiro usa o app, ENTÃO o cadastro completo (CPF/endereço)
   DEVE ser opcional e nunca bloquear o uso das funcionalidades gerais.
2. QUANDO um parceiro solicita verificação (Cadastur_Request), ENTÃO os campos
   completos aplicáveis (documento conforme Person_Type, endereço, telefone,
   CADASTUR) DEVEM ser obrigatórios nesse fluxo, com mensagens claras de
   campos faltantes.
3. QUANDO o cadastro completo é salvo, ENTÃO campos válidos parciais DEVEM
   poder ser persistidos (o usuário pode completar aos poucos), exceto no
   fluxo de verificação, onde a obrigatoriedade do item 4.2 se aplica.
4. QUANDO um documento inválido é enviado em qualquer fluxo, ENTÃO ele NÃO DEVE
   ser persistido — a validação (Requirement 2.4/2.5) precede a gravação.

### Requirement 5: Edição do cadastro completo (item 13)

**User Story:** Como usuário/parceiro, quero editar meus dados completos numa
tela clara, para mantê-los atualizados.

#### Acceptance Criteria

1. QUANDO a Settings_Screen é aberta, ENTÃO ela DEVE oferecer a edição dos
   dados pessoais completos (Person_Type, documento, endereço, telefone), além
   do que já edita hoje (nome, username, localização, avatar).
2. QUANDO o usuário salva dados owner-only (documento, telefone), ENTÃO eles
   DEVEM ser gravados em Profile_Contacts por uma função dedicada, respeitando
   a allowlist (nunca gravar campos de confiança protegidos por trigger).
3. QUANDO o usuário carrega a Settings_Screen, ENTÃO os valores já salvos
   (inclusive owner-only) DEVEM ser pré-preenchidos.
4. QUANDO a edição é salva com sucesso, ENTÃO a UI DEVE refletir os novos
   valores sem exigir recarregar a página (invalidação de cache).

### Requirement 6: Parceiros concentrados em Explorar (item 8)

**User Story:** Como usuário, quero encontrar parceiros na tela Explorar,
junto dos destinos, para descobrir tudo em um só lugar.

#### Acceptance Criteria

1. QUANDO a Explore_Screen é aberta, ENTÃO ela DEVE oferecer alternância entre
   Destinos (comportamento atual) e Parceiros (a Partner_List).
2. QUANDO a aba Parceiros é selecionada, ENTÃO ela DEVE listar os parceiros
   (mesma fonte de `fetchPartners`) com busca/filtro coerentes com a tela de
   parceiros existente, sem regressão da listagem de destinos.
3. QUANDO as rotas antigas (`/marketplace`, `/mercado`, `/parceiro/:id`) são
   acessadas, ENTÃO elas DEVEM continuar funcionando (sem links quebrados),
   ainda que o caminho principal de descoberta passe a ser a Explore_Screen.
4. QUANDO o usuário toca em um parceiro na Explore_Screen, ENTÃO ele DEVE
   navegar ao detalhe do parceiro (`/parceiro/:id`) já existente.

### Requirement 7: Preservação de busca e avaliações (itens 9 e 3)

**User Story:** Como usuário, quero que a busca da Home e as avaliações
continuem funcionando como hoje, sem regressão.

#### Acceptance Criteria

1. QUANDO a Home é aberta, ENTÃO a busca existente (atalho no hero → busca
   unificada de destinos/parceiros/posts) DEVE permanecer funcionando sem
   regressão.
2. QUANDO uma avaliação é enviada, ENTÃO o fluxo atual (nota 1–5 + comentário/
   foto opcionais + XP) DEVE permanecer inalterado — este bloco NÃO introduz
   multicritério nem mensageria.

### Requirement 8: Integridade, segurança e build

**User Story:** Como plataforma, quero que os novos cadastros não exponham
dados sensíveis nem quebrem o build.

#### Acceptance Criteria

1. QUANDO documentos e telefones são armazenados, ENTÃO eles DEVEM residir em
   Profile_Contacts (RLS owner-only), nunca em colunas publicamente legíveis
   de `profiles`.
2. QUANDO campos de confiança (is_verified, role, rating, etc.) existem, ENTÃO
   o cadastro completo NÃO DEVE permitir que o usuário os altere (o trigger de
   proteção existente permanece válido).
3. QUANDO a migração é aplicada, ENTÃO ela DEVE ser idempotente e não perder
   dados existentes.
4. QUANDO o build de produção é gerado, ENTÃO ele DEVE compilar sem novos erros
   de tipo introduzidos por esta feature (além dos pré-existentes conhecidos).
