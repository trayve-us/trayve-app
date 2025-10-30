import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getShopifyUserByShop, updateShopifyUserMetadata } from "../lib/auth.server";
import { createSubscription, getSubscriptionPlan } from "../lib/services/subscription.service";

const PLAN_NAME_TO_TIER = {
  "Creator Plan": "creator",
  "Professional Plan": "professional",
  "Enterprise Plan": "enterprise",
} as const;

/**
 * Billing callback route - handles merchant redirect after approving subscription
 * According to Shopify docs: charge_id is automatically appended by Shopify
 * Route: /app/billing/callback?charge_id=xxx
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const chargeId = url.searchParams.get("charge_id");
  
  console.log("🔔 Billing callback - charge_id:", chargeId, "URL:", url.toString());

  try {
    // Authenticate using token exchange (recommended for embedded apps)
    const { admin, session, redirect: authenticatedRedirect } = await authenticate.admin(request);
    console.log("✅ Authenticated - shop:", session.shop);

    // Query active subscriptions using GraphQL Admin API
    // Per Shopify docs: After approval, subscription transitions from PENDING to ACTIVE
    const response = await admin.graphql(`
      #graphql
      query GetActiveSubscriptions {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            createdAt
            currentPeriodEnd
            test
          }
        }
      }
    `);

    const result = await response.json();
    const subscriptions = result.data?.currentAppInstallation?.activeSubscriptions;
    
    console.log("📋 Active subscriptions:", JSON.stringify(subscriptions, null, 2));

    if (subscriptions && subscriptions.length > 0) {
      const activeSubscription = subscriptions
        .filter((sub: any) => sub.status === "ACTIVE")
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      if (activeSubscription) {
        const planName = activeSubscription.name;
        const tier = PLAN_NAME_TO_TIER[planName as keyof typeof PLAN_NAME_TO_TIER] || "free";
        const plan = await getSubscriptionPlan(tier);
        
        if (!plan) {
          return authenticatedRedirect("/app/pricing?error=plan_not_found");
        }

        const user = await getShopifyUserByShop(session.shop);
        if (!user) {
          return authenticatedRedirect("/app/pricing?error=user_not_found");
        }

        console.log("��� Creating subscription for", session.shop);
        await createSubscription({
          trayve_user_id: user.trayve_user_id,
          shop: session.shop,
          plan_tier: tier,
          shopify_charge_id: activeSubscription.id,
          status: 'active',
          metadata: {
            shopify_subscription_name: planName,
            shopify_subscription_status: activeSubscription.status,
            current_period_end: activeSubscription.currentPeriodEnd,
            created_at: activeSubscription.createdAt,
            charge_id: chargeId,
          },
        });

        await updateShopifyUserMetadata(user.id, {
          subscriptionTier: tier,
          subscriptionId: activeSubscription.id,
          subscriptionStatus: activeSubscription.status,
          subscriptionName: planName,
        });

        console.log("✅ Subscription created:", tier, plan.images_per_month, "images/month");
        
        // Clean up the pending charge mapping from Supabase
        if (chargeId) {
          try {
            const { deletePendingCharge } = await import('../lib/pending-charges.server');
            await deletePendingCharge(chargeId);
            console.log(`🗑️  Cleaned up pending charge: ${chargeId}`);
          } catch (err) {
            console.error('❌ Failed to delete pending charge:', err);
            // Continue anyway - this is just cleanup
          }
        }
        
        // Use the authenticated redirect to stay in embedded context
        return authenticatedRedirect(`/app/studio?subscribed=true&plan=${encodeURIComponent(planName)}&credits=${plan.images_per_month}`);
      }
    }

    return authenticatedRedirect("/app/pricing?error=subscription_declined");
  } catch (error) {
    console.error("Billing callback error:", error);
    
    // Use standard redirect for error cases (fallback if authentication fails)
    return redirect("/app/pricing?error=subscription_error");
  }
};
