
CREATE TABLE public.user_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  destination_id uuid REFERENCES public.destinations(id) ON DELETE SET NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_checklists_user_updated ON public.user_checklists (user_id, updated_at DESC);

ALTER TABLE public.user_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own checklists"
  ON public.user_checklists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own checklists"
  ON public.user_checklists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own checklists"
  ON public.user_checklists FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own checklists"
  ON public.user_checklists FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_checklists_updated_at
  BEFORE UPDATE ON public.user_checklists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
