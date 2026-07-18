-- Adiciona categoria a Community_Post (Requirement solicitado pelo
-- usuário: combobox de tipo de publicação — Trilha/Camping/Relato/Outro —
-- e as abas de filtro da tela de Comunidade devem respeitar esse tipo real
-- em vez da correspondência por palavra-chave usada anteriormente).
--
-- Mesmo padrão já usado em `user_friends.status` (migration
-- 20260716090100): TEXT + CHECK constraint em vez de ENUM do Postgres,
-- para poder estender a lista de valores no futuro com um simples
-- DROP/ADD CONSTRAINT, sem exigir ALTER TYPE.
--
-- DEFAULT 'outro' garante que publicações já existentes (sem categoria
-- informada) e qualquer inserção futura sem o campo continuem válidas.

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'outro';

ALTER TABLE public.community_posts
  DROP CONSTRAINT IF EXISTS community_posts_category_check;

ALTER TABLE public.community_posts
  ADD CONSTRAINT community_posts_category_check
  CHECK (category IN ('trilha', 'camping', 'relato', 'outro'));

CREATE INDEX IF NOT EXISTS idx_community_posts_category ON public.community_posts(category);
