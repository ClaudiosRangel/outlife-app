-- Bucket `community-post-images` para fotos anexadas a Community_Post.
--
-- Contexto: o formulário de "Novo relato" em src/routes/comunidade.tsx
-- sempre gerava só uma preview local (base64) da foto escolhida e nunca
-- fazia upload real, então `createCommunityPost` era chamado sem
-- `image_url` e todo post caía no fallback (imagem padrão de trilha).
--
-- Público (fotos de posts já aparecem publicamente na comunidade), com
-- policies de upload/update/delete restritas à própria pasta do usuário,
-- seguindo o mesmo padrão de `avatars`/`partner-gallery`.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('community-post-images', 'community-post-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Community post images are public readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'community-post-images');

CREATE POLICY "Owners can upload to their community post images folder"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'community-post-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can update their community post images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'community-post-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can delete their community post images"
ON storage.objects FOR DELETE
USING (bucket_id = 'community-post-images' AND auth.uid()::text = (storage.foldername(name))[1]);
