-- 011_storage_buckets.sql
-- Storage buckets para assets

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('logos', 'logos', false, 5242880, ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']),
  ('avatars', 'avatars', false, 5242880, ARRAY['image/png', 'image/jpeg']),
  ('fonts', 'fonts', false, 2097152, ARRAY['font/woff2', 'font/ttf', 'font/otf', 'application/font-woff2', 'application/x-font-ttf', 'application/vnd.ms-opentype']),
  ('exports', 'exports', false, 10485760, ARRAY['image/png']),
  ('images', 'images', false, 10485760, ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies: usuarios autenticados que sao membros do workspace
CREATE POLICY "storage_logos_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'logos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "storage_logos_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'logos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "storage_avatars_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "storage_avatars_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "storage_fonts_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'fonts'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "storage_fonts_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'fonts'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "storage_exports_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'exports'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "storage_exports_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'exports'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "storage_images_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "storage_images_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'images'
    AND auth.role() = 'authenticated'
  );
