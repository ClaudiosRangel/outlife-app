# OutLife — Planejamento para Produção

## Situação Atual do Banco de Dados

O projeto hoje usa **Supabase** (PostgreSQL gerenciado + Auth + Storage + RLS + Realtime).

- **Projeto Supabase**: `soghvqpnyekmkdqprpka`
- **URL**: `https://soghvqpnyekmkdqprpka.supabase.co`
- **Extensões**: PostGIS (geolocalização), pgcrypto
- **Features usadas**: Auth (email/password), RLS (Row Level Security), Storage (buckets para fotos), RPCs (funções server-side), Triggers

---

## Supabase vs Neon — Análise para o OutLife

### O que o Supabase oferece que o projeto usa ATIVAMENTE:

| Feature | Usado no OutLife | Neon oferece? |
|---------|-----------------|---------------|
| PostgreSQL | ✅ | ✅ |
| PostGIS | ✅ (geolocalização de destinos/parceiros) | ✅ |
| Auth integrado | ✅ (login, signup, sessões, RLS) | ❌ (precisaria implementar) |
| Storage (S3-like) | ✅ (fotos de reviews, galeria parceiros) | ❌ (precisaria S3/Cloudflare R2) |
| Row Level Security | ✅ (toda a segurança do app) | ✅ (é Postgres nativo) |
| Realtime subscriptions | 🔲 (não usa ainda, mas pode no futuro) | ❌ |
| Edge Functions | 🔲 (stubs prontos para Google Places) | ❌ |
| RPCs (SECURITY DEFINER) | ✅ (finish_activity, increment_metrics) | ✅ |

### Minha recomendação: **Manter o Supabase**

**Por quê:**

1. **Auth já está pronto** — Migrar para Neon significaria reescrever toda a autenticação (criar backend, JWT, refresh tokens, etc). Com Supabase, é 0 código de backend.

2. **Storage incluso** — Upload de fotos funciona out-of-the-box com policies. Com Neon, precisaria de um serviço separado (S3, R2, etc).

3. **O frontend fala direto com o banco** — O modelo do OutLife é "client → Supabase" sem backend intermediário. Isso é possível porque o Supabase expõe uma API REST com RLS. Com Neon, precisaria de um backend completo (como o Fastify que vocês usam no WMS).

4. **Para 1 milhão de usuários gradualmente** — Supabase Pro ($25/mês) suporta facilmente até ~100k usuários ativos. Para escalar além, tem planos Team/Enterprise. A arquitetura serverless (sem backend) escala naturalmente.

5. **Neon é melhor quando já se tem um backend** — No WMS vocês têm Fastify + Prisma que gerencia as queries. No OutLife não tem backend, o Supabase É o backend.

### Quando considerar migrar para Neon:

- Se no futuro criar um backend próprio (Fastify/Next.js API routes) para lógica complexa
- Se o custo do Supabase ficar muito alto para o volume de storage
- Se precisar de read replicas em regiões específicas do Brasil

---

## Plano de Deploy — Vercel + Supabase

### Arquitetura Final

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Usuário   │────▶│   Vercel (SSR)   │────▶│    Supabase     │
│  (Browser)  │     │  Next.js/TanStack │     │  PostgreSQL +   │
│             │◀────│  + Edge Functions │◀────│  Auth + Storage │
└─────────────┘     └──────────────────┘     └─────────────────┘
```

### Por que Vercel + Supabase:

- **Vercel**: CDN global, SSR automático, zero config, integração nativa com Supabase
- **Supabase**: Backend completo (DB + Auth + Storage) sem código server
- **Escala para 1M**: Ambos são serverless, escalam automaticamente
- **Custo inicial**: ~$20-45/mês (Vercel Pro $20 + Supabase Pro $25)

---

## Plano de Execução — 5 Fases

### FASE 1 — Fundação (Semana 1)
**Objetivo**: App rodando no Vercel sem dependência do Lovable

- [ ] Remover `@lovable.dev/vite-tanstack-config` e substituir por config Vite manual
- [ ] Remover `@cloudflare/vite-plugin` e `wrangler.jsonc`
- [ ] Configurar projeto para deploy na Vercel (adapter Next.js ou Vite SSR)
- [ ] Criar repositório GitHub e conectar ao Vercel
- [ ] Configurar env vars no Vercel (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
- [ ] Primeiro deploy funcional

### FASE 2 — Banco e Dados (Semana 1-2)
**Objetivo**: Banco populado e funcional

- [ ] Verificar que todas as migrations foram aplicadas no Supabase
- [ ] Criar script de seed (destinos reais brasileiros, parceiros demo)
- [ ] Verificar buckets de storage (review-photos, partner-gallery)
- [ ] Testar fluxo: cadastro → login → explorar → avaliar
- [ ] Upgrade para Supabase Pro (se free tier)

### FASE 3 — Features Reais (Semana 2-3)
**Objetivo**: Substituir mocks por dados reais

- [ ] Implementar `fetchUserTrails` buscando de `user_activities` reais
- [ ] Implementar achievements/badges no banco (nova tabela)
- [ ] Implementar `fetchNextAdventure` (agenda do usuário)
- [ ] Conectar Google Places API (Edge Function no Supabase)
- [ ] Implementar tiles de mapa (Leaflet + OpenStreetMap = gratuito, já funciona)

### FASE 4 — Produção e Qualidade (Semana 3-4)
**Objetivo**: App pronto para usuários reais

- [ ] PWA manifest (installable no celular)
- [ ] SEO: sitemap, meta tags dinâmicas
- [ ] Monitoramento: Sentry para erros
- [ ] Analytics: PostHog ou Vercel Analytics
- [ ] Testes E2E nos fluxos principais
- [ ] Otimização de imagens (next/image ou sharp)
- [ ] Rate limiting nas RPCs do Supabase

### FASE 5 — Escala (Mês 2+)
**Objetivo**: Preparar para crescimento

- [ ] CDN para imagens (Cloudflare R2 ou Supabase CDN)
- [ ] Read replicas se necessário (Supabase oferece)
- [ ] Push notifications (OneSignal ou FCM)
- [ ] Gateway de pagamento para parceiros (Stripe ou Pix via Mercado Pago)
- [ ] App mobile nativo (React Native/Expo) reaproveitando a lógica
- [ ] Cache agressivo com React Query (staleTime, gcTime)

---

## Estimativa de Custos Mensais

### Início (0-10k usuários)
| Serviço | Plano | Custo |
|---------|-------|-------|
| Vercel | Pro | $20/mês |
| Supabase | Pro | $25/mês |
| Domínio | .com.br | ~R$40/ano |
| **Total** | | **~$45/mês (~R$250)** |

### Crescimento (10k-100k usuários)
| Serviço | Plano | Custo |
|---------|-------|-------|
| Vercel | Pro | $20/mês + usage |
| Supabase | Pro + add-ons | $25-75/mês |
| CDN (imagens) | Cloudflare R2 | ~$5-15/mês |
| **Total** | | **~$60-110/mês** |

### Escala (100k-1M usuários)
| Serviço | Plano | Custo |
|---------|-------|-------|
| Vercel | Enterprise ou Team | $150-400/mês |
| Supabase | Team | $599/mês |
| CDN + Storage | R2 | $20-50/mês |
| Monitoring | Sentry + Analytics | $30-50/mês |
| **Total** | | **~$800-1100/mês** |

---

## Decisão Final

| Aspecto | Decisão | Motivo |
|---------|---------|--------|
| **Hosting** | Vercel | SSR, CDN global, fácil deploy |
| **Banco** | Supabase (manter) | Auth+Storage+RLS integrados, zero backend |
| **Migrar para Neon?** | Não agora | Perderia Auth/Storage/RLS client-side |
| **Framework** | Manter React + TanStack Router | Código já pronto, só remover Lovable wrapper |
| **Escala** | Serverless nativo | Supabase + Vercel escalam sob demanda |

---

## Próximo Passo Imediato

Começar pela **Fase 1**: remover a dependência do Lovable e fazer o primeiro deploy na Vercel.
