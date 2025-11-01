-- Create a new storage bucket for Shopify generated images with larger file size limit
-- This bucket will store AI-generated images from the Shopify app pipeline

-- Create the bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'users-generations',
  'users-generations',
  true,
  52428800, -- 50MB limit (50 * 1024 * 1024)
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[];

-- Set up RLS policies for the generations bucket
-- Allow authenticated users to upload their own files
CREATE POLICY IF NOT EXISTS "Users can upload their own generations"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'users-generations' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to read their own files
CREATE POLICY IF NOT EXISTS "Users can read their own generations"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'users-generations' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access (for displaying images)
CREATE POLICY IF NOT EXISTS "Public can read generations"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'users-generations');

-- Allow authenticated users to delete their own files
CREATE POLICY IF NOT EXISTS "Users can delete their own generations"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'users-generations' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
