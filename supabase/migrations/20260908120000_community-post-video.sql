-- Suporte a vídeo em Community_Post (spec video-atividade-comunidade, item 6).
--
-- Adiciona a coluna opcional `video_url` em `community_posts` e cria o bucket
-- dedicado `community-post-videos`, espelhando as políticas de
-- `community-post-images`. Idempotente: pode rodar mais de uma vez sem erro.
--
-- Estratégia (lição do Bloco B): NÃO transcodificar no cliente; validar e
-- recusar. Limites consistentes com o cliente: 30 MB, tipos mp4/webm/mov.
-- (A duração — 60 s — é validada só no cliente, o Storage não inspeciona vídeo.)

-- 1) Coluna opcional na tabela de posts (não quebra posts existentes).
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS video_url text;

-- 2) Bucket dedicado de vídeos (público para leitura; limite de 30 MB e MIME).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'community-post-videos',
  'community-post-videos',
  true,
  31457280, -- 30 MB (30 * 1024 * 1024), igual a MAX_VIDEO_BYTES no cliente
  ARRAY['video/mp4','video/webm','video/quicktime']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3) Políticas RLS no storage.objects — espelham community-post-images.
--    Postgres não tem CREATE POLICY IF NOT EXISTS; usamos DROP IF EXISTS antes.

DROP POLICY IF EXISTS "Community post videos are public readable" ON storage.objects;
CREATE POLICY "Community post videos are public readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'community-post-videos');

DROP POLICY IF EXISTS "Owners can upload to their community post videos folder" ON storage.objects;
CREATE POLICY "Owners can upload to their community post videos folder"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'community-post-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Owners can update their community post videos" ON storage.objects;
CREATE POLICY "Owners can update their community post videos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'community-post-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Owners can delete their community post videos" ON storage.objects;
CREATE POLICY "Owners can delete their community post videos"
ON storage.objects FOR DELETE
USING (bucket_id = 'community-post-videos' AND auth.uid()::text = (storage.foldername(name))[1]);
