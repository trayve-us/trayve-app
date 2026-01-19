/**
 * Storage Service
 * Handles all operations related to Supabase storage buckets
 */

import { supabaseAdmin } from "../storage/supabase.server";

// =============================================
// STORAGE BUCKETS
// =============================================

export const STORAGE_BUCKETS = {
  MODELS: 'models',
  USER_IMAGES: 'user-images',
  BRAND_ASSETS: 'brand-assets',
  SHOPIFY_GENERATIONS: 'shopify-generations', // New bucket with 50MB limit for Shopify app
} as const;

// =============================================
// TYPE DEFINITIONS
// =============================================

export interface UploadResult {
  url: string;
  path: string;
}

// =============================================
// PUBLIC URL HELPERS
// =============================================

/**
 * Get public URL for a file in any storage bucket
 * @param filePath - Path to the file in the bucket
 * @param bucket - Storage bucket name (default: 'models')
 * @returns Public URL for the file
 */
export function getPublicUrl(
  filePath: string,
  bucket: string = STORAGE_BUCKETS.MODELS
): string {
  if (!filePath) return '';
  
  const { data } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Get public URL for a file in models bucket
 * @param filePath - Path to the file
 * @returns Public URL
 */
export function getModelsPublicUrl(filePath: string): string {
  return getPublicUrl(filePath, STORAGE_BUCKETS.MODELS);
}

/**
 * Get public URL for a file in user-images bucket
 * @param filePath - Path to the file
 * @returns Public URL
 */
export function getUserImagesPublicUrl(filePath: string): string {
  return getPublicUrl(filePath, STORAGE_BUCKETS.USER_IMAGES);
}

/**
 * Get public URL for a file in brand-assets bucket
 * @param filePath - Path to the file
 * @returns Public URL
 */
export function getBrandAssetsPublicUrl(filePath: string): string {
  return getPublicUrl(filePath, STORAGE_BUCKETS.BRAND_ASSETS);
}

// =============================================
// UPLOAD OPERATIONS
// =============================================

/**
 * Upload image to models bucket
 * @param imageBuffer - Image buffer
 * @param fileName - File name
 * @param contentType - MIME type (default: image/jpeg)
 * @returns Upload result with URL and path
 */
export async function uploadToModelsBucket(
  imageBuffer: Buffer,
  fileName: string,
  contentType: string = "image/jpeg"
): Promise<UploadResult> {
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKETS.MODELS)
    .upload(fileName, imageBuffer, {
      contentType,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("Upload error to models bucket:", error);
    throw new Error(`Failed to upload to models bucket: ${error.message}`);
  }

  const publicUrl = getModelsPublicUrl(data.path);

  return {
    url: publicUrl,
    path: data.path,
  };
}

/**
 * Upload image to user-images bucket
 * @param imageBuffer - Image buffer
 * @param fileName - File name
 * @param contentType - MIME type (default: image/png)
 * @returns Upload result with URL and path
 */
export async function uploadToUserImagesBucket(
  imageBuffer: Buffer,
  fileName: string,
  contentType: string = "image/png"
): Promise<UploadResult> {
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKETS.USER_IMAGES)
    .upload(fileName, imageBuffer, {
      contentType,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("Upload error to user-images bucket:", error);
    throw new Error(`Failed to upload to user-images bucket: ${error.message}`);
  }

  const publicUrl = getUserImagesPublicUrl(data.path);

  return {
    url: publicUrl,
    path: data.path,
  };
}

/**
 * Upload image to shopify-generations bucket (50MB limit)
 * @param imageBuffer - Image buffer
 * @param fileName - File name
 * @param contentType - MIME type (default: image/png)
 * @returns Upload result with URL and path
 */
export async function uploadToShopifyGenerationsBucket(
  imageBuffer: Buffer,
  fileName: string,
  contentType: string = "image/png"
): Promise<UploadResult> {
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKETS.SHOPIFY_GENERATIONS)
    .upload(fileName, imageBuffer, {
      contentType,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("Upload error to shopify-generations bucket:", error);
    throw new Error(`Failed to upload to shopify-generations bucket: ${error.message}`);
  }

  const publicUrl = getPublicUrl(data.path, STORAGE_BUCKETS.SHOPIFY_GENERATIONS);

  return {
    url: publicUrl,
    path: data.path,
  };
}

// =============================================
// DELETE OPERATIONS
// =============================================

/**
 * Delete file from models bucket
 * @param filePath - Path to the file
 */
export async function deleteFromModelsBucket(filePath: string): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKETS.MODELS)
    .remove([filePath]);

  if (error) {
    console.error("Delete error from models bucket:", error);
    throw new Error(`Failed to delete from models bucket: ${error.message}`);
  }
}

/**
 * Delete file from user-images bucket
 * @param filePath - Path to the file
 */
export async function deleteFromUserImagesBucket(filePath: string): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKETS.USER_IMAGES)
    .remove([filePath]);

  if (error) {
    console.error("Delete error from user-images bucket:", error);
    throw new Error(`Failed to delete from user-images bucket: ${error.message}`);
  }
}

// =============================================
// UTILITY FUNCTIONS
// =============================================

/**
 * Download image from URL and return buffer
 * @param imageUrl - URL of the image
 * @returns Image buffer
 */
export async function downloadImageAsBuffer(imageUrl: string): Promise<Buffer> {
  try {
    // Check if it's a data URI
    if (imageUrl.startsWith('data:')) {
      const parts = imageUrl.split(',');
      if (parts.length > 1) {
        return Buffer.from(parts[1], 'base64');
      }
    }

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("Download error:", error);
    throw new Error(`Failed to download image from URL: ${imageUrl.substring(0, 50)}...`);
  }
}

/**
 * Generate unique filename for uploaded images
 * Format: YYYY-MM-DDTHH-MM-SS-sssZ-{uuid}.{ext}
 * @param extension - File extension
 * @param prefix - Optional prefix for the filename
 * @returns Unique filename
 */
export function generateUniqueFileName(extension: string, prefix?: string): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, -1) + "Z";
  
  const uuid = crypto.randomUUID();
  const fileName = `${timestamp}-${uuid}.${extension}`;
  
  return prefix ? `${prefix}/${fileName}` : fileName;
}

/**
 * Validate image file type
 * @param mimeType - MIME type to validate
 * @returns True if valid image type
 */
export function isValidImageType(mimeType: string): boolean {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  return allowedTypes.includes(mimeType);
}

/**
 * Validate file size
 * @param size - File size in bytes
 * @param maxSizeMB - Maximum size in MB (default: 5)
 * @returns True if valid file size
 */
export function isValidFileSize(size: number, maxSizeMB: number = 5): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return size <= maxSizeBytes;
}
