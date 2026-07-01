# OutLife — A vida não é só trilhar

Marketplace outdoor colaborativo que conecta aventureiros, guias, pousadas e empresas do ecossistema de turismo de aventura.

## Stack

- **Frontend**: React 19 + TanStack Router + TanStack Start (SSR)
- **Build**: Vite 7
- **UI**: Tailwind CSS 4 + Radix UI (Shadcn) + Lucide
- **Backend**: Supabase (PostgreSQL + PostGIS + Auth + Storage + RLS)
- **Cache**: TanStack React Query
- **Mapas**: Leaflet + OpenStreetMap
- **i18n**: i18next (pt-BR / en)
- **Deploy**: Vercel

## Desenvolvimento Local

```bash
# Instalar dependências
npm install --legacy-peer-deps

# Rodar dev server (porta 3000)
npm run dev

# Build de produção
npm run build

# Preview do build
npm run preview
```

## Variáveis de Ambiente

Copie `.env.example` para `.env` e preencha:

```
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_PUBLISHABLE_KEY=sua-anon-key
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-anon-key
```

## Deploy na Vercel

1. Conecte o repositório GitHub ao Vercel
2. Configure as env vars no dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
3. Build command: `npm run build`
4. Output directory: `dist`
5. Install command: `npm install --legacy-peer-deps`

## Banco de Dados (Supabase)

As migrations estão em `supabase/migrations/`. Para aplicar no banco:

1. Acesse o SQL Editor do Supabase
2. Execute os scripts na ordem cronológica

### Tabelas principais

- `profiles` — Perfis de usuários (aventureiros + parceiros)
- `destinations` — Destinos turísticos (trilhas, cachoeiras, etc)
- `services` — Serviços oferecidos por parceiros
- `reviews` — Avaliações com sistema de XP
- `user_activities` — Rastreamento GPS de atividades
- `user_checklists` — Checklists de viagem
- `user_friends` — Sistema de amizades
- `community_posts` — Feed da comunidade
