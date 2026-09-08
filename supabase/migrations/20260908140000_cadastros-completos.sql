-- Cadastros completos (spec parceiros-cadastros-completos, item 13).
--
-- Adiciona tipo de pessoa (PF/PJ) e endereço estruturado em `profiles`, e o
-- documento PF (`cpf`) + 2º telefone em `profile_contacts` (owner-only).
-- Idempotente (ADD COLUMN IF NOT EXISTS). NUNCA editar migrations aplicadas —
-- arquivo novo, posterior a 20260908130000_gamificacao-niveis-rank.sql.

-- ============ profiles: tipo de pessoa + endereço estruturado ============
-- Endereço não é dado sensível de contato (a coluna `location`, texto livre,
-- já é pública); então pode residir em profiles. Tudo nullable → perfis
-- existentes intactos. `person_type` com CHECK que aceita NULL.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS person_type TEXT,
  ADD COLUMN IF NOT EXISTS address_zip TEXT,
  ADD COLUMN IF NOT EXISTS address_street TEXT,
  ADD COLUMN IF NOT EXISTS address_number TEXT,
  ADD COLUMN IF NOT EXISTS address_complement TEXT,
  ADD COLUMN IF NOT EXISTS address_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS address_city TEXT,
  ADD COLUMN IF NOT EXISTS address_state TEXT;

-- CHECK de person_type (só pf/pj ou NULL). Idempotente via DROP + ADD.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_person_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_person_type_check
  CHECK (person_type IS NULL OR person_type IN ('pf', 'pj'));

-- ============ profile_contacts: documento PF + 2º telefone (owner-only) ====
-- profile_contacts já tem RLS owner-only (só o dono lê/escreve). Documento e
-- telefone são dados sensíveis de contato — nunca em coluna pública.
ALTER TABLE public.profile_contacts
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS phone_secondary TEXT;
