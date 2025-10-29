/**
 * Trayve Backend API Client for Shopify App
 * Connects to existing Trayve backend (https://trayve.app)
 * 
 * Storage Buckets (managed by backend):
 * - 'models': Model images and pose images
 * - 'user-images': User uploaded clothing/reference images
 * - 'brand-assets': Brand kit assets (logos, etc.)
 * 
 * Database Tables (accessed via backend):
 * - 'base_models': Base model configurations
 * - 'model_poses': Pose images for each base model
 * - 'generated_models': Generated/uploaded model records
 * - 'watermarked_images': Watermarked output images
 */

// =============================================
// API CONFIGURATION
// =============================================

const TRAYVE_BACKEND_URL = process.env.TRAYVE_BACKEND_URL || 'https://trayve.app';

// =============================================
// TYPE DEFINITIONS
// =============================================

export interface BaseModel {
  id: string;
  name: string;
  description?: string;
  gender: "male" | "female" | "unisex";
  body_type: "slim" | "athletic" | "curvy" | "plus-size";
  ethnicity?: string;
  age_range?: string;
  image_url: string;
  supabase_path: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  uploaded_by?: string;
  source?: string;
  metadata?: any;
}

export interface ModelPose {
  id: string;
  base_model_id: string;
  name: string;
  description?: string;
  pose_type: "front" | "side" | "three-quarter" | "back" | "dynamic" | "seated";
  image_url: string;
  supabase_path: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  // Upscaling fields
  upscaled_image_url?: string;
  upscaled_supabase_path?: string;
  upscale_status?: "pending" | "processing" | "completed" | "failed" | null;
  upscale_fal_request_id?: string;
  upscale_error_message?: string;
  upscaled_at?: string;
  upscale_file_size?: number;
}

export interface UploadResult {
  url: string;
  path: string;
}

// =============================================
// STORAGE SERVICE CLASS
// =============================================

export class StorageService {
  /**
   * Upload image to models bucket
   * Used for: Base model images, pose images, generated model images
   */
  static async uploadToModelsBucket(
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

    const { data: urlData } = supabaseAdmin.storage
      .from(STORAGE_BUCKETS.MODELS)
      .getPublicUrl(fileName);

    return {
      url: urlData.publicUrl,
      path: data.path,
    };
  }

  /**
   * Upload image to user-images bucket
   * Used for: User uploaded clothing, reference images, brand kit assets
   */
  static async uploadToUserImagesBucket(
    imageBuffer: Buffer,
    fileName: string,
    userId: string,
    contentType: string = "image/jpeg"
  ): Promise<UploadResult> {
    const filePath = `${userId}/images/${fileName}`;

    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKETS.USER_IMAGES)
      .upload(filePath, imageBuffer, {
        contentType,
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Upload error to user-images bucket:", error);
      throw new Error(`Failed to upload to user-images bucket: ${error.message}`);
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(STORAGE_BUCKETS.USER_IMAGES)
      .getPublicUrl(filePath);

    return {
      url: urlData.publicUrl,
      path: data.path,
    };
  }

  /**
   * Get public URL for a file in models bucket
   */
  static getModelsPublicUrl(filePath: string): string {
    const { data } = supabaseAdmin.storage
      .from(STORAGE_BUCKETS.MODELS)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  /**
   * Get public URL for a file in user-images bucket
   */
  static getUserImagesPublicUrl(filePath: string): string {
    const { data } = supabaseAdmin.storage
      .from(STORAGE_BUCKETS.USER_IMAGES)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  /**
   * Delete file from models bucket
   */
  static async deleteFromModelsBucket(filePath: string): Promise<void> {
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
   */
  static async deleteFromUserImagesBucket(filePath: string): Promise<void> {
    const { error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKETS.USER_IMAGES)
      .remove([filePath]);

    if (error) {
      console.error("Delete error from user-images bucket:", error);
      throw new Error(`Failed to delete from user-images bucket: ${error.message}`);
    }
  }

  /**
   * Download image from URL and return buffer
   */
  static async downloadImageAsBuffer(imageUrl: string): Promise<Buffer> {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error("Download error:", error);
      throw new Error(`Failed to download image from URL: ${imageUrl}`);
    }
  }
}

// =============================================
// DATABASE SERVICE CLASS
// =============================================

export class DatabaseService {
  /**
   * Get all base models
   */
  static async getBaseModels(filters?: {
    gender?: string;
    body_type?: string;
    is_active?: boolean;
  }): Promise<BaseModel[]> {
    let query = supabaseAdmin.from("base_models").select(`
      *,
      poses:model_poses(*)
    `);

    if (filters?.gender) query = query.eq("gender", filters.gender);
    if (filters?.body_type) query = query.eq("body_type", filters.body_type);
    if (filters?.is_active !== undefined) query = query.eq("is_active", filters.is_active);

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching base models:", error);
      throw new Error(`Failed to fetch base models: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single base model by ID
   */
  static async getBaseModelById(id: string): Promise<BaseModel | null> {
    const { data, error } = await supabaseAdmin
      .from("base_models")
      .select(`
        *,
        poses:model_poses(*)
      `)
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching base model:", error);
      return null;
    }

    return data;
  }

  /**
   * Create a new base model
   */
  static async createBaseModel(
    modelData: Omit<BaseModel, "id" | "created_at" | "updated_at">
  ): Promise<BaseModel> {
    const { data, error } = await supabaseAdmin
      .from("base_models")
      .insert([modelData])
      .select()
      .single();

    if (error) {
      console.error("Error creating base model:", error);
      throw new Error(`Failed to create base model: ${error.message}`);
    }

    return data as BaseModel;
  }

  /**
   * Update a base model
   */
  static async updateBaseModel(
    id: string,
    updates: Partial<BaseModel>
  ): Promise<BaseModel> {
    const { data, error } = await supabaseAdmin
      .from("base_models")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating base model:", error);
      throw new Error(`Failed to update base model: ${error.message}`);
    }

    return data as BaseModel;
  }

  /**
   * Get all poses for a base model
   */
  static async getModelPoses(baseModelId: string): Promise<ModelPose[]> {
    const { data, error } = await supabaseAdmin
      .from("model_poses")
      .select("*")
      .eq("base_model_id", baseModelId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching model poses:", error);
      throw new Error(`Failed to fetch model poses: ${error.message}`);
    }

    // Filter to only include actual pose images (supabase_path should start with "poses/")
    return (data || []).filter(pose => 
      pose.supabase_path && pose.supabase_path.startsWith("poses/")
    );
  }

  /**
   * Create a new model pose
   */
  static async createModelPose(
    poseData: Omit<ModelPose, "id" | "created_at">
  ): Promise<ModelPose> {
    const { data, error } = await supabaseAdmin
      .from("model_poses")
      .insert([poseData])
      .select()
      .single();

    if (error) {
      console.error("Error creating model pose:", error);
      throw new Error(`Failed to create model pose: ${error.message}`);
    }

    return data as ModelPose;
  }

  /**
   * Update a model pose
   */
  static async updateModelPose(
    id: string,
    updates: Partial<ModelPose>
  ): Promise<ModelPose> {
    const { data, error } = await supabaseAdmin
      .from("model_poses")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating model pose:", error);
      throw new Error(`Failed to update model pose: ${error.message}`);
    }

    return data as ModelPose;
  }

  /**
   * Delete a model pose
   */
  static async deleteModelPose(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("model_poses")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting model pose:", error);
      throw new Error(`Failed to delete model pose: ${error.message}`);
    }
  }

  /**
   * Store generated model metadata
   */
  static async storeGeneratedModel(metadata: {
    user_id: string;
    prompt: string;
    enhanced_prompt?: string;
    model_type: string;
    image_url: string;
    supabase_path: string;
    generation_config?: any;
    model_display_name?: string;
    promoted_to_base?: boolean;
    base_model_id?: string;
  }): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from("generated_models")
      .insert([
        {
          ...metadata,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error storing generated model:", error);
      throw new Error(`Failed to store generated model: ${error.message}`);
    }

    return data;
  }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Generate unique filename for uploaded images
 * Format: YYYY-MM-DDTHH-MM-SS-sssZ-{uuid}.{ext}
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
 */
export function isValidFileSize(size: number, maxSizeMB: number = 5): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return size <= maxSizeBytes;
}
