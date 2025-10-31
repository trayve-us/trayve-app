/**
 * Pipeline Database Service
 * Advanced database operations for pipeline executions
 * Matches functionality from main Trayve app's database-service.ts
 */

import { supabaseAdmin } from "../storage/supabase.server";

// =============================================
// TYPE DEFINITIONS
// =============================================

export interface ExecutionFilters {
  userId?: string;
  status?: string[];
  tier?: string[];
  startDate?: string;
  endDate?: string;
  projectId?: string;
  limit?: number;
  offset?: number;
}

export interface ExecutionAnalytics {
  totalExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  activeExecutions: number;
  averageProcessingTime: number;
  totalCreditsUsed: number;
  successRate: number;
  executionsByTier: Record<string, number>;
  executionsByStatus: Record<string, number>;
}

export interface QueueStatus {
  activeExecutions: number;
  queuedExecutions: number;
  concurrentLimit: number;
  dailyUsage: number;
  dailyLimit: number;
  canStartNew: boolean;
}

export interface UsageStats {
  period: string;
  totalExecutions: number;
  creditsByTier: Record<string, number>;
  executionsPerDay: Array<{ date: string; count: number }>;
  averageCreditsPerExecution: number;
  successRate: number;
}

export interface CachedResult {
  stepType: string;
  imageUrl: string;
  metadata: any;
  createdAt: string;
}

// =============================================
// PIPELINE DATABASE SERVICE CLASS
// =============================================

export class PipelineDatabaseService {
  /**
   * Get execution history with advanced filtering
   */
  static async getExecutionHistory(
    filters: ExecutionFilters
  ): Promise<any[]> {
    let query = supabaseAdmin
      .from("pipeline_executions")
      .select(`
        *,
        user_generation_projects!inner(
          id,
          title,
          clothing_image_url
        )
      `)
      .order("created_at", { ascending: false });

    if (filters.userId) {
      query = query.eq("user_id", filters.userId);
    }

    if (filters.status && filters.status.length > 0) {
      query = query.in("status", filters.status);
    }

    if (filters.tier && filters.tier.length > 0) {
      query = query.in("subscription_tier", filters.tier);
    }

    if (filters.projectId) {
      query = query.eq("project_id", filters.projectId);
    }

    if (filters.startDate) {
      query = query.gte("created_at", filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte("created_at", filters.endDate);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching execution history:", error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get execution analytics for a user or time period
   */
  static async getExecutionAnalytics(
    userId: string,
    period: string = "30d"
  ): Promise<ExecutionAnalytics> {
    const daysMap: Record<string, number> = {
      "7d": 7,
      "30d": 30,
      "90d": 90,
    };

    const days = daysMap[period] || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: executions, error } = await supabaseAdmin
      .from("pipeline_executions")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString());

    if (error || !executions) {
      throw new Error("Failed to fetch analytics");
    }

    const totalExecutions = executions.length;
    const completedExecutions = executions.filter(e => e.status === "completed").length;
    const failedExecutions = executions.filter(e => e.status === "failed").length;
    const activeExecutions = executions.filter(e => e.status === "processing").length;

    // Calculate average processing time (completed only)
    const completedWithTime = executions.filter(
      e => e.status === "completed" && e.started_at && e.completed_at
    );
    const avgProcessingTime = completedWithTime.length > 0
      ? completedWithTime.reduce((sum, e) => {
          const start = new Date(e.started_at).getTime();
          const end = new Date(e.completed_at).getTime();
          return sum + (end - start);
        }, 0) / completedWithTime.length / 1000 // Convert to seconds
      : 0;

    const totalCreditsUsed = executions.reduce((sum, e) => sum + (e.credits_used || 0), 0);
    const successRate = totalExecutions > 0 ? (completedExecutions / totalExecutions) * 100 : 0;

    // Group by tier
    const executionsByTier = executions.reduce((acc, e) => {
      const tier = e.subscription_tier || "unknown";
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group by status
    const executionsByStatus = executions.reduce((acc, e) => {
      const status = e.status || "unknown";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalExecutions,
      completedExecutions,
      failedExecutions,
      activeExecutions,
      averageProcessingTime: Math.round(avgProcessingTime),
      totalCreditsUsed,
      successRate: Math.round(successRate * 100) / 100,
      executionsByTier,
      executionsByStatus,
    };
  }

  /**
   * Get queue status for a user
   */
  static async getQueueStatus(userId: string): Promise<QueueStatus> {
    // Get active executions
    const { data: activeExecs, error: activeError } = await supabaseAdmin
      .from("pipeline_executions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "processing");

    if (activeError) {
      throw new Error("Failed to fetch queue status");
    }

    // Get today's usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: todayExecs, error: todayError } = await supabaseAdmin
      .from("pipeline_executions")
      .select("id")
      .eq("user_id", userId)
      .gte("created_at", today.toISOString());

    if (todayError) {
      throw new Error("Failed to fetch daily usage");
    }

    const activeExecutions = activeExecs?.length || 0;
    const dailyUsage = todayExecs?.length || 0;

    // Limits (can be customized per user tier)
    const concurrentLimit = 5; // Max 5 concurrent executions
    const dailyLimit = 100; // Max 100 executions per day

    return {
      activeExecutions,
      queuedExecutions: 0, // Not implemented yet
      concurrentLimit,
      dailyUsage,
      dailyLimit,
      canStartNew: activeExecutions < concurrentLimit && dailyUsage < dailyLimit,
    };
  }

  /**
   * Get usage statistics over time
   */
  static async getUsageStats(userId: string, period: string = "30d"): Promise<UsageStats> {
    const daysMap: Record<string, number> = {
      "7d": 7,
      "30d": 30,
      "90d": 90,
    };

    const days = daysMap[period] || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: executions, error } = await supabaseAdmin
      .from("pipeline_executions")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: true });

    if (error || !executions) {
      throw new Error("Failed to fetch usage stats");
    }

    const totalExecutions = executions.length;
    const completedExecutions = executions.filter(e => e.status === "completed").length;
    const successRate = totalExecutions > 0 ? (completedExecutions / totalExecutions) * 100 : 0;

    // Credits by tier
    const creditsByTier = executions.reduce((acc, e) => {
      const tier = e.subscription_tier || "unknown";
      acc[tier] = (acc[tier] || 0) + (e.credits_used || 0);
      return acc;
    }, {} as Record<string, number>);

    // Executions per day
    const executionsPerDay: Array<{ date: string; count: number }> = [];
    const dailyMap = new Map<string, number>();

    executions.forEach(e => {
      const date = new Date(e.created_at).toISOString().split("T")[0];
      dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
    });

    dailyMap.forEach((count, date) => {
      executionsPerDay.push({ date, count });
    });

    const totalCredits = (Object.values(creditsByTier) as number[]).reduce((sum, c) => sum + c, 0);
    const averageCreditsPerExecution = totalExecutions > 0 ? totalCredits / totalExecutions : 0;

    return {
      period,
      totalExecutions,
      creditsByTier,
      executionsPerDay,
      averageCreditsPerExecution: Math.round(averageCreditsPerExecution),
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  /**
   * Get all active executions for a project
   */
  static async getProjectActiveExecutions(projectId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from("pipeline_executions")
      .select("*")
      .eq("project_id", projectId)
      .eq("status", "processing")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching project executions:", error);
      return [];
    }

    return data || [];
  }

  /**
   * Check for cached result (avoid duplicate processing)
   */
  static async getCachedResult(
    contentHash: string,
    stepType: string,
    qualityLevel: string
  ): Promise<CachedResult | null> {
    // Query generation_results for matching content
    const { data, error } = await supabaseAdmin
      .from("generation_results")
      .select("*")
      .contains("generation_metadata", { contentHash, stepType, qualityLevel })
      .eq("generation_metadata->status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      stepType,
      imageUrl: data.result_image_url,
      metadata: data.generation_metadata,
      createdAt: data.created_at,
    };
  }

  /**
   * Set cached result for future use
   */
  static async setCachedResult(
    contentHash: string,
    stepType: string,
    qualityLevel: string,
    imageUrl: string,
    metadata: any
  ): Promise<void> {
    // Update generation_metadata with cache info
    const cacheMetadata = {
      ...metadata,
      contentHash,
      stepType,
      qualityLevel,
      cached: true,
    };

    // This would be stored in generation_metadata
    // Implementation depends on how you want to structure caching
  }

  /**
   * Get system health status
   */
  static async getSystemHealth(): Promise<any> {
    try {
      // Test database connection
      const { error: dbError } = await supabaseAdmin
        .from("pipeline_executions")
        .select("id")
        .limit(1);

      // Get recent failure rate
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data: recentExecs } = await supabaseAdmin
        .from("pipeline_executions")
        .select("status")
        .gte("created_at", yesterday.toISOString());

      const totalRecent = recentExecs?.length || 0;
      const failedRecent = recentExecs?.filter(e => e.status === "failed").length || 0;
      const failureRate = totalRecent > 0 ? (failedRecent / totalRecent) * 100 : 0;

      return {
        database: dbError ? "error" : "healthy",
        failureRate: Math.round(failureRate * 100) / 100,
        recentExecutions: totalRecent,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        database: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get multiple execution statuses in one query (batch polling)
   */
  static async getMultipleExecutionStatuses(executionIds: string[]): Promise<any[]> {
    if (!executionIds || executionIds.length === 0) {
      return [];
    }

    const { data, error } = await supabaseAdmin
      .from("pipeline_executions")
      .select(`
        id,
        status,
        progress,
        current_step,
        subscription_tier,
        credits_used,
        started_at,
        completed_at,
        error_message,
        project_id
      `)
      .in("id", executionIds);

    if (error) {
      console.error("Error fetching multiple execution statuses:", error);
      throw error;
    }

    return data || [];
  }
}
