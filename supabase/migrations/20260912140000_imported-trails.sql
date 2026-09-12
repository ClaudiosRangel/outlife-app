-- ============================================================================
-- Frente H (spec evolucao-admin-atividades-social) — Importação e curadoria de
-- trilhas/destinos externos (OSM/ICMBio). Tabela imported_trails + RLS.
-- Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.imported_trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_source TEXT NOT NULL CHECK (external_source IN ('osm', 'icmbio')),
  external_id TEXT NOT NULL,          -- id na origem (osm relation/way id; cnuc)
  name TEXT NOT NULL,
  description TEXT,
  region TEXT,                        -- rótulo da Import_Region
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  geojson JSONB,                      -- trajeto/polígono quando disponível
  license TEXT,                       -- 'ODbL' para osm
  attribution TEXT,                   -- '© OpenStreetMap contributors' para osm
  visible BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (external_source, external_id)
);
CREATE INDEX IF NOT EXISTS imported_trails_visible_idx
  ON public.imported_trails(visible);

ALTER TABLE public.imported_trails ENABLE ROW LEVEL SECURITY;

-- Usuário vê só as visíveis; admin vê tudo.
DROP POLICY IF EXISTS "read visible or admin" ON public.imported_trails;
CREATE POLICY "read visible or admin" ON public.imported_trails FOR SELECT
  USING (visible = true OR public.is_admin(auth.uid()));

-- Escrita (import/curadoria) apenas por admin.
DROP POLICY IF EXISTS "admin write imported_trails" ON public.imported_trails;
CREATE POLICY "admin write imported_trails" ON public.imported_trails FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
