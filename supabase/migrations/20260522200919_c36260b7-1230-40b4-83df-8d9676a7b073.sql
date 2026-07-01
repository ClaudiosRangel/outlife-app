
INSERT INTO storage.buckets (id, name, public) VALUES ('partner-gallery', 'partner-gallery', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Partner gallery is public readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'partner-gallery');

CREATE POLICY "Owners can upload to their partner gallery folder"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'partner-gallery' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can update their partner gallery files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'partner-gallery' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can delete their partner gallery files"
ON storage.objects FOR DELETE
USING (bucket_id = 'partner-gallery' AND auth.uid()::text = (storage.foldername(name))[1]);
