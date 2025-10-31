/**
 * API Route: Get user credit balance
 * GET /api/credits/balance
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../config/shopify.server";
import { getShopifyUserByShop } from "../lib/auth";
import { getUserCreditBalance } from "../lib/credits";
import { getActiveSubscription } from "../lib/services/subscription.service";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Authenticate with Shopify
    const { session } = await authenticate.admin(request);
    const shop = session.shop;

    if (!shop) {
      return json({ success: false, error: "No shop found" }, { status: 401 });
    }

    // Get Shopify user mapping
    const shopifyUser = await getShopifyUserByShop(shop);
    
    if (!shopifyUser) {
      return json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Get credit balance
    const balance = await getUserCreditBalance(shopifyUser.trayve_user_id);
    
    // Get active subscription to determine plan
    const activeSubscription = await getActiveSubscription(shopifyUser.trayve_user_id);
    
    // Map plan tier to display name
    const planNames: Record<string, string> = {
      'free': 'Free Plan',
      'creator': 'Creator Plan',
      'professional': 'Professional Plan',
      'enterprise': 'Enterprise Plan',
    };

    let planDisplayName = 'Free Plan';
    let planTier = 'free';
    
    if (activeSubscription && activeSubscription.status === 'active') {
      // User has active subscription
      planTier = activeSubscription.plan_tier;
      planDisplayName = planNames[planTier] || 'Free Plan';
    } else {
      // Check if user has a cancelled subscription (to show previous plan)
      const { getSubscriptionHistory } = await import('../lib/services/subscription.service');
      const subscriptionHistory = await getSubscriptionHistory(shopifyUser.trayve_user_id);
      
      // Find the most recent cancelled subscription that's NOT free tier
      const cancelledSubscription = subscriptionHistory.find(
        sub => sub.status === 'cancelled' && sub.plan_tier !== 'free'
      );
      
      if (cancelledSubscription && balance && balance.available_credits > 0) {
        // Only show "Previous (Plan Name)" if they have remaining credits from cancelled plan
        const previousPlanName = planNames[cancelledSubscription.plan_tier] || 'Plan';
        planDisplayName = `Previous (${previousPlanName})`;
        planTier = 'free'; // Current tier is free after cancellation
      } else {
        // No cancelled paid plan with credits, show Free Plan
        planDisplayName = 'Free Plan';
        planTier = 'free';
      }
    }

    if (!balance) {
      return json({
        success: true,
        user_id: shopifyUser.trayve_user_id,
        shop_domain: shop,
        total_credits: 0,
        used_credits: 0,
        available_credits: 0,
        plan: planDisplayName,
        plan_tier: planTier,
        updated_at: new Date().toISOString(),
      });
    }

    return json({
      success: true,
      user_id: balance.user_id,
      shop_domain: shop,
      total_credits: balance.total_credits,
      used_credits: balance.used_credits,
      available_credits: balance.available_credits,
      plan: planDisplayName,
      plan_tier: planTier,
      updated_at: balance.updated_at,
    });
  } catch (error: any) {
    console.error("Error fetching credit balance:", error);
    return json(
      {
        success: false,
        error: error.message || "Failed to fetch credit balance",
      },
      { status: 500 }
    );
  }
};
