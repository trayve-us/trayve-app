/**
 * Models API Route
 * GET/POST /api/models - Fetch base models and poses
 * 
 * Uses organized service layer for better maintainability
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import {
  getBaseModels,
  getBaseModelById,
  getModelPoses,
  getPromotedModels,
  type ModelFilters,
} from "../lib/services/models.service";

/**
 * GET /api/models
 * Query Parameters:
 * - type: 'base-models' | 'poses' (default: 'base-models')
 * - id: Model ID (for fetching specific model)
 * - base_model_id: Base model ID (required for type='poses')
 * 
 * Fixed Filters for GET:
 * - is_active: true
 * - promoted_only: true
 * - No dynamic filters accepted
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Authenticate the request (optional - comment out if public API needed)
    await authenticate.admin(request);

    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "base-models";
    const modelId = url.searchParams.get("id");
    const baseModelId = url.searchParams.get("base_model_id");

    console.log(`🔍 GET /api/models - type: ${type}`);

    // Fetch poses for a specific base model
    if (type === "poses") {
      if (!baseModelId) {
        return json(
          {
            success: false,
            error: "base_model_id is required for fetching poses",
            poses: [],
          },
          { status: 400 }
        );
      }

      const poses = await getModelPoses(baseModelId);

      console.log(`✅ Fetched ${poses.length} poses for model ${baseModelId}`);

      return json({
        success: true,
        poses,
        count: poses.length,
      });
    }

    // Fetch specific model by ID
    if (modelId) {
      const model = await getBaseModelById(modelId);

      if (!model) {
        return json(
          {
            success: false,
            error: "Model not found",
            model: null,
          },
          { status: 404 }
        );
      }

      console.log(`✅ Fetched model: ${model.name}`);

      return json({
        success: true,
        model,
      });
    }

    // Fetch base models with FIXED filters for GET requests
    const filters: ModelFilters = {
      is_active: true,
      promoted_only: true, // Fixed - no dynamic filters accepted
    };

    const models = await getBaseModels(filters);

    console.log(`✅ GET fetched ${models.length} base models with fixed filters:`, filters);

    return json({
      success: true,
      models,
      count: models.length,
      filters,
    });
  } catch (error: any) {
    console.error("❌ Error in GET /api/models:", error);

    return json(
      {
        success: false,
        error: error.message || "Failed to fetch models",
      },
      { status: 500 }
    );
  }
};

/**
 * POST /api/models
 * Fetch models with filters in request body
 * 
 * Request Body:
 * {
 *   filters: {
 *     gender?: string;         // Optional: filter by gender
 *     body_type?: string;      // Optional: filter by body_type
 *     is_active?: boolean;     // Optional: filter by active status
 *     promoted_only?: boolean; // Optional: defaults to true unless explicitly set to false
 *   }
 * }
 * 
 * Default Filter:
 * - promoted_only: true (unless explicitly set to false)
 * 
 * Additional filters (gender, body_type, is_active) are passed through as provided
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // Authenticate the request (optional - comment out if public API needed)
    await authenticate.admin(request);

    const body = await request.json();
    const { filters = {} } = body;

    console.log("🔍 POST /api/models with filters:", filters);

    // Enhanced filters with promoted_only default
    const enhancedFilters: ModelFilters = {
      promoted_only: filters.promoted_only !== false, // Default to true unless explicitly set to false
    };

    // Pass through additional filters if provided
    if (filters.gender !== undefined && filters.gender !== "all") {
      enhancedFilters.gender = filters.gender;
    }

    if (filters.body_type !== undefined && filters.body_type !== "all") {
      enhancedFilters.body_type = filters.body_type;
    }

    if (filters.is_active !== undefined) {
      enhancedFilters.is_active = filters.is_active;
    }

    const models = await getBaseModels(enhancedFilters);

    console.log(`✅ POST fetched ${models.length} base models with filters:`, enhancedFilters);

    return json({
      success: true,
      models,
      count: models.length,
      filters: enhancedFilters,
    });
  } catch (error: any) {
    console.error("❌ Error in POST /api/models:", error);

    return json(
      {
        success: false,
        error: error.message || "Failed to fetch models",
        models: [],
      },
      { status: 500 }
    );
  }
};
