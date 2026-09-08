# Requirements Document

Rebranding OutLife → OutVitar

## Introduction

Este documento especifica o rebranding completo do aplicativo de **OutLife**
para **OutVitar**, incluindo nome exibido, logo, slogan
("VIVER É DIFERENTE DE ESTAR VIVO"), paleta de cores alinhada à nova logo
(verde escuro + laranja/sol), identificador técnico do app (`appId`) e os
metadados/assets nativos (ícone, splash, nome do app).

O nome "Outlife" aparece hoje hardcoded em vários pontos do código: título no
hero (`src/routes/index.tsx`), meta tags (`head()` de várias rotas), rodapé
"Outlife · ecossistema", strings i18n, e na configuração nativa
(`capacitor.config.ts`: `appId: "app.outlife.mobile"`, `appName: "Outlife"`).
A barra de navegação inferior (`src/components/BottomNav.tsx`) já foi
atualizada para o padrão de mercado aprovado (Início · Busca · Explorar ·
Eventos · Comunidade · Perfil) — este spec não a reestrutura, apenas garante
que rótulos/identidade estejam consistentes.

Decisões de negócio já tomadas com o usuário:
- **Trocar o `appId`** para `app.outvitar.mobile` (feito antes da primeira
  publicação, quando é seguro).
- **Ajustar a cor de acento** de azul-montanha para o laranja/sol da logo.

## Glossary

- **Brand_Name**: o nome exibido do aplicativo — passa de "Outlife" para
  "OutVitar".
- **Brand_Slogan**: o slogan oficial — "VIVER É DIFERENTE DE ESTAR VIVO".
- **Brand_Logo**: a marca gráfica (montanha + sol + pin, verde/laranja) que
  substitui o ícone `Mountain` + texto "Outlife" usado hoje.
- **App_Id**: o identificador técnico do app nas lojas
  (`capacitor.config.ts` → `appId`), hoje `app.outlife.mobile`.
- **App_Display_Name**: o nome do app no dispositivo (`appName` no
  `capacitor.config.ts` e no `AndroidManifest`/`Info.plist`).
- **Theme_Accent**: a cor de acento do tema (`--accent` em `styles.css`),
  hoje azul-montanha.
- **Sun_Color**: o laranja/sol da logo (a variável `--sun` já existe no tema).
- **I18n_Strings**: as traduções em `public/locales/{pt-BR,en}/translation.json`.
- **App_Assets**: ícone e splash screen nativos (Android/iOS), gerados via
  `@capacitor/assets`.

## Requirements

### Requirement 1: Nome exibido em toda a interface

**User Story:** Como usuário, quero ver o nome "OutVitar" em todo o app, para
que a identidade da marca seja consistente.

#### Acceptance Criteria

1. QUANDO qualquer tela exibe o nome do aplicativo ao usuário, ENTÃO ela DEVE
   exibir "OutVitar", nunca "Outlife".
2. QUANDO o hero da Home exibe a marca, ENTÃO ele DEVE exibir "OutVitar" com o
   Brand_Logo, substituindo o ícone `Mountain` + texto "Outlife" atual.
3. QUANDO uma string i18n contém "Outlife", ENTÃO ela DEVE ser atualizada
   manualmente durante o desenvolvimento (não em tempo de execução) para
   "OutVitar" em pt-BR e en, preservando o restante do texto.
4. QUANDO um texto de metadados voltado ao usuário (títulos de página, og:title,
   descrições) contém "Outlife", ENTÃO ele DEVE ser atualizado para "OutVitar".

### Requirement 2: Slogan oficial

**User Story:** Como usuário, quero ver o slogan "VIVER É DIFERENTE DE ESTAR
VIVO", para entender a proposta da marca.

#### Acceptance Criteria

1. QUANDO a Home exibe a seção de slogan, ENTÃO ela DEVE exibir exclusivamente
   "VIVER É DIFERENTE DE ESTAR VIVO" como Brand_Slogan, sem nenhum outro
   slogan na mesma seção.
2. QUANDO o rodapé de marca é exibido (hoje "Outlife · ecossistema"), ENTÃO ele
   DEVE refletir a nova marca ("OutVitar").
3. O Brand_Slogan DEVE ser definido como string i18n em pt-BR e en (não
   hardcoded em componente), permitindo tradução.

### Requirement 3: Logo da marca

**User Story:** Como usuário, quero ver a nova logo do OutVitar, para
reconhecer a marca visualmente.

#### Acceptance Criteria

1. QUANDO a marca é exibida na interface (hero, telas de marca), ENTÃO o
   Brand_Logo DEVE ser usado no lugar do ícone `Mountain` + texto atual.
2. QUANDO o Brand_Logo não puder ser carregado, ENTÃO a interface DEVE ter um
   fallback textual "OutVitar" sem quebrar o layout.
3. SE o fallback textual também não estiver disponível, ENTÃO a interface DEVE
   exibir um espaço vazio ou placeholder no lugar do logo, sem quebrar o
   layout nem lançar erro.
4. O Brand_Logo DEVE ser fornecido como asset no projeto (`src/assets/` ou
   `public/`), referenciado de forma centralizada.

### Requirement 4: Paleta de cores alinhada à logo

**User Story:** Como usuário, quero que as cores do app combinem com a logo,
para uma experiência de marca coesa.

#### Acceptance Criteria

1. QUANDO o tema é aplicado, ENTÃO o Theme_Accent DEVE usar o Sun_Color
   (laranja/sol) da logo, em vez do azul-montanha atual.
2. QUANDO o tema claro e o tema escuro são aplicados, ENTÃO ambos DEVEM
   refletir o novo Theme_Accent de forma consistente.
3. QUANDO a cor de acento muda, ENTÃO o contraste de texto sobre o acento
   (`--accent-foreground`) DEVE permanecer legível (acessível).
4. QUANDO elementos que hoje usam o acento azul são renderizados, ENTÃO eles
   DEVEM continuar funcionando visualmente com a nova cor, sem quebra de
   layout.

### Requirement 5: Identificador e nome técnico do app

**User Story:** Como responsável pela publicação, quero que o app tenha o
identificador e nome corretos do OutVitar, para publicá-lo com a marca certa.

#### Acceptance Criteria

1. QUANDO o `capacitor.config.ts` é lido, ENTÃO o App_Id DEVE ser
   `app.outvitar.mobile` e o App_Display_Name DEVE ser "OutVitar".
2. QUANDO o projeto nativo é sincronizado, ENTÃO o App_Display_Name DEVE
   aparecer como "OutVitar" no dispositivo (Android/iOS).
3. QUANDO a mudança de App_Id é aplicada, ENTÃO ela DEVE ser feita antes da
   primeira publicação nas lojas (nenhum app publicado ainda depende do id
   antigo).
4. QUANDO houver referências ao identificador antigo em configs de build
   (Android `applicationId`, iOS bundle), ENTÃO elas DEVEM ser atualizadas de
   forma consistente com o App_Id.

### Requirement 6: Ícone e splash nativos

**User Story:** Como usuário, quero ver o ícone e a splash do OutVitar ao
abrir o app, para reconhecer a marca desde o lançamento.

#### Acceptance Criteria

1. QUANDO os App_Assets são gerados, ENTÃO o ícone e a splash DEVEM usar o
   Brand_Logo da OutVitar.
2. QUANDO os App_Assets são gerados, ENTÃO eles DEVEM cobrir os tamanhos
   exigidos por Android e iOS, via `@capacitor/assets`.
3. QUANDO o ícone é gerado, ENTÃO ele DEVE atender às restrições da Apple
   (1024×1024, sem transparência, sem cantos arredondados manuais).
4. SE a verificação de conformidade com as restrições da Apple falhar, ENTÃO a
   geração do ícone DEVE ser bloqueada (não produzir um ícone inválido),
   sinalizando o problema para correção antes de prosseguir.

### Requirement 7: Consistência e ausência de referências antigas

**User Story:** Como responsável pela qualidade, quero garantir que não sobrem
referências a "Outlife" voltadas ao usuário, para evitar inconsistência de
marca.

#### Acceptance Criteria

1. QUANDO o rebranding é concluído, ENTÃO NÃO DEVE haver nenhuma string
   "Outlife" voltada ao usuário (interface, i18n, metadados, nome do app).
2. QUANDO existirem referências técnicas internas a "outlife" que NÃO são
   voltadas ao usuário (ex.: nome do storeName do localforage `"outlife"`,
   chaves internas, nomes de buckets já criados no Supabase), ENTÃO elas
   PODEM ser mantidas para não quebrar dados/integrações existentes, desde
   que não apareçam ao usuário.
3. QUANDO uma referência interna a "outlife" precisar ser mantida (Req 7.2),
   ENTÃO essa decisão DEVE estar documentada para não gerar confusão futura.
4. QUANDO o build de produção é gerado após o rebranding, ENTÃO ele DEVE
   compilar sem erros novos introduzidos pela troca de marca.
