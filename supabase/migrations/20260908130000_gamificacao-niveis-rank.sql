-- Gamificação: níveis e rankings (spec gamificacao-niveis-rank, itens 10 e 12).
--
-- Idempotente: CREATE OR REPLACE VIEW/FUNCTION. NUNCA editar migrations já
-- aplicadas — arquivo novo, posterior a 20260908120500_finish-activity-video.sql.
--
-- Só considera atividades reais concluídas (status='completed'), coerente com
-- a integridade estilo Strava (Bloco A).

-- ============ VIEW: estatísticas de nível por usuário e por tipo ============
-- Uma linha por (user_id, activity_type). O cliente soma para o total geral e
-- usa cada linha para o nível por tipo (Req 1, 2). COALESCE trata nulos (Req 7.1).
CREATE OR REPLACE VIEW public.user_level_stats AS
SELECT
  ua.user_id,
  ua.activity_type,
  COUNT(*)                                        AS completed_activities,
  COALESCE(SUM(ua.distance_meters), 0) / 1000.0   AS total_km,
  COALESCE(SUM(ua.elevation_gain), 0)             AS total_elevation
FROM public.user_activities ua
WHERE ua.status = 'completed'
GROUP BY ua.user_id, ua.activity_type;

-- A view herda a RLS das tabelas base (user_activities: SELECT só do dono).
-- Como o perfil só calcula o PRÓPRIO nível, isso é suficiente e seguro.

-- ============ RPC: ranking de atividades (SECURITY DEFINER) ============
-- A RLS de user_activities bloqueia leitura entre usuários; o ranking precisa
-- agregar de todos, então usa SECURITY DEFINER e retorna SÓ campos públicos
-- (nome, username, avatar, valor da métrica) — nunca trajeto/dados sensíveis.
--
-- _metric: 'distancia' (SUM distance) | 'altimetria' (SUM elevation) |
--          'tempo' (MIN duration — melhor marca pessoal).
-- _scope:  'global' | 'seguidos' (auth.uid() + quem ele segue).
-- _since:  início do período (NULL = sempre), calculado no cliente.
-- _destination_id: quando informado, restringe ao destino (Req 6).
-- _limit:  Top N (default 50, Req 7.2).
CREATE OR REPLACE FUNCTION public.fetch_activity_ranking(
  _metric TEXT,
  _scope TEXT DEFAULT 'global',
  _since TIMESTAMPTZ DEFAULT NULL,
  _destination_id UUID DEFAULT NULL,
  _limit INTEGER DEFAULT 50
) RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  username TEXT,
  avatar_url TEXT,
  value NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scoped AS (
    SELECT ua.*
    FROM public.user_activities ua
    WHERE ua.status = 'completed'
      AND (_since IS NULL OR ua.start_time >= _since)
      AND (_destination_id IS NULL OR ua.destination_id = _destination_id)
      AND (
        _scope <> 'seguidos'
        OR ua.user_id = auth.uid()
        OR ua.user_id IN (
          SELECT uf.addressee_id
          FROM public.user_friends uf
          WHERE uf.requester_id = auth.uid()
            AND uf.status IN ('following', 'accepted')
        )
      )
  ),
  agg AS (
    SELECT
      s.user_id,
      CASE
        WHEN _metric = 'distancia'  THEN COALESCE(SUM(s.distance_meters), 0)
        WHEN _metric = 'altimetria' THEN COALESCE(SUM(s.elevation_gain), 0)
        WHEN _metric = 'tempo'      THEN COALESCE(MIN(NULLIF(s.duration_seconds, 0)), 0)
        ELSE 0
      END AS value
    FROM scoped s
    GROUP BY s.user_id
  )
  SELECT
    a.user_id,
    p.full_name,
    p.username,
    p.avatar_url,
    a.value
  FROM agg a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE a.value > 0
  ORDER BY
    CASE WHEN _metric = 'tempo' THEN a.value END ASC,
    CASE WHEN _metric <> 'tempo' THEN a.value END DESC,
    a.user_id ASC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 50), 200));
$$;

-- Permite que qualquer usuário autenticado chame a RPC (a função em si já
-- limita a saída a campos públicos).
GRANT EXECUTE ON FUNCTION public.fetch_activity_ranking(TEXT, TEXT, TIMESTAMPTZ, UUID, INTEGER) TO authenticated;
