/**
 * Subscription Status Service
 * Tracks and manages subscription status changes and history
 */

import { supabaseAdmin } from "../storage/supabase.server";

export interface SubscriptionStatus {
  id: string;
  subscription_id: string;
  shop: string;
  trayve_user_id: string;
  previous_status: string | null;
  current_status: string;
  status_reason: string | null;
  shopify_charge_id: string | null;
  shopify_subscription_name: string | null;
  credits_allocated: number;
  credits_remaining: number;
  billing_amount: number | null;
  billing_currency: string;
  billing_period_start: string | null;
  billing_period_end: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * Get subscription status history for a subscription
 */
export async function getSubscriptionStatusHistory(
  subscriptionId: string
): Promise<SubscriptionStatus[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("shopify_subscription_status")
      .select("*")
      .eq("subscription_id", subscriptionId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching subscription status history:", error);
      throw new Error(`Failed to fetch status history: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error("Error in getSubscriptionStatusHistory:", error);
    throw error;
  }
}

/**
 * Get subscription status history for a shop
 */
export async function getShopSubscriptionStatusHistory(
  shop: string,
  limit: number = 50
): Promise<SubscriptionStatus[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("shopify_subscription_status")
      .select("*")
      .eq("shop", shop)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching shop status history:", error);
      throw new Error(`Failed to fetch shop status history: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error("Error in getShopSubscriptionStatusHistory:", error);
    throw error;
  }
}

/**
 * Get current subscription status for a shop
 */
export async function getCurrentSubscriptionStatus(
  shop: string
): Promise<SubscriptionStatus | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("shopify_subscription_status")
      .select("*")
      .eq("shop", shop)
      .eq("current_status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      console.error("Error fetching current status:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error in getCurrentSubscriptionStatus:", error);
    return null;
  }
}

/**
 * Manually log a subscription status change
 * (Use this for manual tracking or additional logging beyond the trigger)
 */
export async function logSubscriptionStatusChange(params: {
  subscription_id: string;
  shop: string;
  trayve_user_id: string;
  previous_status: string | null;
  current_status: string;
  status_reason?: string;
  shopify_charge_id?: string;
  credits_allocated?: number;
  credits_remaining?: number;
  billing_amount?: number;
  billing_period_start?: string;
  billing_period_end?: string;
  metadata?: Record<string, any>;
}): Promise<SubscriptionStatus> {
  try {
    const { data, error } = await supabaseAdmin
      .from("shopify_subscription_status")
      .insert([{
        subscription_id: params.subscription_id,
        shop: params.shop,
        trayve_user_id: params.trayve_user_id,
        previous_status: params.previous_status,
        current_status: params.current_status,
        status_reason: params.status_reason || null,
        shopify_charge_id: params.shopify_charge_id || null,
        credits_allocated: params.credits_allocated || 0,
        credits_remaining: params.credits_remaining || 0,
        billing_amount: params.billing_amount || null,
        billing_period_start: params.billing_period_start || null,
        billing_period_end: params.billing_period_end || null,
        metadata: params.metadata || {},
      }])
      .select()
      .single();

    if (error) {
      console.error("Error logging status change:", error);
      throw new Error(`Failed to log status change: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error("Error in logSubscriptionStatusChange:", error);
    throw error;
  }
}

/**
 * Get subscription statistics for a shop
 */
export async function getSubscriptionStats(shop: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from("shopify_subscription_status")
      .select("current_status, created_at")
      .eq("shop", shop);

    if (error) {
      console.error("Error fetching subscription stats:", error);
      return null;
    }

    const totalChanges = data?.length || 0;
    const activeCount = data?.filter(s => s.current_status === 'active').length || 0;
    const cancelledCount = data?.filter(s => s.current_status === 'cancelled').length || 0;
    const expiredCount = data?.filter(s => s.current_status === 'expired').length || 0;

    return {
      totalChanges,
      activeCount,
      cancelledCount,
      expiredCount,
      lastChange: data && data.length > 0 ? data[0].created_at : null,
    };
  } catch (error) {
    console.error("Error in getSubscriptionStats:", error);
    return null;
  }
}
