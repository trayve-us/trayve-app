/**
 * Subscription Service
 * Handles Shopify subscription plan operations and credit allocation
 */

import { supabaseAdmin } from "../supabase.server";

// =============================================
// TYPE DEFINITIONS
// =============================================

export interface SubscriptionPlan {
  id: string;
  plan_tier: 'free' | 'creator' | 'professional' | 'enterprise';
  plan_name: string;
  price_monthly: number;
  images_per_month: number;
  shopify_plan_id?: string;
  features: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSubscription {
  id: string;
  trayve_user_id: string;
  shop: string;
  plan_tier: 'free' | 'creator' | 'professional' | 'enterprise';
  shopify_charge_id?: string;
  shopify_confirmation_url?: string;
  status: 'pending' | 'active' | 'cancelled' | 'expired';
  images_allocated: number;
  credits_allocated?: number;
  billing_period_start?: string;
  billing_period_end?: string;
  subscribed_at?: string;
  cancelled_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  metadata?: any;
}

export interface CreateSubscriptionParams {
  trayve_user_id: string;
  shop: string;
  plan_tier: 'free' | 'creator' | 'professional' | 'enterprise';
  shopify_charge_id?: string;
  shopify_confirmation_url?: string;
  status?: 'pending' | 'active';
  metadata?: any;
}

// =============================================
// SUBSCRIPTION PLAN OPERATIONS
// =============================================

/**
 * Get all available subscription plans
 */
export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("shopify_subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("price_monthly", { ascending: true });

    if (error) {
      console.error("Error fetching subscription plans:", error);
      throw new Error(`Failed to fetch subscription plans: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error("Error in getSubscriptionPlans:", error);
    throw error;
  }
}

/**
 * Get a specific subscription plan by tier
 */
export async function getSubscriptionPlan(
  planTier: string
): Promise<SubscriptionPlan | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("shopify_subscription_plans")
      .select("*")
      .eq("plan_tier", planTier)
      .single();

    if (error) {
      console.error("Error fetching subscription plan:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error in getSubscriptionPlan:", error);
    return null;
  }
}

// =============================================
// USER SUBSCRIPTION OPERATIONS
// =============================================

/**
 * Create a new subscription record
 * The database trigger will automatically allocate credits when status is 'active'
 */
export async function createSubscription(
  params: CreateSubscriptionParams
): Promise<UserSubscription> {
  try {
    // Prepare insert data - explicitly exclude generated columns
    const insertData = {
      trayve_user_id: params.trayve_user_id,
      shop: params.shop,
      plan_tier: params.plan_tier,
      shopify_charge_id: params.shopify_charge_id,
      shopify_confirmation_url: params.shopify_confirmation_url,
      status: params.status || 'pending',
      metadata: params.metadata || {},
      // Do NOT include: available_credits, images_allocated (these are generated/computed)
    };

    const { data, error } = await supabaseAdmin
      .from("shopify_user_subscriptions")
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error("Error creating subscription:", error);
      throw new Error(`Failed to create subscription: ${error.message}`);
    }

    console.log(`✅ Created subscription for ${params.shop} - ${params.plan_tier}`);

    return data as UserSubscription;
  } catch (error) {
    console.error("Error in createSubscription:", error);
    throw error;
  }
}

/**
 * Update subscription status
 * When status changes to 'active', the database trigger will allocate credits
 */
export async function updateSubscriptionStatus(
  subscriptionId: string,
  status: 'pending' | 'active' | 'cancelled' | 'expired',
  metadata?: any
): Promise<UserSubscription> {
  try {
    const updateData: any = { status };

    if (status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
    }

    if (metadata) {
      updateData.metadata = metadata;
    }

    const { data, error } = await supabaseAdmin
      .from("shopify_user_subscriptions")
      .update(updateData)
      .eq("id", subscriptionId)
      .select()
      .single();

    if (error) {
      console.error("Error updating subscription status:", error);
      throw new Error(`Failed to update subscription: ${error.message}`);
    }

    console.log(`✅ Updated subscription ${subscriptionId} to status: ${status}`);

    return data as UserSubscription;
  } catch (error) {
    console.error("Error in updateSubscriptionStatus:", error);
    throw error;
  }
}

/**
 * Get active subscription for a user
 */
export async function getActiveSubscription(
  trayveUserId: string
): Promise<UserSubscription | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("shopify_user_subscriptions")
      .select("*")
      .eq("trayve_user_id", trayveUserId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      console.error("Error fetching active subscription:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error in getActiveSubscription:", error);
    return null;
  }
}

/**
 * Get subscription history for a user
 */
export async function getSubscriptionHistory(
  trayveUserId: string
): Promise<UserSubscription[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("shopify_user_subscriptions")
      .select("*")
      .eq("trayve_user_id", trayveUserId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching subscription history:", error);
      throw new Error(`Failed to fetch subscription history: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error("Error in getSubscriptionHistory:", error);
    throw error;
  }
}

/**
 * Get subscription by Shopify charge ID
 */
export async function getSubscriptionByChargeId(
  chargeId: string
): Promise<UserSubscription | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("shopify_user_subscriptions")
      .select("*")
      .eq("shopify_charge_id", chargeId)
      .single();

    if (error) {
      console.error("Error fetching subscription by charge ID:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error in getSubscriptionByChargeId:", error);
    return null;
  }
}

/**
 * Cancel active subscription
 */
export async function cancelSubscription(
  subscriptionId: string
): Promise<UserSubscription> {
  return updateSubscriptionStatus(subscriptionId, 'cancelled');
}

/**
 * Cancel active subscription and deduct remaining credits
 * @param trayveUserId - User's Trayve ID
 * @returns Updated subscription and credit balance
 */
export async function cancelSubscriptionWithCredits(
  trayveUserId: string
): Promise<{
  subscription: UserSubscription | null;
  creditsDeducted: number;
  newBalance: number;
}> {
  try {
    // Get active subscription
    const activeSubscription = await getActiveSubscription(trayveUserId);
    
    if (!activeSubscription) {
      throw new Error("No active subscription found");
    }

    // Get current credit balance
    const { data: creditData, error: creditError } = await supabaseAdmin
      .from("user_credits")
      .select("total_credits, used_credits")
      .eq("user_id", trayveUserId)
      .single();

    if (creditError) {
      console.error("Error fetching credits:", creditError);
      throw new Error("Failed to fetch credit balance");
    }

    const totalCredits = creditData?.total_credits || 0;
    const usedCredits = creditData?.used_credits || 0;
    const currentAvailableCredits = totalCredits - usedCredits;
    const creditsToDeduct = activeSubscription.images_allocated;

    // Calculate new used_credits (deducting from available means increasing used)
    // But we need to decrease total_credits instead since we're removing allocated credits
    const newTotalCredits = Math.max(0, totalCredits - creditsToDeduct);
    const actualDeducted = totalCredits - newTotalCredits;

    // Update credit balance by reducing total_credits
    const { error: updateError } = await supabaseAdmin
      .from("user_credits")
      .update({
        total_credits: newTotalCredits,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", trayveUserId);

    if (updateError) {
      console.error("Error updating credits:", updateError);
      throw new Error("Failed to deduct credits");
    }

    const newBalance = newTotalCredits - usedCredits;

    // Cancel the subscription
    const cancelledSubscription = await updateSubscriptionStatus(
      activeSubscription.id,
      'cancelled',
      {
        ...activeSubscription.metadata,
        cancellation_reason: 'user_initiated',
        credits_deducted: actualDeducted,
        credits_before_cancellation: currentAvailableCredits,
        credits_after_cancellation: newBalance,
      }
    );

    console.log(`✅ Cancelled subscription for user ${trayveUserId}`);
    console.log(`   Credits deducted: ${actualDeducted}`);
    console.log(`   New balance: ${newBalance}`);

    return {
      subscription: cancelledSubscription,
      creditsDeducted: actualDeducted,
      newBalance,
    };
  } catch (error) {
    console.error("Error in cancelSubscriptionWithCredits:", error);
    throw error;
  }
}

/**
 * Get subscription statistics for a user
 */
export async function getUserSubscriptionStats(trayveUserId: string) {
  try {
    const activeSubscription = await getActiveSubscription(trayveUserId);
    const history = await getSubscriptionHistory(trayveUserId);

    const totalSubscriptions = history.length;
    const totalSpent = history
      .filter(sub => sub.status === 'active' || sub.status === 'expired')
      .reduce(async (total, sub) => {
        const plan = await getSubscriptionPlan(sub.plan_tier);
        return (await total) + (plan?.price_monthly || 0);
      }, Promise.resolve(0));

    return {
      activeSubscription,
      totalSubscriptions,
      totalSpent: await totalSpent,
      history,
    };
  } catch (error) {
    console.error("Error in getUserSubscriptionStats:", error);
    throw error;
  }
}
