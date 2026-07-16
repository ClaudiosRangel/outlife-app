-- saved_destinations: destinos salvos por um usuário
CREATE TABLE public.saved_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  destination_id UUID NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, destination_id)
);

ALTER TABLE public.saved_destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved destinations"
  ON public.saved_destinations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save their own destinations"
  ON public.saved_destinations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave their own destinations"
  ON public.saved_destinations FOR DELETE
  USING (auth.uid() = user_id);

-- favorite_partners: parceiros favoritados por um usuário
CREATE TABLE public.favorite_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, partner_id)
);

ALTER TABLE public.favorite_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own favorite partners"
  ON public.favorite_partners FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can favorite partners"
  ON public.favorite_partners FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unfavorite partners"
  ON public.favorite_partners FOR DELETE
  USING (auth.uid() = user_id);
