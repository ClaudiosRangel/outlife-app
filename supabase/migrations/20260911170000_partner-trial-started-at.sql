-- ============================================================================
-- Frente A (spec evolucao-admin-atividades-social) — Trial de parceiro por data
-- ============================================================================
-- O trial do parceiro passa a durar 1 ANO a partir de uma data de início.
-- Coluna nova nullable: quando ausente, a aplicação usa profiles.created_at do
-- parceiro como fallback (nenhum parceiro existente fica sem trial).
-- Idempotente.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
