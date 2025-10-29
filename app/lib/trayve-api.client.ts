/**
 * Trayve Backend API Client for Shopify App
 * Connects to existing Trayve backend running on https://trayve.app
 * 
 * Uses existing API endpoints:
 * - GET  /api/models/base-models - Fetch all base models
 * - POST /api/models/base-models - Fetch filtered base models
 * - GET  /api/models/poses?base_model_id=xxx - Fetch poses for a model
 * - POST /api/models/poses - Fetch poses (POST version)
 * - POST /api/models/upload - Upload new base model
 * - GET  /api/models/[id] - Fetch single model by ID
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

export interface BaseModelFilters {
  gender?: string;
  body_type?: string;
  is_active?: boolean;
  promoted_only?: boolean;
}

// =============================================
// API CLIENT CLASS
// =============================================

export class TrayveApiClient {
  /**
   * Fetch all base models with optional filters
   * Uses: GET /api/models/base-models
   */
  static async getBaseModels(filters?: BaseModelFilters): Promise<BaseModel[]> {
    try {
      const url = `${TRAYVE_BACKEND_URL}/api/models/base-models`;
      
      console.log("🔍 Fetching base models from Trayve backend:", url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filters: filters || {} }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      console.log(`✅ Fetched ${data.models?.length || 0} base models`);
      
      return data.models || [];
    } catch (error) {
      console.error("❌ Error fetching base models from Trayve backend:", error);
      throw error;
    }
  }

  /**
   * Fetch a single base model by ID
   * Uses: GET /api/models/[id]
   */
  static async getBaseModelById(id: string): Promise<BaseModel | null> {
    try {
      const url = `${TRAYVE_BACKEND_URL}/api/models/${id}`;
      
      console.log("🔍 Fetching base model by ID:", id);
      
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      console.log("✅ Fetched base model:", data.model?.name);
      
      return data.model || null;
    } catch (error) {
      console.error("❌ Error fetching base model by ID:", error);
      throw error;
    }
  }

  /**
   * Fetch all poses for a base model
   * Uses: GET /api/models/poses?base_model_id=xxx
   */
  static async getModelPoses(baseModelId: string): Promise<ModelPose[]> {
    try {
      const url = `${TRAYVE_BACKEND_URL}/api/models/poses?base_model_id=${baseModelId}`;
      
      console.log("🔍 Fetching poses for model:", baseModelId);
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      console.log(`✅ Fetched ${data.poses?.length || 0} poses`);
      
      return data.poses || [];
    } catch (error) {
      console.error("❌ Error fetching model poses:", error);
      throw error;
    }
  }

  /**
   * Upload a new base model
   * Uses: POST /api/models/upload
   */
  static async uploadBaseModel(formData: FormData): Promise<any> {
    try {
      const url = `${TRAYVE_BACKEND_URL}/api/models/upload`;
      
      console.log("📤 Uploading base model to Trayve backend");
      
      const response = await fetch(url, {
        method: 'POST',
        body: formData, // Send FormData directly (includes Content-Type boundary)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      
      console.log("✅ Base model uploaded successfully");
      
      return data;
    } catch (error) {
      console.error("❌ Error uploading base model:", error);
      throw error;
    }
  }
}
