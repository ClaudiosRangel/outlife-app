-- ============ EXTENSIONS ============
-- Mantido por seguranca/idempotencia; ja criada pelo arquivo anterior (20260521193007).
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============ REVIEWS ============
-- Este e o unico incremento real deste arquivo em relacao ao arquivo anterior
-- (20260521193007_88f5fd4b-*.sql). Enums, profiles, destinations, services,
-- community_posts, funcoes (update_updated_at_column, handle_new_user,
-- find_similar_destinations) e os seeds de destinos/parceiros ja foram criados
-- por aquele arquivo com conteudo identico ao que originalmente estava
-- redeclarado aqui (sem IF NOT EXISTS), o que causava falha
-- "relation already exists" ao aplicar os dois arquivos em sequencia contra
-- um banco vazio. Essa redeclaracao foi removida nesta correcao (task 2.3 do
-- spec migracao-supabase-proprio-lovable).
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  destination_id UUID NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating NUMERIC(2,1) NOT NULL,
  comment TEXT
);

CREATE INDEX reviews_destination_idx ON public.reviews (destination_id);
CREATE INDEX reviews_author_idx ON public.reviews (author_id);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews are viewable by everyone"
  ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Users can create reviews"
  ON public.reviews FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can update their own reviews"
  ON public.reviews FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Users can delete their own reviews"
  ON public.reviews FOR DELETE USING (auth.uid() = author_id);
