-- Módulo de Eventos OutLife
-- Permite criar eventos vinculados a destinos, com confirmação de presença
-- e sistema de perguntas/respostas (público ou privado).

-- ============ EVENTS ============
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  destination_id UUID REFERENCES public.destinations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'trilha',
  event_date TIMESTAMPTZ NOT NULL,
  event_end_date TIMESTAMPTZ,
  max_participants INTEGER,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_date_idx ON public.events (event_date DESC);
CREATE INDEX IF NOT EXISTS events_created_by_idx ON public.events (created_by);
CREATE INDEX IF NOT EXISTS events_destination_idx ON public.events (destination_id);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active events"
  ON public.events FOR SELECT
  USING (status = 'active' OR auth.uid() = created_by);

CREATE POLICY "Authenticated users can create events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update their events"
  ON public.events FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can delete their events"
  ON public.events FOR DELETE
  USING (auth.uid() = created_by);

-- ============ EVENT PARTICIPANTS ============
CREATE TABLE IF NOT EXISTS public.event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'maybe', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_participants_event_idx ON public.event_participants (event_id);
CREATE INDEX IF NOT EXISTS event_participants_user_idx ON public.event_participants (user_id);

ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view event participants"
  ON public.event_participants FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can join events"
  ON public.event_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their participation"
  ON public.event_participants FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their participation"
  ON public.event_participants FOR DELETE
  USING (auth.uid() = user_id);

-- ============ EVENT QUESTIONS ============
CREATE TABLE IF NOT EXISTS public.event_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT false,
  answer TEXT,
  answered_by UUID REFERENCES public.profiles(id),
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_questions_event_idx ON public.event_questions (event_id, created_at DESC);

ALTER TABLE public.event_questions ENABLE ROW LEVEL SECURITY;

-- Perguntas públicas visíveis por todos; privadas só pelo autor e criador do evento
CREATE POLICY "View event questions"
  ON public.event_questions FOR SELECT
  USING (
    is_private = false
    OR auth.uid() = author_id
    OR auth.uid() = (SELECT created_by FROM public.events WHERE id = event_id)
  );

CREATE POLICY "Authenticated users can ask questions"
  ON public.event_questions FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- Criador do evento pode responder (update answer)
CREATE POLICY "Event creator can answer questions"
  ON public.event_questions FOR UPDATE
  USING (auth.uid() = (SELECT created_by FROM public.events WHERE id = event_id))
  WITH CHECK (auth.uid() = (SELECT created_by FROM public.events WHERE id = event_id));

-- ============ ADMIN EMAILS para aprovação de destinos ============
-- Lista de e-mails que recebem notificação quando um destino é sugerido
CREATE TABLE IF NOT EXISTS public.admin_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'approver',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: qualquer usuário autenticado pode verificar se está na lista
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read admin_emails" ON public.admin_emails;
CREATE POLICY "Authenticated users can read admin_emails"
  ON public.admin_emails
  FOR SELECT
  TO authenticated
  USING (true);

-- Inserir os 3 responsáveis
INSERT INTO public.admin_emails (email, role) VALUES
  ('claudiosilvarangel1974@gmail.com', 'approver'),
  ('caioestevesrangel14@gmail.com', 'approver'),
  ('rafaelcv.166096@uniacademia.edu.br', 'approver')
ON CONFLICT (email) DO NOTHING;
