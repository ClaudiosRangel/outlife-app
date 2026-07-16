-- Garante que os buckets de storage `review-photos` e `partner-gallery` existam,
-- independente da ordem/estado de execução das migrations anteriores ou do
-- Seed_Script. Idempotente: seguro rodar em qualquer instância Supabase,
-- nova ou já provisionada.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('review-photos', 'review-photos', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('partner-gallery', 'partner-gallery', true)
ON CONFLICT (id) DO NOTHING;
