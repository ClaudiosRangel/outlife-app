-- Tighten storage access: stop allowing anyone to list every file in the
-- review-photos bucket. The bucket is public, so direct public URLs continue
-- to work via the CDN without needing a SELECT policy on storage.objects.
DROP POLICY IF EXISTS "Review photos are publicly readable" ON storage.objects;