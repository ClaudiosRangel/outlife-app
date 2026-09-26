-- 20260926180000_destinations-rich-route.sql
-- Destinos ricos (Bloco 3): adiciona a ROTA real (route_geojson + route_geog) e
-- campos descritivos ao destino (perfil de elevação, pago/valor, horários,
-- pet-friendly, categoria, ponto inicial). Todos NULLABLE (retrocompat com
-- destinos existentes). Estende o trigger de geog para popular route_geog.
-- Idempotente: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE.

ALTER TABLE public.destinations
  ADD COLUMN IF NOT EXISTS route_geojson jsonb,
  ADD COLUMN IF NOT EXISTS route_geog geography(LineString, 4326),
  ADD COLUMN IF NOT EXISTS elevation_profile jsonb,      -- [{d,e}] ou null
  ADD COLUMN IF NOT EXISTS distance_km numeric,
  ADD COLUMN IF NOT EXISTS category text,                -- cachoeira/pico/parque/...
  ADD COLUMN IF NOT EXISTS is_paid boolean,
  ADD COLUMN IF NOT EXISTS price_text text,
  ADD COLUMN IF NOT EXISTS opening_hours text,
  ADD COLUMN IF NOT EXISTS pet_friendly boolean,
  ADD COLUMN IF NOT EXISTS start_lat numeric(10,7),
  ADD COLUMN IF NOT EXISTS start_lng numeric(10,7);

CREATE INDEX IF NOT EXISTS destinations_route_geog_idx
  ON public.destinations USING GIST (route_geog);

-- Estende o trigger existente: além do ponto (geog), popula route_geog a partir
-- de route_geojson quando presente (para consultas espaciais de amigos/rota).
CREATE OR REPLACE FUNCTION public.sync_destination_geog()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geog := ST_SetSRID(ST_MakePoint(NEW.longitude::float8, NEW.latitude::float8), 4326)::geography;
  END IF;
  IF NEW.route_geojson IS NOT NULL THEN
    BEGIN
      NEW.route_geog := ST_GeogFromText(
        ST_AsText(ST_GeomFromGeoJSON(NEW.route_geojson::text))
      );
    EXCEPTION WHEN OTHERS THEN
      NEW.route_geog := NULL;  -- geojson inválido não bloqueia o insert
    END;
  END IF;
  RETURN NEW;
END;
$$;
