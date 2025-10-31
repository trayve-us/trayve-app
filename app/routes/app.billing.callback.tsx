import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../config/shopify.server";
import { getShopifyUserByShop, updateShopifyUserMetadata } from "../lib/auth";
import { createSubscription, getSubscriptionPlan, getActiveSubscription, cancelSubscription } from "../lib/services/subscription.service";
import { useEffect } from "react";

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
    // This will handle session restoration after Shopify redirect
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

        // CRITICAL: First check if this specific charge already has a subscription
        // This prevents duplicate creation if callback is called multiple times
        const { data: existingChargeSubscription } = await (await import('../lib/storage/supabase.server')).supabaseAdmin
          .from("shopify_user_subscriptions")
          .select("id, plan_tier, status, shopify_charge_id")
          .eq("shopify_charge_id", activeSubscription.id)
          .maybeSingle();

        if (existingChargeSubscription) {
          console.log("⚠️  Subscription already exists for this charge, skipping creation");
          console.log(`   Existing subscription: ${existingChargeSubscription.id}, tier: ${existingChargeSubscription.plan_tier}, status: ${existingChargeSubscription.status}`);
          
          // Clean up pending charge if it exists
          if (chargeId) {
            try {
              const { deletePendingCharge } = await import('../lib/shopify');
              await deletePendingCharge(chargeId);
            } catch (err) {
              console.error('❌ Failed to delete pending charge:', err);
            }
          }
          
          return authenticatedRedirect(`/app/studio?subscribed=true&plan=${encodeURIComponent(planName)}&credits=${plan.images_per_month}`);
        }

        // Now check if user has any other active subscription (like free tier)
        const existingSubscription = await getActiveSubscription(user.trayve_user_id);
        
        // Handle upgrading from free tier to paid tier
        // Since tier here is always a paid plan (creator/professional/enterprise),
        // we just need to check if there's an existing free tier subscription
        if (existingSubscription && existingSubscription.plan_tier === 'free') {
          console.log(`🔄 Upgrading from free tier to ${tier}, cancelling free subscription`);
          await cancelSubscription(existingSubscription.id);
          console.log("✅ Free tier subscription cancelled");
        }

        console.log("🆕 Creating subscription for", session.shop);
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
            const { deletePendingCharge } = await import('../lib/shopify');
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
    console.error("❌ Billing callback error:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    
    // If authentication fails, we need to trigger re-authentication
    // This can happen if the session token is missing or invalid after Shopify redirect
    if (error && typeof error === 'object' && 'message' in error) {
      const errorMessage = (error as Error).message || '';
      console.error("Error message:", errorMessage);
      
      // Check for authentication-related errors
      if (errorMessage.includes('authenticate') || 
          errorMessage.includes('session') || 
          errorMessage.includes('token') ||
          errorMessage.includes('unauthorized')) {
        console.log("🔄 Authentication error detected, returning data for client-side re-auth");
        // Return data to trigger client-side redirect to re-authenticate
        return { needsReauth: true, chargeId, error: errorMessage };
      }
    }
    
    // Use standard redirect for error cases (fallback if authentication fails)
    return redirect("/app/pricing?error=subscription_error");
  }
};

export default function BillingCallback() {
  const data = useLoaderData<typeof loader>();
  
  useEffect(() => {
    // If we need re-authentication, redirect to the app which will trigger proper auth flow
    if (data && typeof data === 'object' && 'needsReauth' in data && data.needsReauth) {
      console.log("🔄 Re-authentication needed, redirecting to app home");
      // Store charge_id in sessionStorage to process after re-auth
      if ('chargeId' in data && data.chargeId) {
        sessionStorage.setItem('pending_charge_id', data.chargeId as string);
      }
      // Redirect to app home which will trigger authentication
      // Then we can check for pending_charge_id and process it
      window.top!.location.href = `/app/pricing?processing=true`;
    }
  }, [data]);
  
  // Show loading state while processing
  if (data && typeof data === 'object' && 'needsReauth' in data && data.needsReauth) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ 
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #3498db',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          animation: 'spin 1s linear infinite'
        }} />
        <p>Processing your subscription... Please wait.</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return null;
}
