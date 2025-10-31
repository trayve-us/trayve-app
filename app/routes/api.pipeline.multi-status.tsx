/**
 * Multi-Execution Status API
 * Batch polling for multiple pipeline executions
 * GET /api/pipeline/multi-status?executionIds=id1,id2,id3
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/config/shopify.server";
import { PipelineDatabaseService } from "~/lib/services/pipeline-database.service";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await authenticate.admin(request);

    const url = new URL(request.url);
    const executionIdsParam = url.searchParams.get("executionIds");

    if (!executionIdsParam) {
      return json({ error: "executionIds parameter is required" }, { status: 400 });
    }

    const executionIds = executionIdsParam.split(",").map(id => id.trim());

    if (executionIds.length === 0) {
      return json({ error: "No execution IDs provided" }, { status: 400 });
    }

    if (executionIds.length > 50) {
      return json({ error: "Maximum 50 executions per request" }, { status: 400 });
    }

    // Fetch all execution statuses in one query
    const executions = await PipelineDatabaseService.getMultipleExecutionStatuses(executionIds);

    // Calculate aggregate stats
    const totalActive = executions.filter(e => e.status === "processing").length;
    const totalCompleted = executions.filter(e => e.status === "completed").length;
    const totalFailed = executions.filter(e => e.status === "failed").length;

    // Calculate overall progress (average of all progresses)
    const totalProgress = executions.reduce((sum, e) => sum + (e.progress || 0), 0);
    const overallProgress = executions.length > 0 ? Math.round(totalProgress / executions.length) : 0;

    return json({
      executions: executions.map(e => ({
        executionId: e.id,
        projectId: e.project_id,
        status: e.status,
        progress: e.progress || 0,
        currentStep: e.current_step,
        tier: e.subscription_tier,
        creditsUsed: e.credits_used || 0,
        startedAt: e.started_at,
        completedAt: e.completed_at,
        errorMessage: e.error_message,
      })),
      totalActive,
      totalCompleted,
      totalFailed,
      overallProgress,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in multi-status API:", error);
    return json(
      { error: error.message || "Failed to fetch execution statuses" },
      { status: 500 }
    );
  }
}
