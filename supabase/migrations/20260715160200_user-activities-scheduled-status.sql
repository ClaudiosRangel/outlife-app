-- Estende o CHECK constraint de status em public.user_activities para incluir 'scheduled'.
--
-- Cenário encontrado (confirmado lendo 20260522214044_1d0f0a86-...sql, a migration que
-- criou a tabela): a coluna `status` é TEXT com um CHECK constraint inline
-- (`CHECK (status IN ('in_progress','completed'))`), NÃO um tipo ENUM do Postgres.
-- Como o constraint não foi nomeado explicitamente na criação, o Postgres atribuiu o
-- nome padrão `user_activities_status_check` (padrão `<tabela>_<coluna>_check`).
--
-- Portanto usamos DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT com a lista de valores
-- existentes ('in_progress', 'completed') mais o novo valor ('scheduled'), em vez de
-- ALTER TYPE ... ADD VALUE (que só se aplicaria a um tipo ENUM).
--
-- Suporta a derivação de "próxima aventura" (fetchNextAdventure) a partir de
-- user_activities com status = 'scheduled', sem exigir uma tabela nova.
-- Requirements: 4.4

ALTER TABLE public.user_activities
  DROP CONSTRAINT IF EXISTS user_activities_status_check;

ALTER TABLE public.user_activities
  ADD CONSTRAINT user_activities_status_check
  CHECK (status IN ('in_progress', 'completed', 'scheduled'));
