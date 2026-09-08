# Design Document

Rebranding OutLife → OutVitar

## Overview

Este design implementa o rebranding completo de OutLife para OutVitar em cinco
frentes: (1) nome/slogan em i18n e componentes; (2) logo como asset
centralizado com fallback; (3) tema — acento vira o laranja/sol da logo; (4)
identidade técnica nativa (`appId`, `appName`, Android `applicationId`/
`namespace`); (5) assets nativos (ícone/splash) via `@capacitor/assets`.

Princípio: **centralizar a marca** para evitar strings soltas. O nome e o
slogan passam a viver em i18n (`translation.json`); o logo vira um componente
`BrandLogo` reutilizável com fallback textual. Referências técnicas internas a
"outlife" que não aparecem ao usuário (storeName do localforage, buckets do
Supabase já criados) são **mantidas** para não quebrar dados/integrações, e
essa decisão fica documentada.

## Architecture

```mermaid
flowchart TD
    subgraph Marca_UI
      L[BrandLogo component<br/>asset + fallback texto]
      I18N[translation.json<br/>nome + slogan]
    end
    subgraph Tema
      CSS[styles.css<br/>--accent = --sun laranja]
    end
    subgraph Nativo
      CAP[capacitor.config.ts<br/>appId + appName]
      GRADLE[build.gradle<br/>applicationId + namespace]
      STR[strings.xml<br/>app_name]
      ASSETS[@capacitor/assets<br/>ícone + splash]
    end
    L --> Home[index.tsx / telas de marca]
    I18N --> Home
    CSS --> Todas[todas as telas]
    CAP --> GRADLE
    CAP --> STR
    LOGO[assets/logo-outvitar.png<br/>1024x1024] --> L
    LOGO --> ASSETS
```

## Components and Interfaces

### 1. `src/components/BrandLogo.tsx` (novo)

Componente único da marca, com fallback textual (Req 3.2/3.3).

```tsx
export interface BrandLogoProps {
  /** Altura em px (largura proporcional). */
  size?: number;
  /** Cor do texto de fallback (ex.: "text-white" no hero). */
  className?: string;
  /** Exibe o nome ao lado do símbolo (default true). */
  withWordmark?: boolean;
}

export function BrandLogo(props: BrandLogoProps): JSX.Element;
```

Comportamento:
- Renderiza `<img src={logoOutvitar} alt="OutVitar" />` (símbolo) + wordmark
  "OutVitar".
- `onError` da `<img>` → esconde a imagem e mostra apenas o texto "OutVitar"
  (fallback, Req 3.2). Se o texto também falhar (sem i18n), o container
  permanece vazio sem quebrar layout (Req 3.3).
- Usado no hero (`index.tsx`) no lugar do `Mountain` + `<span>Outlife</span>`.

### 2. i18n — nome e slogan (`translation.json`)

Novas/atualizadas chaves em pt-BR e en:

```jsonc
{
  "brand": {
    "name": "OutVitar",
    "slogan": "VIVER É DIFERENTE DE ESTAR VIVO",
    "ecosystem": "OutVitar · ecossistema"
  },
  "home": { "slogan": "VIVER É DIFERENTE DE ESTAR VIVO" }  // atualiza a existente
}
```

Todas as ocorrências de "Outlife" em `translation.json` (ambos idiomas) são
substituídas por "OutVitar" manualmente (Req 1.3). O slogan é referenciado via
`t("brand.slogan")` na Home (Req 2.1/2.3), exibido exclusivamente na seção de
slogan.

### 3. Metadados de rota (`head()`)

Em cada rota com `head()` contendo "Outlife" (index, comunidade, etc.),
substituir por "OutVitar" nos `title`/`og:title`/`description` (Req 1.4).
São strings estáticas nos arquivos de rota — substituição textual direta.

### 4. Tema (`styles.css`)

O acento passa a usar o laranja/sol. A variável `--sun` já existe
(`oklch(0.78 0.14 70)`). Ajuste:

```css
:root {
  /* accent = laranja/sol da logo OutVitar (antes: azul-montanha) */
  --accent: oklch(0.70 0.17 55);            /* laranja vibrante */
  --accent-foreground: oklch(0.99 0.01 90); /* contraste sobre laranja */
}
.dark {
  --accent: oklch(0.72 0.16 58);
  --accent-foreground: oklch(0.18 0.04 155);
}
```

- Comentário do tema atualizado de "Outlife palette" para "OutVitar palette".
- `--mountain` (azul) é mantido como token disponível, mas o `--accent` deixa
  de apontar para azul. Elementos que usam `accent` passam a exibir laranja
  automaticamente, sem mudança de layout (Req 4.4).
- Contraste `--accent-foreground` escolhido para legibilidade (Req 4.3).

### 5. Configuração nativa

`capacitor.config.ts`:
```ts
appId: "app.outvitar.mobile",   // era app.outlife.mobile (Req 5.1)
appName: "OutVitar",            // era Outlife
```

`android/app/build.gradle`:
```groovy
namespace = "app.outvitar.mobile"
applicationId "app.outvitar.mobile"
```

`android/app/src/main/res/values/strings.xml`: `app_name` e demais entradas de
nome → "OutVitar" (Req 5.2). A pasta Java do namespace antigo
(`android/app/src/main/java/app/outlife/mobile/`) precisa ser movida para
`app/outvitar/mobile/` e o `package` das classes atualizado (Capacitor gera
`MainActivity`). Alternativa mais segura: `npx cap sync` após alterar o
config regenera parte disso; a mudança de `namespace`/`applicationId` no
Gradle é o ponto crítico.

> **Nota (Req 5.3):** como o app ainda não foi publicado, a troca de `appId`
> é segura (nenhum registro de loja depende do id antigo).

### 6. Assets nativos (`@capacitor/assets`)

Com `assets/logo-outvitar.png` (1024×1024, sem transparência para o ícone —
Req 6.3) e opcionalmente `assets/splash.png`:

```
npm i -D @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor '#1f3d2b' --splashBackgroundColor '#1f3d2b'
```

- Gera ícones/splash para Android (e iOS quando a pasta existir). Req 6.1/6.2.
- **Verificação Apple-compliant (Req 6.4):** antes de gerar, validar que o
  `logo-outvitar.png` é 1024×1024 e sem canal alpha; se não for, abortar a
  geração com mensagem, sem produzir ícone inválido.

## Data Models

Nenhuma mudança de schema. Nenhuma migração de dados. As referências internas
técnicas a "outlife" são preservadas (ver Error Handling / decisões).

## Error Handling

- **Logo não carrega**: `BrandLogo.onError` cai para o wordmark textual
  "OutVitar" (Req 3.2); se indisponível, container vazio sem quebrar (Req 3.3).
- **Asset da logo ausente no build de assets**: o comando `capacitor-assets`
  falha explicitamente; a tarefa de assets só roda quando o arquivo existe
  (documentado como pré-requisito).
- **Ícone fora do padrão Apple**: verificação bloqueia a geração (Req 6.4) em
  vez de produzir um ícone que seria rejeitado na revisão.
- **Referências internas a "outlife"** (localforage storeName `"outlife"`,
  bucket `community-post-images`, etc.): **mantidas intencionalmente** — trocar
  o storeName do localforage invalidaria a fila offline e a atividade ativa já
  persistida no dispositivo do usuário; renomear buckets do Supabase quebraria
  URLs já salvas em `image_url`. Documentado no design e no roadmap (Req 7.2/7.3).

## Testing Strategy

- **`BrandLogo`**: como o projeto não tem testing-library/jsdom, extrair a
  decisão de fallback para função pura (padrão já usado em `SafeImage`) e
  testá-la (fallback aplicado corretamente).
- **i18n**: teste que verifica que nenhuma chave de `translation.json` (pt-BR/
  en) contém a string "Outlife" (Req 7.1) — teste de guarda simples lendo o
  JSON.
- **Verificação final**: `npx tsc --noEmit` sem novos erros (Req 7.4); busca
  textual por "Outlife" em `src/` restrita a ocorrências voltadas ao usuário.

## Correctness Properties

### Property 1: Sem "Outlife" voltado ao usuário
Após o rebranding, nenhuma string de i18n (pt-BR/en) nem metadado de rota
voltado ao usuário contém "Outlife".
**Validates: Requirements 1.1, 1.3, 1.4, 7.1**

### Property 2: Slogan exclusivo e traduzível
A seção de slogan da Home exibe exclusivamente `t("brand.slogan")` = "VIVER É
DIFERENTE DE ESTAR VIVO", definido em pt-BR e en.
**Validates: Requirements 2.1, 2.3**

### Property 3: Logo com fallback seguro
Quando a imagem do logo falha, `BrandLogo` exibe o wordmark textual; quando
nem isso, um container vazio — nunca quebra o layout nem lança.
**Validates: Requirements 3.2, 3.3**

### Property 4: Identidade técnica consistente
`appId`, `appName`, `applicationId` e `namespace` referenciam a marca OutVitar
de forma consistente (`app.outvitar.mobile` / "OutVitar").
**Validates: Requirements 5.1, 5.2, 5.4**

### Property 5: Referências internas preservadas e documentadas
Referências técnicas a "outlife" mantidas (localforage storeName, buckets)
não aparecem ao usuário e estão documentadas.
**Validates: Requirements 7.2, 7.3**

## Decisões e trade-offs

- **Nome/slogan em i18n, não hardcoded**: centraliza a marca e permite
  tradução; alinhado ao padrão do projeto (tudo já passa por `t()`).
- **Manter tokens de tema (`--mountain` azul)**: só reaponta o `--accent` para
  laranja em vez de remover o azul, minimizando risco de quebra visual em
  telas que referenciam o token diretamente.
- **Preservar referências internas "outlife"**: renomear storeName do
  localforage e buckets do Supabase quebraria dados/URLs já persistidos no
  dispositivo e no banco — o custo supera o benefício estético, já que não são
  visíveis ao usuário. Documentado.
- **appId trocado agora**: seguro porque nada foi publicado; adiar tornaria a
  troca destrutiva (novo app na loja).
- **Logo como pré-requisito de assets**: a geração de ícone/splash depende do
  arquivo `assets/logo-outvitar.png` fornecido pelo usuário; enquanto não
  houver, a parte de UI (`BrandLogo` com fallback textual) já funciona, e a
  tarefa de assets nativos fica bloqueada até o arquivo existir.
