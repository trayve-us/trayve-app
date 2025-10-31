/**
 * Pipeline Execute API
 * POST /api/pipeline/execute
 * 
 * Initiates AI image generation pipeline with validation and tier checks.
 * Returns execution_id for polling status.
 * 
 * Request Body:
 * {
 *   base_model_id: string;
 *   clothing_image_url: string;
 *   poses: Array<{ pose_id: string; image_url: string; pose_name?: string }>;
 *   project_name?: string;
 *   project_description?: string;
 * }
 * 
 * Response:
 * {
 *   success: boolean;
 *   execution_id?: string;
 *   project_id?: string;
 *   status?: string;
 *   total_poses?: number;
 *   error?: string;
 * }
 */

import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../config/shopify.server";
import {
  startPipelineExecution,
  type PoseInput,
} from "../lib/services/pipeline-execution.service";
import { getActiveSubscription } from "../lib/services/subscription.service";
import { supabaseAdmin } from "../lib/storage/supabase.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Authenticate Shopify request
    const { session } = await authenticate.admin(request);

    if (!session || !session.shop) {
      return json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get Trayve user ID from Shopify shop
    const { data: shopifyUser, error: userError } = await supabaseAdmin
      .from("shopify_users")
      .select("trayve_user_id, shop_domain")
      .eq("shop_domain", session.shop)
      .single();

    if (userError || !shopifyUser) {
      console.error("❌ Error fetching user:", userError);
      return json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const userId = shopifyUser.trayve_user_id;

    // Get user's subscription tier
    const subscription = await getActiveSubscription(userId);
    const subscriptionTier = subscription?.plan_tier || "free";

    console.log(`📋 Pipeline execute request from user ${userId} (tier: ${subscriptionTier})`);

    // Parse request body
    const body = await request.json();
    const {
      base_model_id,
      clothing_image_url,
      poses,
      project_name,
      project_description,
    } = body;

    // Validate required fields
    if (!base_model_id) {
      return json(
        { success: false, error: "base_model_id is required" },
        { status: 400 }
      );
    }

    if (!clothing_image_url) {
      return json(
        { success: false, error: "clothing_image_url is required" },
        { status: 400 }
      );
    }

    if (!poses || !Array.isArray(poses) || poses.length === 0) {
      return json(
        { success: false, error: "At least one pose is required" },
        { status: 400 }
      );
    }

    if (poses.length > 10) {
      return json(
        { success: false, error: "Maximum 10 poses allowed per execution" },
        { status: 400 }
      );
    }

    // Validate each pose
    for (const pose of poses) {
      if (!pose.pose_id) {
        return json(
          { success: false, error: "Each pose must have a pose_id" },
          { status: 400 }
        );
      }

      if (!pose.image_url) {
        return json(
          { success: false, error: "Each pose must have an image_url" },
          { status: 400 }
        );
      }
    }

    // Verify base model exists
    const { data: baseModel, error: modelError } = await supabaseAdmin
      .from("base_models")
      .select("id, name, is_active")
      .eq("id", base_model_id)
      .single();

    if (modelError || !baseModel) {
      console.error("❌ Base model not found:", base_model_id);
      return json(
        { success: false, error: "Base model not found" },
        { status: 404 }
      );
    }

    if (!baseModel.is_active) {
      return json(
        { success: false, error: "Base model is not active" },
        { status: 400 }
      );
    }

    // Check user credits
    const { data: userCredits, error: creditsError } = await supabaseAdmin
      .from("user_credits")
      .select("available_credits, total_credits, used_credits")
      .eq("user_id", userId)
      .single();

    if (creditsError || !userCredits) {
      console.error("❌ Error fetching credits:", creditsError);
      return json(
        { success: false, error: "Unable to fetch user credits" },
        { status: 500 }
      );
    }

    const requiredCredits = 1000 * poses.length; // 1000 credits per pose
    const availableCredits = userCredits.available_credits || 0;

    if (availableCredits < requiredCredits) {
      return json(
        {
          success: false,
          error: "Insufficient credits",
          required_credits: requiredCredits,
          available_credits: availableCredits,
          poses_count: poses.length,
        },
        { status: 402 } // 402 Payment Required
      );
    }

    // Validate poses belong to the base model
    const poseIds = poses.map((p) => p.pose_id);
    const { data: validPoses, error: posesError } = await supabaseAdmin
      .from("model_poses")
      .select("id")
      .eq("base_model_id", base_model_id)
      .in("id", poseIds);

    if (posesError) {
      console.error("❌ Error validating poses:", posesError);
      return json(
        { success: false, error: "Error validating poses" },
        { status: 500 }
      );
    }

    if (!validPoses || validPoses.length !== poses.length) {
      return json(
        { success: false, error: "One or more poses do not belong to the selected model" },
        { status: 400 }
      );
    }

    // Start pipeline execution
    const result = await startPipelineExecution({
      user_id: userId,
      subscription_tier: subscriptionTier as any,
      base_model_id,
      clothing_image_url,
      poses: poses as PoseInput[],
      project_name,
      project_description,
    });

    console.log(`✅ Pipeline execution started: ${result.execution_id}`);

    return json({
      success: true,
      execution_id: result.execution_id,
      project_id: result.project_id,
      status: result.status,
      total_poses: result.total_poses,
      message: `Processing ${result.total_poses} pose(s). Use /api/pipeline/status/${result.execution_id} to track progress.`,
    });
  } catch (error: any) {
    console.error("❌ Error in pipeline execute:", error);

    return json(
      {
        success: false,
        error: error.message || "Failed to start pipeline execution",
      },
      { status: 500 }
    );
  }
};
