-- Estende o CHECK constraint de status em public.user_friends para incluir 'following'.
--
-- Cenário encontrado (confirmado lendo 20260525181443_68fbc422-...sql, a migration que
-- criou a tabela): a coluna `status` é TEXT com um CHECK constraint inline
-- (`CHECK (status IN ('pending','accepted','blocked'))`), NÃO um tipo ENUM do Postgres.
-- Como o constraint não foi nomeado explicitamente na criação, o Postgres atribuiu o
-- nome padrão `user_friends_status_check` (padrão `<tabela>_<coluna>_check`).
--
-- Portanto usamos DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT com a lista de valores
-- existentes ('pending', 'accepted', 'blocked') mais o novo valor ('following'), em vez
-- de ALTER TYPE ... ADD VALUE (que só se aplicaria a um tipo ENUM).
--
-- Uma linha com status = 'following' representa o Post_Follow (Requirement 7):
-- relação assimétrica requester_id -> addressee_id ("segue"), reaproveitando a mesma
-- tabela de Friendship sem exigir aceite e sem afetar `are_friends`/compartilhamento de
-- localização, que continuam filtrando estritamente por status = 'accepted'.
-- Requirements: 7.1

ALTER TABLE public.user_friends
  DROP CONSTRAINT IF EXISTS user_friends_status_check;

ALTER TABLE public.user_friends
  ADD CONSTRAINT user_friends_status_check
  CHECK (status IN ('pending', 'accepted', 'blocked', 'following'));
