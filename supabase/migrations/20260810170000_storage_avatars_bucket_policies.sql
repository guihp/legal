-- Supabase Storage: bucket público de avatars de perfil
-- Path esperado pelo front (UserProfileView): avatars/{user_id}/{timestamp}.{ext}
-- - Leitura pública (anon + authenticated) para exibir avatar_url
-- - Escrita: usuário autenticado só em sua pasta auth.uid()/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'avatars',
      'avatars',
      true,
      2097152, -- 2MB (alinhado ao front)
      ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    );
  ELSE
    UPDATE storage.buckets
    SET
      public = true,
      file_size_limit = COALESCE(file_size_limit, 2097152),
      allowed_mime_types = COALESCE(
        allowed_mime_types,
        ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
      )
    WHERE id = 'avatars';
  END IF;
END $$;

-- Policies (idempotentes)
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;

-- Leitura pública dos avatars
CREATE POLICY "avatars_public_read"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'avatars');

-- Upload apenas na própria pasta {user_id}/...
CREATE POLICY "avatars_owner_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_owner_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_owner_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
