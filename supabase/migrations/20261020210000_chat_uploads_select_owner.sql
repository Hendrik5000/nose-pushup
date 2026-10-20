-- Restrict chat-uploads SELECT to the object owner folder (user id prefix).
-- Previously any authenticated user could list/read the whole bucket.

DROP POLICY IF EXISTS "chat_uploads_select" ON storage.objects;
CREATE POLICY "chat_uploads_select" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
