# Publicação nas Lojas — OutVitar (Android + iOS)

> Documento de referência para a publicação do app nas lojas. Guarda as
> credenciais/identificadores de conta e o checklist de submissão. **Não
> commitar segredos** (senhas, chaves .p8, certificados .p12) aqui — só
> identificadores públicos/semipúblicos. Segredos ficam em cofre (Bitwarden/
> 1Password) e nas variáveis do Codemagic.

**Última atualização:** 15/09/2026

---

## 1. Apple Developer Program (iOS / App Store)

Conta paga adquirida (US$ 99/ano, individual). Dados de inscrição:

| Campo | Valor |
|-------|-------|
| Tipo de associação | Apple Developer Program |
| ID de inscrição (Enrollment ID) | `J3CXAHA4Y4` |
| Nome do membro | Rafael Vieira |
| E-mail da conta | `outvitar@gmail.com` |
| Telefone de contato | +55 32 9917-9796 |
| Custo | US$ 99 |
| Duração | 1 ano (renovação anual) |
| Status | Inscrição concluída/em processamento (compra confirmada 15/09/2026) |

> ⚠️ O `appId` técnico atual do app ainda é `app.outlife.mobile`. A migração
> de identidade técnica para OutVitar está planejada no bloco de rebranding
> (não fazer antes — ver roadmap). Ao criar o App ID no portal Apple, decidir
> se mantém `app.outlife.mobile` ou já cria `app.outvitar.mobile` (a segunda
> exige alinhar Capacitor `appId`, bundle e provisioning — decisão de produto).

### Build iOS (sem Mac) — Codemagic

O usuário não tem Mac. O build iOS será feito via **Codemagic** (CI com
runners macOS). Pré-requisitos a configurar quando formos gerar o IPA:

- [ ] Gerar a pasta `ios/` via `npx cap add ios` (ainda não existe no repo).
- [ ] App ID + Bundle Identifier no Apple Developer portal.
- [ ] Certificado de distribuição + Provisioning Profile (Codemagic gerencia
      via App Store Connect API Key — recomendado usar automatic signing).
- [ ] App Store Connect API Key (.p8) → guardar como env no Codemagic.
- [ ] `codemagic.yaml` na raiz com workflow iOS (build + assinatura +
      publicação no TestFlight/App Store).
- [ ] Ficha na App Store Connect (nome, descrição, screenshots, ícone 1024,
      política de privacidade — URL obrigatória, ver bloco Termos de Uso).

## Env vars adicionais

| Variável | Onde | Observação |
|----------|------|-----------|
| `VITE_MAPBOX_TOKEN` | `.env` local + Vercel/CI | Token público Mapbox (`pk.`) usado no mapa do Explorar. Fica visível no bundle (normal para token público). **Restringir por URL no dashboard Mapbox antes de publicar.** Sem o token, o app cai no mapa gratuito (Leaflet/OSM). |

## 2. Google Play (Android)

- appId atual: `app.outlife.mobile`
- Build local via Gradle (`android/`), APK debug já gerado. Para produção:
  gerar **AAB** assinado (`bundleRelease`) com keystore de upload.
- [ ] Criar/definir keystore de release (guardar em cofre + Codemagic/CI).
- [ ] Conta Google Play Console (taxa única US$ 25).
- [ ] Ficha da Play Store (descrição, screenshots, ícone, classificação
      indicativa, política de privacidade — URL obrigatória).
- [ ] Data Safety form (Google) — declarar coleta de localização, etc.

## 3. Requisitos legais comuns às duas lojas (ver bloco Termos de Uso)

Ambas as lojas EXIGEM, para apps que coletam dados (localização, conta):

- [x] **Política de Privacidade** — implementada, rota pública `/privacidade`
      (spec `conta-privacidade-termos`, 15/09/2026). Falta hospedar a URL
      pública definitiva para a ficha das lojas (a rota existe no app web).
- [x] **Termos de Uso** com aceite obrigatório no primeiro acesso — rota
      pública `/termos` + gate `<LegalGate>` bloqueante + registro em
      `legal_acceptances`.
- [x] Mecanismo de **exclusão de conta** dentro do app — Configurações → Zona
      de perigo → "Excluir minha conta" (RPC `delete_my_account`).
- [ ] Preencher [RAZÃO SOCIAL]/[CNPJ]/[ENDEREÇO] em `src/lib/legal-content.ts`
      quando houver empresa constituída (hoje placeholders; contato usa
      outvitar@gmail.com, idade mínima 13).
- [ ] Enviar a minuta legal para validação de um advogado antes de publicar.
- [ ] Declaração de uso de localização em background (Android + iOS têm
      telas de permissão específicas; iOS exige justificativa no Info.plist).
