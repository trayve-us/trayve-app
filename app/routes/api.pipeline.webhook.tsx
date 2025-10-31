/**
 * Pipeline Webhook API
 * Receives real-time updates from pipeline execution engine
 * POST /api/pipeline/webhook
 * 
 * Supported Events:
 * - execution.started
 * - execution.progress
 * - execution.step_completed
 * - execution.completed
 * - execution.failed
 * - execution.cancelled
 * - execution.notification
 */

import { json, type ActionFunctionArgs } from "@remix-run/node";
import { supabaseAdmin } from "~/lib/storage/supabase.server";
import crypto from "crypto";

// Webhook secret for HMAC verification (should be in env)
const WEBHOOK_SECRET = process.env.PIPELINE_WEBHOOK_SECRET || "your-webhook-secret-here";

interface WebhookPayload {
  event: string;
  executionId: string;
  timestamp: string;
  data: any;
  signature?: string;
}

/**
 * Verify HMAC signature for webhook security
 */
function verifySignature(payload: string, signature: string): boolean {
  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  const digest = hmac.update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    // Only accept POST requests
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    const bodyText = await request.text();
    const signature = request.headers.get("X-Webhook-Signature");

    // Verify signature if provided
    if (signature && !verifySignature(bodyText, signature)) {
      console.error("Invalid webhook signature");
      return json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload: WebhookPayload = JSON.parse(bodyText);
    const { event, executionId, data } = payload;

    console.log(`📥 Webhook received: ${event} for execution ${executionId}`);

    switch (event) {
      case "execution.started": {
        await supabaseAdmin
          .from("pipeline_executions")
          .update({
            status: "processing",
            started_at: data.startedAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", executionId);

        console.log(`✅ Execution ${executionId} started`);
        break;
      }

      case "execution.progress": {
        await supabaseAdmin
          .from("pipeline_executions")
          .update({
            progress: data.progress || 0,
            current_step: data.currentStep,
            updated_at: new Date().toISOString(),
          })
          .eq("id", executionId);

        console.log(`📊 Execution ${executionId} progress: ${data.progress}%`);
        break;
      }

      case "execution.step_completed": {
        // Store step result in results jsonb field
        const { data: execution } = await supabaseAdmin
          .from("pipeline_executions")
          .select("results")
          .eq("id", executionId)
          .single();

        const currentResults = execution?.results || {};
        const updatedResults = {
          ...currentResults,
          [data.stepType]: {
            imageUrl: data.imageUrl,
            completedAt: data.completedAt || new Date().toISOString(),
            processingTime: data.processingTime,
            metadata: data.metadata,
          },
        };

        await supabaseAdmin
          .from("pipeline_executions")
          .update({
            results: updatedResults,
            current_step: data.nextStep || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", executionId);

        console.log(`✅ Step ${data.stepType} completed for execution ${executionId}`);
        break;
      }

      case "execution.completed": {
        await supabaseAdmin
          .from("pipeline_executions")
          .update({
            status: "completed",
            progress: 100,
            completed_at: data.completedAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", executionId);

        // Update user_generations status
        if (data.projectId) {
          await supabaseAdmin
            .from("user_generations")
            .update({
              status: "completed",
              completed_at: data.completedAt || new Date().toISOString(),
            })
            .eq("project_id", data.projectId);

          // Update project status
          await supabaseAdmin
            .from("user_generation_projects")
            .update({
              status: "archived",
              completed_at: data.completedAt || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", data.projectId);
        }

        console.log(`🎉 Execution ${executionId} completed successfully`);
        break;
      }

      case "execution.failed": {
        await supabaseAdmin
          .from("pipeline_executions")
          .update({
            status: "failed",
            error_code: data.errorCode,
            error_message: data.errorMessage,
            error_step_id: data.errorStep,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", executionId);

        // Update user_generations status
        if (data.projectId) {
          await supabaseAdmin
            .from("user_generations")
            .update({
              status: "failed",
              error_message: data.errorMessage,
              completed_at: new Date().toISOString(),
            })
            .eq("project_id", data.projectId);
        }

        console.error(`❌ Execution ${executionId} failed: ${data.errorMessage}`);
        break;
      }

      case "execution.cancelled": {
        await supabaseAdmin
          .from("pipeline_executions")
          .update({
            status: "cancelled",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", executionId);

        console.log(`🚫 Execution ${executionId} cancelled`);
        break;
      }

      case "execution.notification": {
        // Handle notifications (could trigger email, push, etc.)
        console.log(`🔔 Notification for execution ${executionId}:`, data.message);
        // TODO: Implement notification system
        break;
      }

      default:
        console.warn(`⚠️ Unknown webhook event: ${event}`);
        return json({ error: `Unknown event: ${event}` }, { status: 400 });
    }

    // TODO: Broadcast to WebSocket/SSE for real-time UI updates
    // await broadcastToUser(data.userId, { event, executionId, data });

    return json({ success: true, event, executionId });
  } catch (error: any) {
    console.error("❌ Webhook error:", error);
    return json(
      { error: error.message || "Webhook processing failed" },
      { status: 500 }
    );
  }
}
