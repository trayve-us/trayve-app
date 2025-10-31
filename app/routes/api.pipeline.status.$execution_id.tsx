/**
 * Pipeline Status API
 * GET /api/pipeline/status/:execution_id
 * 
 * Polls execution status and retrieves results.
 * Use this endpoint to track progress of AI generation pipeline.
 * 
 * Response:
 * {
 *   success: boolean;
 *   execution_id: string;
 *   project_id: string;
 *   status: 'processing' | 'completed' | 'failed' | 'cancelled';
 *   total_poses: number;
 *   completed_poses: number;
 *   failed_poses: number;
 *   generation_results: Array<{
 *     result_id: string;
 *     pose_id: string;
 *     pose_name?: string;
 *     status: string;
 *     final_image_url?: string;
 *     step_results: { [step: string]: string };
 *     error?: string;
 *   }>;
 *   error?: string;
 * }
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../config/shopify.server";
import { getExecutionStatus } from "../lib/services/pipeline-execution.service";
import { supabaseAdmin } from "../lib/storage/supabase.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
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
      .select("trayve_user_id")
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

    // Get execution_id from params
    const executionId = params.execution_id;

    if (!executionId) {
      return json(
        { success: false, error: "execution_id is required" },
        { status: 400 }
      );
    }

    console.log(`🔍 Fetching status for execution: ${executionId}`);

    // Verify execution belongs to user
    const { data: execution, error: execError } = await supabaseAdmin
      .from("pipeline_executions")
      .select("user_id")
      .eq("id", executionId)
      .single();

    if (execError || !execution) {
      console.error("❌ Execution not found:", executionId);
      return json(
        { success: false, error: "Execution not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (execution.user_id !== userId) {
      return json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Get execution status
    const result = await getExecutionStatus(executionId);

    if (!result) {
      return json(
        { success: false, error: "Failed to fetch execution status" },
        { status: 500 }
      );
    }

    console.log(`✅ Status: ${result.status}, Completed: ${result.completed_poses}/${result.total_poses}`);

    return json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("❌ Error in pipeline status:", error);

    return json(
      {
        success: false,
        error: error.message || "Failed to fetch pipeline status",
      },
      { status: 500 }
    );
  }
};
