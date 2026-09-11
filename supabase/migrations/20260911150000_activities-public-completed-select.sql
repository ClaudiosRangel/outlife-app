-- ============================================================================
-- Visibilidade de atividades concluídas (feed da Comunidade + deep link)
-- ============================================================================
-- BUG: user_activities só tinha policy de SELECT "auth.uid() = user_id", então
-- ao abrir a atividade de OUTRO amigo (pela Comunidade ou pelo link /a/:id) a
-- query retornava vazio → tela sem dados. Como as atividades concluídas já são
-- compartilhadas (aparecem no feed e em links públicos), adicionamos uma policy
-- que libera o SELECT de atividades com status='completed' para qualquer um.
-- As atividades em andamento (in_progress) continuam privadas (só o dono vê).
-- Idempotente.
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view completed activities" ON public.user_activities;
CREATE POLICY "Anyone can view completed activities"
  ON public.user_activities FOR SELECT
  USING (status = 'completed');
