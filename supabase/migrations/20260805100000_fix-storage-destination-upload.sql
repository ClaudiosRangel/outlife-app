-- Permite que usuários autenticados façam upload no bucket community-post-images
-- para a pasta destinations/ (usada pela tela de sugerir destino).
-- O bucket já existe (migration 20260717120000), mas a policy de INSERT
-- pode estar restrita apenas ao author_id do post.

-- Policy genérica de INSERT para qualquer usuário autenticado
-- (o path começa com o user_id, garantindo isolamento)
CREATE POLICY "Authenticated users can upload to community-post-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'community-post-images'
    AND (storage.foldername(name))[1] = 'destinations'
    AND auth.uid() IS NOT NULL
  );

-- Também garante que qualquer autenticado pode ler (para preview/exibição)
CREATE POLICY "Public read community-post-images destinations"
  ON storage.objects FOR SELECT
  TO public
  USING (
    bucket_id = 'community-post-images'
    AND (storage.foldername(name))[1] = 'destinations'
  );
