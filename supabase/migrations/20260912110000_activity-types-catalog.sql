-- ============================================================================
-- Frente D (spec evolucao-admin-atividades-social) — Catálogo de tipos de
-- atividade. Idempotente.
-- ============================================================================

-- 1) Tabela do catálogo. RLS: leitura pública (o rastreamento lista os ativos);
--    escrita só admin.
CREATE TABLE IF NOT EXISTS public.activity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon_key TEXT NOT NULL,
  metric_form TEXT NOT NULL CHECK (metric_form IN ('pace_km','speed_elevation','pace_100m')),
  active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read activity_types" ON public.activity_types;
CREATE POLICY "read activity_types" ON public.activity_types FOR SELECT USING (true);
DROP POLICY IF EXISTS "admin write activity_types" ON public.activity_types;
CREATE POLICY "admin write activity_types" ON public.activity_types FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 2) Relaxa o CHECK fixo de user_activities.activity_type (permanece TEXT).
--    Novos codes do catálogo passam a ser aceitos sem migration por tipo.
--    Atividades antigas (caminhada/pedalada/trilha/outro) continuam válidas.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_activities_activity_type_check'
      AND conrelid = 'public.user_activities'::regclass
  ) THEN
    ALTER TABLE public.user_activities DROP CONSTRAINT user_activities_activity_type_check;
  END IF;
END $$;

-- 3) Seed idempotente dos tipos padrão (mantém os 4 codes atuais + novos).
INSERT INTO public.activity_types (code, name, icon_key, metric_form, position) VALUES
  ('corrida',   'Corrida',   'run',      'pace_km',         1),
  ('caminhada', 'Caminhada', 'walk',     'pace_km',         2),
  ('trilha',    'Trilha',    'trail',    'speed_elevation', 3),
  ('pedalada',  'Pedalada',  'bike',     'speed_elevation', 4),
  ('natacao',   'Natação',   'swim',     'pace_100m',       5),
  ('remo',      'Remo',      'row',      'speed_elevation', 6),
  ('escalada',  'Escalada',  'climb',    'speed_elevation', 7),
  ('outro',     'Outro',     'activity', 'speed_elevation', 8)
ON CONFLICT (code) DO NOTHING;
