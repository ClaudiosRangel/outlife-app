-- ============================================================================
-- Frente F (spec evolucao-admin-atividades-social) — Sugestões de amizade.
-- RPC suggest_friends: amigos-de-amigos + atividade em comum, excluindo o
-- próprio usuário e qualquer um que já tenha relação em user_friends (em
-- qualquer status/direção). Só campos públicos. Idempotente (CREATE OR REPLACE).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.suggest_friends(_limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  full_name text,
  username text,
  avatar_url text,
  reason text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH
  -- IDs com relação existente (qualquer direção/status) — nunca sugerir.
  related AS (
    SELECT addressee_id AS other FROM public.user_friends WHERE requester_id = _uid
    UNION
    SELECT requester_id AS other FROM public.user_friends WHERE addressee_id = _uid
  ),
  -- Meus amigos aceitos (qualquer direção).
  my_friends AS (
    SELECT addressee_id AS friend FROM public.user_friends
      WHERE requester_id = _uid AND status = 'accepted'
    UNION
    SELECT requester_id AS friend FROM public.user_friends
      WHERE addressee_id = _uid AND status = 'accepted'
  ),
  -- 1) Amigos-de-amigos: amigos aceitos dos meus amigos.
  fof AS (
    SELECT DISTINCT
      CASE WHEN uf.requester_id = mf.friend THEN uf.addressee_id ELSE uf.requester_id END AS candidate,
      'friend_of_friend'::text AS reason
    FROM public.user_friends uf
    JOIN my_friends mf
      ON (uf.requester_id = mf.friend OR uf.addressee_id = mf.friend)
    WHERE uf.status = 'accepted'
  ),
  -- Meus tipos de atividade (completed).
  my_types AS (
    SELECT DISTINCT activity_type FROM public.user_activities
      WHERE user_id = _uid AND status = 'completed' AND activity_type IS NOT NULL
  ),
  -- 2) Atividade em comum: outros usuários com um tipo em comum (completed).
  common AS (
    SELECT DISTINCT ua.user_id AS candidate, 'common_activity'::text AS reason
    FROM public.user_activities ua
    JOIN my_types mt ON ua.activity_type = mt.activity_type
    WHERE ua.status = 'completed' AND ua.user_id <> _uid
  ),
  -- União priorizando amigo-de-amigo (reason ordena antes).
  candidates AS (
    SELECT candidate, reason FROM fof
    UNION ALL
    SELECT candidate, reason FROM common
  ),
  -- Dedup: um candidato aparece 1× (mantém o reason de maior prioridade).
  ranked AS (
    SELECT candidate,
           MIN(CASE WHEN reason = 'friend_of_friend' THEN 0 ELSE 1 END) AS pri
    FROM candidates
    GROUP BY candidate
  )
  SELECT p.id,
         p.full_name,
         p.username,
         p.avatar_url,
         CASE WHEN r.pri = 0 THEN 'friend_of_friend' ELSE 'common_activity' END AS reason
  FROM ranked r
  JOIN public.profiles p ON p.id = r.candidate
  WHERE r.candidate <> _uid
    AND r.candidate NOT IN (SELECT other FROM related)
  ORDER BY r.pri ASC, p.full_name ASC NULLS LAST
  LIMIT GREATEST(1, LEAST(_limit, 50));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.suggest_friends(integer) TO authenticated;
