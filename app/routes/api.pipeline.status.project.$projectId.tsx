/**
 * Project-Based Status API
 * Get all active executions for a specific project
 * GET /api/pipeline/status/project/:projectId
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/config/shopify.server";
import { PipelineDatabaseService } from "~/lib/services/pipeline-database.service";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    await authenticate.admin(request);

    const { projectId } = params;

    if (!projectId) {
      return json({ error: "Project ID is required" }, { status: 400 });
    }

    // Fetch all active executions for this project
    const activeExecutions = await PipelineDatabaseService.getProjectActiveExecutions(projectId);

    return json({
      projectId,
      activeExecutions: activeExecutions.map(e => ({
        executionId: e.id,
        status: e.status,
        progress: e.progress || 0,
        currentStep: e.current_step,
        tier: e.subscription_tier,
        creditsUsed: e.credits_used || 0,
        startedAt: e.started_at,
      })),
      totalActive: activeExecutions.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in project status API:", error);
    return json(
      { error: error.message || "Failed to fetch project status" },
      { status: 500 }
    );
  }
}
