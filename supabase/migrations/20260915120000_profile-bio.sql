-- Frase/bio de perfil (spec perfil-bio). Campo pessoal curto, distinto de
-- `description` (que é a descrição comercial do parceiro). Idempotente.

alter table public.profiles
  add column if not exists bio text;
