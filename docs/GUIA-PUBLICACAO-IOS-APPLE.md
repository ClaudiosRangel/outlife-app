# Guia de Publicação iOS — OutVitar (App Store / TestFlight)

> **Objetivo:** subir o OutVitar para a App Store (beta via TestFlight) **sem
> ter um Mac**, usando o Codemagic (macOS na nuvem) para compilar.
>
> **Conta Apple Developer:** Rafael Vieira · outvitar@gmail.com ·
> Enrollment ID **J3CXAHA4Y4** (já ativa).
>
> **Bundle ID técnico:** `app.outlife.mobile` (mantido na beta — invisível ao
> usuário; o nome exibido já é "OutVitar"). Trocar para `app.outvitar.mobile`
> fica para uma versão futura, se desejado, e exigiria recriar o App ID.

---

## Visão geral do fluxo

```
[Código no repo]  →  [Codemagic (macOS nuvem)]  →  [App Store Connect / TestFlight]  →  [Testadores]
     (feito aqui)         (compila o .ipa)              (você gerencia a beta)
```

Você NÃO precisa de Mac. O Codemagic tem um tier gratuito (500 min/mês de
macOS M-series) que compila o `.ipa` e envia direto pro TestFlight.

Há **duas grandes etapas**:
- **Parte A — o que já foi feito no código** (pasta `ios/`, `codemagic.yaml`).
- **Parte B — o que VOCÊ faz nos painéis** (Apple + Codemagic + Firebase iOS).

---

## PARTE A — Feito no código (checar)

- [x] `@capacitor/ios` instalado (package.json).
- [x] Pasta `ios/` gerada via `npx cap add ios` (projeto Xcode do Capacitor).
- [x] `codemagic.yaml` criado na raiz (pipeline de build iOS + TestFlight).
- [x] Nome exibido "OutVitar" e `appId` `app.outlife.mobile` consistentes.

> Se a pasta `ios/` ainda não existir (ex.: o build travou), rode localmente
> quando possível: `npm run build:native` e depois `npx cap add ios`. O
> `codemagic.yaml` também gera a pasta automaticamente na nuvem caso falte.

---

## PARTE B — Passo a passo nos painéis (você)

### B1. Apple Developer — criar o App ID (Identifier)

1. Acesse https://developer.apple.com/account → **Certificates, IDs & Profiles**
   → **Identifiers** → botão **+**.
2. Selecione **App IDs** → **App**.
3. Preencha:
   - **Description:** `OutVitar`
   - **Bundle ID:** **Explicit** → `app.outlife.mobile`
4. Em **Capabilities**, marque:
   - **Push Notifications** (necessário para o push via Firebase/APNs).
   - **Associated Domains** (só se for usar deep links verificados; opcional
     na beta).
5. **Continue → Register.**

### B2. Apple Developer — criar a APNs Key (push no iOS)

> O push no iOS usa **APNs** (não o mesmo mecanismo do Android). O Firebase
> precisa dessa chave para enviar push para iPhones.

1. Em **Keys** → **+**.
2. Nome: `OutVitar APNs`. Marque **Apple Push Notifications service (APNs)**.
3. **Continue → Register → Download** o arquivo `.p8` (⚠️ só pode baixar UMA
   vez — guarde bem).
4. Anote o **Key ID** (10 caracteres) e o seu **Team ID** (canto superior
   direito do portal).

### B3. App Store Connect — criar a ficha do app

1. Acesse https://appstoreconnect.apple.com → **My Apps** → **+** → **New App**.
2. Preencha:
   - **Platforms:** iOS
   - **Name:** `OutVitar`
   - **Primary Language:** Portuguese (Brazil)
   - **Bundle ID:** selecione `app.outlife.mobile` (o App ID do passo B1)
   - **SKU:** `outvitar-001` (qualquer identificador interno único)
   - **User Access:** Full Access
3. **Create.**
4. Anote o **Apple ID do app** (número em **App Information**) — vai no
   Codemagic como `APP_STORE_APPLE_ID`.

### B4. App Store Connect — API Key (para o Codemagic assinar/enviar)

> Essa chave deixa o Codemagic criar certificados/perfis e enviar builds
> automaticamente. É o que elimina a necessidade de Mac/Xcode manual.

1. Em App Store Connect → **Users and Access** → aba **Integrations** →
   **App Store Connect API** → **+** (Team Keys).
2. Nome: `Codemagic`. **Access:** `App Manager`.
3. **Generate** → **Download** o `.p8` (⚠️ só uma vez — guarde).
4. Anote o **Key ID** e o **Issuer ID** (mostrados no topo da aba).

### B5. Codemagic — conectar e configurar

1. Crie conta grátis em https://codemagic.io (login com o GitHub/GitLab onde
   está o repo do OutVitar).
2. **Add application** → selecione o repositório → o Codemagic detecta o
   `codemagic.yaml`.
3. **Teams → Integrations → App Store Connect → Connect:**
   - **Issuer ID**, **Key ID** e o arquivo **`.p8`** do passo B4.
   - Dê um nome à integração (ex.: `Apple ASC`).
4. **Environment variables** → crie um grupo chamado **`appstore`** com:
   - `APP_STORE_APPLE_ID` = o número do passo B3.
   - (A assinatura é automática via integração — não precisa colar
     certificados.)
5. Em **Code signing identities**, deixe o Codemagic gerenciar
   automaticamente (automatic signing via a API key).

### B6. Firebase — adicionar o app iOS (push)

1. Firebase Console → projeto do OutLife/OutVitar → **Project settings** →
   **Your apps** → **Add app** → **iOS**.
2. **Apple bundle ID:** `app.outlife.mobile`. Registre.
3. Baixe o **`GoogleService-Info.plist`**.
4. Em **Project settings → Cloud Messaging → Apple app configuration**, faça
   **upload da APNs Key `.p8`** (passo B2) com Key ID + Team ID.
5. O `GoogleService-Info.plist` precisa ir para `ios/App/App/` no build. Duas
   opções:
   - **Simples:** commitar o arquivo em `ios/App/App/GoogleService-Info.plist`
     (ele NÃO contém segredo crítico — é config pública do cliente Firebase).
   - **Seguro:** subir como variável de ambiente no Codemagic e escrever o
     arquivo num script de build (peça ajuda ao Kiro para adicionar esse passo
     ao `codemagic.yaml` se preferir esse caminho).

### B7. Rodar a primeira build no TestFlight

1. No Codemagic, abra o app → workflow **"OutVitar iOS — TestFlight"** →
   **Start new build** (branch `main`).
2. Acompanhe os logs. Ao final, o `.ipa` é enviado ao App Store Connect.
3. Em App Store Connect → **TestFlight**, a build aparece em
   "Processing" (alguns minutos). Depois você responde ao questionário de
   **Export Compliance** (criptografia): o app usa só HTTPS padrão → em geral
   **"No"** para criptografia proprietária (confirme sua situação).

### B8. Convidar testadores (beta fechada)

1. Em **TestFlight → Internal Testing**: adicione testadores internos (até 100,
   precisam estar em Users and Access) — recebem a build na hora, sem review.
2. Para externos: **External Testing** → crie um grupo (ex.: "Testadores
   OutVitar"), adicione e-mails, e envie a build para **Beta App Review**
   (review leve, costuma ser rápido). Depois os convidados instalam pelo app
   **TestFlight** no iPhone.

---

## Checklist de dados a ter em mãos (preencher)

| Item | Onde pega | Valor |
|------|-----------|-------|
| Team ID | developer.apple.com (topo direito) | ____________ |
| Bundle ID | definido | `app.outlife.mobile` |
| App Store Apple ID | App Store Connect → App Information | ____________ |
| APNs Key ID + `.p8` | Apple Developer → Keys | ____________ |
| ASC API Issuer ID | App Store Connect → Integrations | `e45d1c39-db3e-44f3-bb46-a453ba96b929` |
| ASC API Key ID + `.p8` | App Store Connect → Integrations | Key ID `RV5FCS265S` (nome "Codemagic", App Manager) + arquivo `.p8` baixado |

---

## Observações importantes

- **Paywall/Pix:** na beta NÃO há paywall (acesso só por cadastro) — ok para a
  App Store. ⚠️ Para o LANÇAMENTO, cobrar via Pix por conteúdo digital **viola**
  a política da Apple (exige In-App Purchase). Rever antes da versão de produção.
- **Privacidade:** a App Store exige uma **Política de Privacidade** (URL
  pública) e o preenchimento do **"App Privacy"** (quais dados o app coleta:
  localização, e-mail, etc.). O OutVitar coleta localização (rastreamento) e
  dados de conta — declare isso. A URL da política pode apontar para o conteúdo
  de `src/lib/legal-content.ts` publicado na web (Vercel).
- **Permissões iOS:** o rastreamento exige textos de uso no `Info.plist`
  (`NSLocationWhenInUseUsageDescription`,
  `NSLocationAlwaysAndWhenInUseUsageDescription`, câmera/fotos se usar upload).
  Peça ao Kiro para adicionar/revisar esses textos no projeto iOS antes do
  primeiro envio — a Apple rejeita se faltar.
- **Ícone/splash:** já gerados para Android. Para iOS, rodar
  `npx capacitor-assets generate --ios` (precisa do `assets/logo-outvitar.png`
  adequado). O Kiro cuida disso quando a pasta `ios/` existir.

---

## O que o Kiro ainda pode fazer no código (peça quando quiser)

- [ ] Adicionar os textos de permissão de localização/câmera no `Info.plist`.
- [ ] Gerar ícone/splash iOS (`capacitor-assets generate --ios`).
- [ ] Ajustar o `codemagic.yaml` para injetar o `GoogleService-Info.plist` via
      variável de ambiente (caminho seguro).
- [ ] Adicionar disparo automático de build por push na `main` (hoje é manual).
