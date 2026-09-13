-- ============================================================================
-- Enriquecimento de imported_trails (ponto 2): imagem + informações completas
-- vindas do OSM (tags) e do Wikidata (imagem/descrição). Idempotente.
-- ============================================================================

ALTER TABLE public.imported_trails
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS difficulty TEXT,       -- sac_scale/mtb:scale do OSM
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC,   -- tag distance (km) quando houver
  ADD COLUMN IF NOT EXISTS elevation_m NUMERIC,   -- ele/ascent quando houver
  ADD COLUMN IF NOT EXISTS wikidata_id TEXT,      -- Q-id do Wikidata (fonte da imagem)
  ADD COLUMN IF NOT EXISTS wikipedia TEXT;        -- artigo wikipedia (lang:title)
