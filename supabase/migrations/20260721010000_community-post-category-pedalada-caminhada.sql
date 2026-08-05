-- Estende o CHECK constraint de `community_posts.category` para incluir
-- as novas categorias "pedalada" e "caminhada" (Requirement 8.1 do spec
-- app-hibrido-nativo).
--
-- Segue o mesmo padrão incremental já usado em 20260720090000
-- (community-post-category.sql): apenas DROP/ADD CONSTRAINT, sem alterar
-- a definição da coluna nem o índice já criados naquela migration.

ALTER TABLE public.community_posts
  DROP CONSTRAINT IF EXISTS community_posts_category_check;

ALTER TABLE public.community_posts
  ADD CONSTRAINT community_posts_category_check
  CHECK (category IN ('trilha', 'camping', 'relato', 'outro', 'pedalada', 'caminhada'));
