/**
 * Models Service
 * Handles all operations related to base models and poses
 */

import { supabaseAdmin } from "../storage/supabase.server";
import type { UploadResult } from "./storage.service";

// =============================================
// PUBLIC URL HELPER (duplicated to avoid circular dependency)
// =============================================

function getPublicUrl(filePath: string, bucket: string = 'models'): string {
  if (!filePath) return '';
  
  const { data } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

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
  is_promoted?: boolean; // Optional field
  created_at: string;
  updated_at: string;
  uploaded_by?: string;
  source?: string;
  metadata?: any;
  poses?: ModelPose[];
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
}

export interface ModelFilters {
  gender?: string;
  body_type?: string;
  is_active?: boolean;
  promoted_only?: boolean;
}

// =============================================
// MODEL OPERATIONS
// =============================================

/**
 * Get base models with optional filters
 * @param filters - Optional filters to apply
 * @returns Array of base models with their poses
 */
export async function getBaseModels(filters?: ModelFilters): Promise<BaseModel[]> {
  try {
    let query = supabaseAdmin
      .from("base_models")
      .select(`
        *,
        poses:model_poses(*)
      `);

    // Apply filters
    if (filters?.gender) {
      query = query.eq("gender", filters.gender);
    }

    if (filters?.body_type) {
      query = query.eq("body_type", filters.body_type);
    }

    if (filters?.is_active !== undefined) {
      query = query.eq("is_active", filters.is_active);
    }

    // Only filter by promoted if explicitly requested
    // (skip if promoted_only is false or undefined to avoid errors if column doesn't exist)
    if (filters?.promoted_only === true) {
      query = query.eq("is_promoted", true);
    }

    // Order by promoted status first (unlocked models first), then by creation date
    // Note: is_promoted may be null, so we order nulls last
    query = query
      .order("is_promoted", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching base models:", error);
      throw new Error(`Failed to fetch base models: ${error.message}`);
    }

    // Convert supabase_path to full image URLs
    const modelsWithUrls = (data || []).map((model: any) => {
      const modelWithUrl = {
        ...model,
        image_url: model.image_url || getPublicUrl(model.supabase_path, 'models'),
      };

      // Process pose images
      if (model.poses && Array.isArray(model.poses)) {
        modelWithUrl.poses = model.poses
          .filter((pose: any) => pose.is_active)
          .map((pose: any) => ({
            ...pose,
            image_url: pose.image_url || getPublicUrl(pose.supabase_path, 'models'),
          }));
      }

      return modelWithUrl;
    });

    return modelsWithUrls;
  } catch (error) {
    console.error("Error in getBaseModels:", error);
    throw error;
  }
}

/**
 * Get a single base model by ID with its poses
 * @param id - Base model ID
 * @returns Base model with poses or null if not found
 */
export async function getBaseModelById(id: string): Promise<BaseModel | null> {
  try {
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

    if (!data) return null;

    // Convert supabase_path to full image URLs
    const modelWithUrl = {
      ...data,
      image_url: data.image_url || getPublicUrl(data.supabase_path, 'models'),
    };

    // Process pose images
    if (data.poses && Array.isArray(data.poses)) {
      modelWithUrl.poses = data.poses
        .filter((pose: any) => pose.is_active)
        .map((pose: any) => ({
          ...pose,
          image_url: pose.image_url || getPublicUrl(pose.supabase_path, 'models'),
        }));
    }

    return modelWithUrl;
  } catch (error) {
    console.error("Error in getBaseModelById:", error);
    return null;
  }
}

/**
 * Get all poses for a specific base model
 * @param baseModelId - Base model ID
 * @returns Array of model poses
 */
export async function getModelPoses(baseModelId: string): Promise<ModelPose[]> {
  try {
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

    // Convert supabase_path to full image URLs
    const posesWithUrls = (data || []).map((pose) => ({
      ...pose,
      image_url: pose.image_url || getPublicUrl(pose.supabase_path, 'models'),
    }));

    return posesWithUrls;
  } catch (error) {
    console.error("Error in getModelPoses:", error);
    throw error;
  }
}

/**
 * Get promoted models only (for pose studio)
 * @returns Array of promoted base models
 */
export async function getPromotedModels(): Promise<BaseModel[]> {
  return getBaseModels({
    is_active: true,
    promoted_only: true,
  });
}

/**
 * Get models count by filters
 * @param filters - Optional filters to apply
 * @returns Count of models
 */
export async function getModelsCount(filters?: ModelFilters): Promise<number> {
  try {
    let query = supabaseAdmin
      .from("base_models")
      .select("*", { count: 'exact', head: true });

    // Apply filters
    if (filters?.gender) {
      query = query.eq("gender", filters.gender);
    }

    if (filters?.body_type) {
      query = query.eq("body_type", filters.body_type);
    }

    if (filters?.is_active !== undefined) {
      query = query.eq("is_active", filters.is_active);
    }

    if (filters?.promoted_only) {
      query = query.eq("is_promoted", true);
    }

    const { count, error } = await query;

    if (error) {
      console.error("Error counting models:", error);
      throw new Error(`Failed to count models: ${error.message}`);
    }

    return count || 0;
  } catch (error) {
    console.error("Error in getModelsCount:", error);
    return 0;
  }
}
