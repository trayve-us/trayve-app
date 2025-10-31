/**
 * Supabase Client for Shopify App
 * Shares the same database with the main Trayve application
 */

import { createClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
}

// Client for browser-side operations (uses anon key)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Admin client for server-side operations (uses service role key)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Database types (you can import these from your main project later)
export type Database = {
  public: {
    Tables: {
      projects: any;
      generation_results: any;
      user_banners: any;
      pipeline_executions: any;
      // Add other tables as needed
    };
  };
};

/**
 * Upload a file to Supabase Storage
 * @param bucket - Storage bucket name
 * @param path - File path within the bucket
 * @param file - File buffer or Blob
 * @param contentType - MIME type of the file
 * @returns Object with success status, URL, and path
 */
export async function uploadToStorage(
  bucket: string,
  path: string,
  file: Buffer | Blob,
  contentType?: string
): Promise<{ success: boolean; url?: string; path?: string; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, file, {
        contentType: contentType || 'application/octet-stream',
        upsert: true, // Overwrite if exists
      });

    if (error) {
      console.error('❌ Supabase storage upload error:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(path);

    return {
      success: true,
      url: urlData.publicUrl,
      path: data.path,
    };
  } catch (error: any) {
    console.error('❌ Upload error:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload file',
    };
  }
}

/**
 * Download a file from Supabase Storage
 * @param bucket - Storage bucket name
 * @param path - File path within the bucket
 * @returns File buffer or null if error
 */
export async function downloadFromStorage(
  bucket: string,
  path: string
): Promise<Buffer | null> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .download(path);

    if (error) {
      console.error('❌ Supabase storage download error:', error);
      return null;
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('❌ Download error:', error);
    return null;
  }
}

/**
 * Delete a file from Supabase Storage
 * @param bucket - Storage bucket name
 * @param path - File path within the bucket
 * @returns Success status
 */
export async function deleteFromStorage(
  bucket: string,
  path: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      console.error('❌ Supabase storage delete error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('❌ Delete error:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete file',
    };
  }
}
