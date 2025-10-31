/**
 * Pipeline Management & Analytics API
 * Handles analytics, queue status, usage stats, and health checks
 * GET /api/pipeline/manage?action=analytics&period=7d
 * GET /api/pipeline/manage?action=queue
 * GET /api/pipeline/manage?action=usage&period=30d
 * GET /api/pipeline/manage?action=health
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/config/shopify.server";
import { getShopifyUserByShop } from "~/lib/auth";
import { PipelineDatabaseService } from "~/lib/services/pipeline-database.service";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { session } = await authenticate.admin(request);
    const shop = session.shop;

    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const period = url.searchParams.get("period") || "30d";

    if (!action) {
      return json({ error: "action parameter is required" }, { status: 400 });
    }

    // Get user for most actions (except health)
    let userId: string | null = null;
    if (action !== "health") {
      const user = await getShopifyUserByShop(shop);
      if (!user) {
        return json({ error: "User not found" }, { status: 404 });
      }
      userId = user.trayve_user_id;
    }

    switch (action) {
      case "analytics": {
        if (!userId) {
          return json({ error: "User not found" }, { status: 404 });
        }
        const analytics = await PipelineDatabaseService.getExecutionAnalytics(userId, period);
        return json({
          action: "analytics",
          period,
          data: analytics,
          timestamp: new Date().toISOString(),
        });
      }

      case "queue": {
        if (!userId) {
          return json({ error: "User not found" }, { status: 404 });
        }
        const queueStatus = await PipelineDatabaseService.getQueueStatus(userId);
        return json({
          action: "queue",
          data: queueStatus,
          timestamp: new Date().toISOString(),
        });
      }

      case "usage": {
        if (!userId) {
          return json({ error: "User not found" }, { status: 404 });
        }
        const usageStats = await PipelineDatabaseService.getUsageStats(userId, period);
        return json({
          action: "usage",
          period,
          data: usageStats,
          timestamp: new Date().toISOString(),
        });
      }

      case "health": {
        const healthStatus = await PipelineDatabaseService.getSystemHealth();
        return json({
          action: "health",
          data: healthStatus,
          timestamp: new Date().toISOString(),
        });
      }

      case "history": {
        if (!userId) {
          return json({ error: "User not found" }, { status: 404 });
        }

        // Parse filters from query params
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const status = url.searchParams.get("status")?.split(",");
        const tier = url.searchParams.get("tier")?.split(",");
        const projectId = url.searchParams.get("projectId") || undefined;

        const history = await PipelineDatabaseService.getExecutionHistory({
          userId,
          status,
          tier,
          projectId,
          limit,
          offset,
        });

        return json({
          action: "history",
          data: history,
          total: history.length,
          limit,
          offset,
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return json(
          { error: `Invalid action: ${action}. Valid actions: analytics, queue, usage, health, history` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("Error in pipeline manage API:", error);
    return json(
      { error: error.message || "Failed to process management request" },
      { status: 500 }
    );
  }
}
