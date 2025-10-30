/**
 * Subscription Cancel API Route
 * POST /api/subscription/cancel
 * 
 * Cancels user's active subscription and deducts allocated credits
 */

import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getShopifyUserByShop, updateShopifyUserMetadata } from "../lib/auth.server";
import { cancelSubscriptionWithCredits } from "../lib/services/subscription.service";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // Authenticate the request
    const { session } = await authenticate.admin(request);

    console.log("🔍 Processing subscription cancellation for:", session.shop);

    // Get user
    const user = await getShopifyUserByShop(session.shop);
    
    if (!user) {
      return json(
        {
          success: false,
          error: "User not found",
        },
        { status: 404 }
      );
    }

    // Cancel subscription and deduct credits
    const result = await cancelSubscriptionWithCredits(user.trayve_user_id);

    // Update user metadata to reflect cancellation
    await updateShopifyUserMetadata(user.id, {
      subscriptionTier: 'free',
      subscriptionStatus: 'cancelled',
      subscriptionCancelledAt: new Date().toISOString(),
    });

    console.log(`✅ Subscription cancelled for ${session.shop}`);
    console.log(`   Credits deducted: ${result.creditsDeducted}`);
    console.log(`   New balance: ${result.newBalance}`);

    return json({
      success: true,
      message: "Subscription cancelled successfully",
      creditsDeducted: result.creditsDeducted,
      newBalance: result.newBalance,
      subscription: result.subscription,
    });
  } catch (error: any) {
    console.error("❌ Error cancelling subscription:", error);

    return json(
      {
        success: false,
        error: error.message || "Failed to cancel subscription",
      },
      { status: 500 }
    );
  }
};
