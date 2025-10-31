/**
 * API Route: Get Current Subscription
 * Returns the user's active subscription from the database
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../config/shopify.server";
import { getActiveSubscription } from "../lib/services/subscription.service";
import { getShopifyUserByShop } from "../lib/auth";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { session } = await authenticate.admin(request);
    const shop = session.shop;

    // Get Trayve user ID from shop
    const user = await getShopifyUserByShop(shop);
    if (!user) {
      return json({
        success: true,
        subscription: null,
        planTier: 'free',
      });
    }

    // Get active subscription from database using trayve_user_id
    const activeSubscription = await getActiveSubscription(user.trayve_user_id);

    if (!activeSubscription) {
      return json({
        success: true,
        subscription: null,
        planTier: 'free',
      });
    }

    return json({
      success: true,
      subscription: {
        id: activeSubscription.id,
        planTier: activeSubscription.plan_tier,
        status: activeSubscription.status,
        imagesAllocated: activeSubscription.images_allocated,
        billingPeriodStart: activeSubscription.billing_period_start,
        billingPeriodEnd: activeSubscription.billing_period_end,
        subscribedAt: activeSubscription.subscribed_at,
      },
      planTier: activeSubscription.plan_tier,
    });
  } catch (error) {
    console.error("Error fetching current subscription:", error);
    return json(
      {
        success: false,
        error: "Failed to fetch subscription",
        planTier: 'free',
      },
      { status: 500 }
    );
  }
}
