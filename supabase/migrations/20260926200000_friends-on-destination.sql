-- 20260926200000_friends-on-destination.sql
-- Amigos na trilha (Bloco 3, Fase B): amigos (user_friends accepted/following)
-- do solicitante que concluíram uma atividade cujo trajeto passou perto do
-- destino (raio configurável). SECURITY DEFINER (RLS de user_activities não
-- permite leitura cruzada). Idempotente.

CREATE OR REPLACE FUNCTION public.fetch_friends_on_destination(
  _destination_id uuid,
  _radius_meters double precision DEFAULT 1500,
  _limit integer DEFAULT 30
) RETURNS TABLE (
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  last_activity_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _dgeog geography;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;

  -- Geometria de referência do destino: a rota (route_geog) se houver, senão
  -- o ponto (geog).
  SELECT COALESCE(d.route_geog, d.geog) INTO _dgeog
  FROM public.destinations d
  WHERE d.id = _destination_id AND d.status = 'approved';
  IF _dgeog IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, p.username, p.avatar_url, MAX(ua.start_time) AS last_activity_at
  FROM public.user_activities ua
  JOIN public.profiles p ON p.id = ua.user_id
  WHERE ua.status = 'completed'
    AND ua.route IS NOT NULL
    AND ST_DWithin(ua.route, _dgeog, GREATEST(0, _radius_meters))
    AND ua.user_id IN (
      SELECT uf.addressee_id FROM public.user_friends uf
      WHERE uf.requester_id = _uid AND uf.status IN ('following', 'accepted')
    )
  GROUP BY p.id, p.full_name, p.username, p.avatar_url
  ORDER BY last_activity_at DESC
  LIMIT greatest(1, least(coalesce(_limit, 30), 100));
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_friends_on_destination(uuid, double precision, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.fetch_friends_on_destination(uuid, double precision, integer) TO authenticated;
