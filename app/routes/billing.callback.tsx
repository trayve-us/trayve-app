import { type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useEffect } from "react";

/**
 * Unauthenticated Billing Callback - Top-Level Redirect Handler
 * 
 * Shopify redirects here at top-level (outside iframe) after payment approval.
 * This page uses App Bridge to redirect back into the embedded app context.
 * 
 * Flow:
 * 1. Shopify redirects to: /billing/callback?charge_id=xxx (top-level, no iframe)
 * 2. This page loads, retrieves shop from database using charge_id
 * 3. Client-side: App Bridge redirects to embedded context: /app/billing/callback?charge_id=xxx&shop=xxx
 * 4. The /app route handles OAuth and subscription creation
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const chargeId = url.searchParams.get("charge_id");
  let shop = url.searchParams.get("shop");
  
  console.log(`🔄 Top-level billing callback - charge_id: ${chargeId}, shop: ${shop}`);

  if (!chargeId) {
    console.error("❌ Missing charge_id");
    return { error: "missing_charge_id", chargeId: null, shop: null, apiKey: process.env.SHOPIFY_API_KEY };
  }

  // Retrieve shop from Supabase using charge_id
  // This is necessary because Shopify doesn't include shop in the callback URL
  if (!shop) {
    try {
      const { getPendingChargeShop } = await import('../lib/shopify');
      shop = await getPendingChargeShop(chargeId);
      
      if (shop) {
        console.log(`✅ Retrieved shop from database: ${shop}`);
      } else {
        console.error("❌ No shop found for charge_id:", chargeId);
        return { error: "charge_not_found", chargeId, shop: null, apiKey: process.env.SHOPIFY_API_KEY };
      }
    } catch (err) {
      console.error("❌ Error retrieving shop:", err);
      return { error: "database_error", chargeId, shop: null, apiKey: process.env.SHOPIFY_API_KEY };
    }
  }

  return { error: null, chargeId, shop, apiKey: process.env.SHOPIFY_API_KEY };
};

export default function BillingCallback() {
  const { error, chargeId, shop, apiKey } = useLoaderData<typeof loader>();

  useEffect(() => {
    if (error) {
      // Redirect to pricing page with error
      window.location.href = `/app/pricing?error=${error}`;
      return;
    }

    if (chargeId && shop) {
      // Redirect to the app with shop parameter to trigger OAuth
      // The return_to parameter tells Shopify where to go after authentication
      const returnTo = `/app/billing/callback?charge_id=${chargeId}`;
      const authUrl = `https://${shop}/admin/apps/${apiKey}${returnTo}`;
      
      console.log(`➡️  Re-embedding app via OAuth: ${authUrl}`);
      
      // Redirect to Shopify admin which will load our app in an iframe
      // This triggers the embedded app authentication flow
      window.top!.location.href = authUrl;
    }
  }, [error, chargeId, shop]);

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>Processing Payment...</title>
        <meta name="shopify-api-key" content={apiKey} />
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
      </head>
      <body>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          {error ? (
            <div>
              <h1>Error</h1>
              <p>Redirecting to pricing page...</p>
            </div>
          ) : (
            <div>
              <h1>Payment Confirmed!</h1>
              <p>Redirecting you back to the app...</p>
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
