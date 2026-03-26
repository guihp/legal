-- Supabase Storage: bucket de assets públicos do site vitrine/LP
-- - Leitura pública (anon) para exibir logo/capas no site público
-- - Escrita restrita: usuário autenticado só pode escrever em sua pasta company_id/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'company-assets') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('company-assets', 'company-assets', true);
  ELSE
    UPDATE storage.buckets SET public = true WHERE id = 'company-assets';
  END IF;
END $$;

-- Policies (idempotentes)
DROP POLICY IF EXISTS "company_assets_public_read" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_company_write" ON storage.objects;

-- Leitura pública das imagens do bucket
CREATE POLICY "company_assets_public_read"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'company-assets');

-- Escrita (insert/update/delete) apenas para usuários autenticados na própria pasta
CREATE POLICY "company_assets_company_write"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND (storage.foldername(name))[1] = (
      SELECT up.company_id::text FROM public.user_profiles up WHERE up.id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'company-assets'
    AND (storage.foldername(name))[1] = (
      SELECT up.company_id::text FROM public.user_profiles up WHERE up.id = auth.uid()
    )
  );

