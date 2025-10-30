/**
 * Credits Service for Shopify App
 * Manages credits for Shopify users (same tables as main Trayve app)
 */

import { supabaseAdmin } from "./supabase.server";

export interface CreditBalance {
  user_id: string;
  total_credits: number;
  used_credits: number;
  available_credits: number;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  transaction_type: "credit" | "debit";
  amount: number;
  description: string;
  feature_type: string;
  created_at: string;
}

export interface CreditUsageResult {
  success: boolean;
  creditsConsumed?: number;
  remainingBalance?: number;
  error?: string;
}

/**
 * Get user's credit balance
 */
export async function getUserCreditBalance(
  userId: string
): Promise<CreditBalance | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("user_credits")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to fetch credits: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return {
      user_id: data.user_id,
      total_credits: data.total_credits || 0,
      used_credits: data.used_credits || 0,
      available_credits:
        (data.total_credits || 0) - (data.used_credits || 0),
      updated_at: data.updated_at,
    };
  } catch (error) {
    console.error("Error fetching credit balance:", error);
    return null;
  }
}

/**
 * Check if user has sufficient credits
 */
export async function hasSufficientCredits(
  userId: string,
  requiredCredits: number
): Promise<boolean> {
  const balance = await getUserCreditBalance(userId);
  if (!balance) return false;
  return balance.available_credits >= requiredCredits;
}

/**
 * Consume credits for a user action
 * Uses the consume_user_credits RPC function
 */
export async function consumeUserCredits(
  userId: string,
  amount: number,
  description: string,
  featureType: string = "ai_generation"
): Promise<CreditUsageResult> {
  try {
    // Use the secure consume_user_credits RPC function
    const { data, error } = await supabaseAdmin.rpc("consume_user_credits", {
      p_user_id: userId,
      p_amount: amount,
      p_description: description,
      p_reference_type: featureType,
    });

    if (error) {
      console.error("Error consuming credits:", error);
      return {
        success: false,
        error: error.message || "Failed to consume credits",
      };
    }

    if (!data?.success) {
      return {
        success: false,
        error: data?.error || "Insufficient credits",
      };
    }

    return {
      success: true,
      creditsConsumed: amount,
      remainingBalance: data.new_balance,
    };
  } catch (error: any) {
    console.error("Credit consumption error:", error);
    return {
      success: false,
      error: error.message || "Failed to process credit consumption",
    };
  }
}

/**
 * Add credits to a user (for purchases, bonuses, etc.)
 */
export async function addUserCredits(
  userId: string,
  amount: number,
  description: string,
  featureType: string = "purchase"
): Promise<CreditUsageResult> {
  try {
    // Get current credits
    const { data: currentCredits, error: fetchError } = await supabaseAdmin
      .from("user_credits")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError && fetchError.code !== "PGRST116") {
      throw new Error(`Failed to fetch current credits: ${fetchError.message}`);
    }

    const newTotalCredits = (currentCredits?.total_credits || 0) + amount;

    // Update credits
    const { error: updateError } = await supabaseAdmin
      .from("user_credits")
      .upsert({
        user_id: userId,
        total_credits: newTotalCredits,
        used_credits: currentCredits?.used_credits || 0,
        updated_at: new Date().toISOString(),
      });

    if (updateError) {
      throw new Error(`Failed to add credits: ${updateError.message}`);
    }

    // Create transaction log
    await supabaseAdmin.from("credit_transactions").insert({
      user_id: userId,
      transaction_type: "credit",
      amount: amount,
      description: description,
      feature_type: featureType,
      created_at: new Date().toISOString(),
    });

    const newBalance =
      newTotalCredits - (currentCredits?.used_credits || 0);

    return {
      success: true,
      creditsConsumed: amount,
      remainingBalance: newBalance,
    };
  } catch (error: any) {
    console.error("Error adding credits:", error);
    return {
      success: false,
      error: error.message || "Failed to add credits",
    };
  }
}

/**
 * Get recent credit transactions for a user
 */
export async function getCreditTransactions(
  userId: string,
  limit: number = 20
): Promise<CreditTransaction[]> {
  const { data, error } = await supabaseAdmin
    .from("credit_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching credit transactions:", error);
    return [];
  }

  return data || [];
}

/**
 * Credit costs (same as main Trayve app)
 */
export const CREDIT_COSTS = {
  AI_GENERATION: 1000, // 1000 credits per generation
  IMAGE_VARIATION: 1000,
  STYLE_TRANSFER: 1000,
  HIGH_RES_GENERATION: 1000,
  BULK_GENERATION: 1000, // Per image
  UPSCALE: 1000,
  BACKGROUND_CHANGE: 1000,
} as const;

export type CreditFeature = keyof typeof CREDIT_COSTS;

/**
 * Middleware-style function to check and consume credits
 */
export async function withCreditsCheck<T>(
  userId: string,
  requiredCredits: number,
  operation: () => Promise<T>,
  featureType: string = "ai_generation"
): Promise<{ result: T; creditsConsumed: number; remainingCredits: number }> {
  // Check if user has sufficient credits
  const hasSufficient = await hasSufficientCredits(userId, requiredCredits);

  if (!hasSufficient) {
    throw new Error(
      "Insufficient credits. Please purchase more credits to continue."
    );
  }

  // Execute the operation
  const result = await operation();

  // Consume credits after successful operation
  const creditUsage = await consumeUserCredits(
    userId,
    requiredCredits,
    "AI generation completed",
    featureType
  );

  if (!creditUsage.success) {
    console.error(
      "Failed to consume credits after successful operation:",
      creditUsage.error
    );
    // Log for manual adjustment but don't fail the operation
  }

  return {
    result,
    creditsConsumed: creditUsage.success ? requiredCredits : 0,
    remainingCredits: creditUsage.remainingBalance || 0,
  };
}
