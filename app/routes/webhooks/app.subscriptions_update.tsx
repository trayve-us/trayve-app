import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../../config/shopify.server";
import db from "../../config/db.server";
import { getShopifyUserByShop } from "../../lib/auth";
import { updateSubscriptionStatus } from "../../lib/services/subscription.service";

/**
 * Webhook handler for APP_SUBSCRIPTIONS_UPDATE
 * 
 * Per Shopify docs: "To receive a notification when a subscription status changes,
 * such as when a charge is successful, subscribe to the GraphQL Admin API's
 * APP_SUBSCRIPTIONS_UPDATE webhook topic."
 * 
 * This webhook is triggered when:
 * - Subscription status changes (PENDING -> ACTIVE, ACTIVE -> CANCELLED, etc.)
 * - Capped amount changes
 * - Subscription is updated in any way
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

  console.log("📬 Webhook received:", topic, "for shop:", shop);
  console.log("📦 Payload:", JSON.stringify(payload, null, 2));

  if (!admin) {
    // The admin context isn't returned if the webhook fired after a shop was uninstalled.
    throw new Response();
  }

  try {
    const appSubscription = payload.app_subscription;
    
    if (!appSubscription) {
      console.log("⚠️ No app_subscription in payload");
      throw new Response("No subscription data", { status: 400 });
    }

    const user = await getShopifyUserByShop(shop);
    
    if (!user) {
      console.log("⚠️ User not found for shop:", shop);
      throw new Response("User not found", { status: 404 });
    }

    // Update subscription status in database
    const status = appSubscription.status.toLowerCase();
    
    console.log("🔄 Updating subscription status:", {
      shop,
      status,
      subscriptionId: appSubscription.admin_graphql_api_id,
    });

    await updateSubscriptionStatus(
      user.trayve_user_id,
      appSubscription.admin_graphql_api_id,
      status as 'active' | 'cancelled' | 'frozen' | 'expired'
    );

    console.log("✅ Subscription status updated successfully");

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("❌ Error processing subscription webhook:", error);
    throw new Response("Error processing webhook", { status: 500 });
  }
};
