import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit, useActionData } from "@remix-run/react";
import { Page } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../config/shopify.server";
import { getShopifyUserByShop } from "../lib/auth";
import { getUserCreditBalance } from "../lib/credits";
import { getActiveSubscription } from "../lib/services/subscription.service";
import { storePendingCharge } from "../lib/shopify";
import { UserProfile } from "../components/UserProfile";
import { CreditsDisplay } from "../components/CreditsDisplay";
import { useEffect } from "react";

// Define subscription plans with pricing details
const SUBSCRIPTION_PLANS = {
  creator: {
    name: "Creator Plan",
    displayName: "Creator",
    price: 29.0,
    images: 30,
    credits: 30000,
    tier: "starter" as const,
  },
  professional: {
    name: "Professional Plan",
    displayName: "Professional",
    price: 89.0,
    images: 95,
    credits: 95000,
    tier: "professional" as const,
  },
  enterprise: {
    name: "Enterprise Plan",
    displayName: "Enterprise",
    price: 199.0,
    images: 220,
    credits: 220000,
    tier: "enterprise" as const,
  },
};

type PlanKey = keyof typeof SUBSCRIPTION_PLANS;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const user = await getShopifyUserByShop(shop);
  const balance = user ? await getUserCreditBalance(user.trayve_user_id) : null;

  // Check current active subscription from DATABASE
  let currentPlan: string | null = null;
  let dbSubscription = null;

  if (user) {
    try {
      // Get active subscription from our database
      dbSubscription = await getActiveSubscription(user.trayve_user_id);
      
      if (dbSubscription && dbSubscription.status === 'active') {
        currentPlan = dbSubscription.plan_tier;
        console.log(`📊 Found active subscription in DB: ${currentPlan}`);
      } else {
        console.log('📊 No active subscription in DB - user is on free tier');
      }
    } catch (error) {
      console.error("Error fetching subscription from DB:", error);
    }
  }

  return json({
    shop,
    user: user ? {
      email: user.shop_email || shop,
      shopName: user.shop_name || shop.replace('.myshopify.com', ''),
    } : null,
    credits: balance
      ? {
          available: balance.available_credits,
          total: balance.total_credits,
        }
      : { available: 0, total: 0 },
    currentPlan,
    dbSubscription: dbSubscription ? {
      id: dbSubscription.id,
      planTier: dbSubscription.plan_tier,
      status: dbSubscription.status,
      imagesAllocated: dbSubscription.images_allocated,
    } : null,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const planKey = formData.get("plan") as PlanKey;

  if (!planKey || !(planKey in SUBSCRIPTION_PLANS)) {
    return json({ error: "Invalid plan selected" }, { status: 400 });
  }

  const plan = SUBSCRIPTION_PLANS[planKey];

  try {
    // Build the return URL for the GraphQL API
    // IMPORTANT: The GraphQL mutation requires an ABSOLUTE URL (URL type in schema)
    // Use unauthenticated route that redirects to embedded app
    // Format: https://{SHOPIFY_APP_URL}/billing/callback
    // Shopify will append ?charge_id={id} automatically
    const appUrl = process.env.SHOPIFY_APP_URL || '';
    const returnUrl = `${appUrl}/billing/callback`;
    
    console.log(`🔗 Return URL (absolute URL for GraphQL): ${returnUrl}`);
    
    const response = await admin.graphql(
      `#graphql
      mutation CreateSubscription($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $test: Boolean) {
        appSubscriptionCreate(
          name: $name
          returnUrl: $returnUrl
          lineItems: $lineItems
          test: $test
        ) {
          userErrors {
            field
            message
          }
          appSubscription {
            id
            status
          }
          confirmationUrl
        }
      }`,
      {
        variables: {
          name: plan.name,
          returnUrl: returnUrl,
          test: true, // Use test mode for development
          lineItems: [
            {
              plan: {
                appRecurringPricingDetails: {
                  price: {
                    amount: plan.price,
                    currencyCode: "USD",
                  },
                  interval: "EVERY_30_DAYS",
                },
              },
            },
          ],
        },
      }
    );

    const result = await response.json();
    
    // Log the full response for debugging
    console.log("📦 GraphQL Response:", JSON.stringify(result, null, 2));
    
    const data = result.data?.appSubscriptionCreate;

    // Check for GraphQL errors (different from userErrors)
    if ('errors' in result && Array.isArray(result.errors) && result.errors.length > 0) {
      console.error("❌ GraphQL errors:", result.errors);
      return json(
        { error: (result.errors as any)[0].message },
        { status: 400 }
      );
    }

    if (data?.userErrors && data.userErrors.length > 0) {
      console.error("❌ Subscription creation user errors:", data.userErrors);
      return json(
        { error: data.userErrors[0].message },
        { status: 400 }
      );
    }

    if (data?.confirmationUrl) {
      // Extract numeric charge ID from the subscription ID
      const subscriptionId = data.appSubscription?.id;
      if (subscriptionId) {
        const chargeId = subscriptionId.replace('gid://shopify/AppSubscription/', '');
        
        // Store the charge_id to shop mapping in Supabase
        try {
          const { storePendingCharge } = await import('../lib/shopify');
          await storePendingCharge(chargeId, session.shop);
          console.log(`💾 Stored charge mapping: ${chargeId} -> ${session.shop}`);
        } catch (err) {
          console.error('❌ Failed to store pending charge:', err);
          // Continue anyway - the user can still complete the flow
        }
      }
      
      console.log(`✅ Redirecting to confirmation URL: ${data.confirmationUrl}`);
      // Return the URL to the client for App Bridge redirect
      return json({ confirmationUrl: data.confirmationUrl });
    }

    return json({ error: "Failed to create subscription" }, { status: 500 });
  } catch (error) {
    console.error("❌ Error creating subscription:", error);
    
    // Log more details if it's a GraphQL error
    if (error && typeof error === 'object' && 'graphQLErrors' in error) {
      console.error("❌ GraphQL Error Details:", JSON.stringify(error, null, 2));
    }
    
    return json(
      { error: "An error occurred while creating the subscription" },
      { status: 500 }
    );
  }
};

export default function Pricing() {
  const { user, currentPlan } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const submit = useSubmit();

  // Handle confirmation URL redirect using window.open for top-level navigation
  useEffect(() => {
    if (actionData && 'confirmationUrl' in actionData && actionData.confirmationUrl) {
      // Redirect to the confirmation URL at the top level (breaks out of iframe)
      window.open(actionData.confirmationUrl, '_top');
    }
  }, [actionData]);

  const handleUpgrade = (planKey: PlanKey) => {
    const formData = new FormData();
    formData.append("plan", planKey);
    submit(formData, { method: "post" });
  };

  return (
    <Page fullWidth>
      <TitleBar title="Pricing" />

      {/* Show loading message when redirecting to confirmation */}
      {actionData && 'confirmationUrl' in actionData && actionData.confirmationUrl && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '24px', 
              marginBottom: '16px',
              animation: 'spin 1s linear infinite',
            }}>⏳</div>
            <p style={{ fontSize: '18px', color: '#202223' }}>
              Redirecting to Shopify to confirm your subscription...
            </p>
          </div>
        </div>
      )}

      {/* Show error message if any */}
      {actionData && 'error' in actionData && actionData.error && (
        <div style={{
          backgroundColor: '#FFF4E5',
          border: '1px solid #FFB84D',
          borderRadius: '8px',
          padding: '16px',
          margin: '16px 24px',
          color: '#663C00',
        }}>
          <strong>Error:</strong> {actionData.error}
        </div>
      )}

      {/* TOP NAVBAR */}
      <div style={{
        backgroundColor: "white",
        borderBottom: "1px solid #E1E3E5",
        padding: "16px 24px",
        position: "sticky",
        top: 0,
        zIndex: 1000,
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: "1400px",
          margin: "0 auto",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
            <img 
              src="/logo_trayve.png" 
              alt="Trayve" 
              style={{
                height: "32px",
                width: "auto",
              }}
            />
            
            {/* Navigation Tabs */}
            <nav style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => navigate("/app/studio")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#6b7280",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f9fafb";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                Generate
              </button>
              <button
                onClick={() => navigate("/app/projects")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#6b7280",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f9fafb";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                Projects
              </button>
              <button
                onClick={() => navigate("/app/pricing")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#702dff",
                  backgroundColor: "rgba(112, 45, 255, 0.1)",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                Pricing
              </button>
            </nav>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <CreditsDisplay />
            {user && <UserProfile email={user.email} shopName={user.shopName} />}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        backgroundColor: "#FAFBFC",
        minHeight: "calc(100vh - 120px)",
        padding: "48px 24px",
      }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <h1 style={{
              fontSize: "48px",
              fontWeight: "700",
              color: "#202223",
              marginBottom: "16px",
            }}>
              Fashion Model Virtual Try-On
            </h1>
            <p style={{
              fontSize: "18px",
              color: "#6b7280",
              maxWidth: "600px",
              margin: "0 auto 24px",
            }}>
              16 AI Fashion Models • 5 Poses Each • 80 Total Combinations
            </p>
            <p style={{
              fontSize: "16px",
              color: "#6b7280",
              maxWidth: "700px",
              margin: "0 auto",
            }}>
              Free plan includes 4 models (20 combinations). Paid plans unlock all 16 models.
            </p>
          </div>

          {/* Pricing Cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "24px",
            marginBottom: "48px",
          }}>
            {/* Free Plan */}
            <PricingCard
              name="Free"
              price="$0"
              period="forever"
              features={[
                "2 images/month",
                "2K resolution",
                "4 AI models",
                "20 pose combinations",
                "Watermark on images",
                "Email support",
              ]}
              buttonText={currentPlan === null ? "Current Plan" : "Downgrade"}
              isPopular={false}
              isCurrent={currentPlan === null}
              isDisabled={true}
              onUpgrade={() => {}}
            />

            {/* Creator Plan */}
            <PricingCard
              name="Creator"
              price="$29"
              period="month"
              features={[
                "30 images/month",
                "30,000 credits/month",
                "+ 2,000 bonus credits (one-time)",
                "4K resolution",
                "All 16 AI models",
                "80 pose combinations",
                "No watermarks",
                "Commercial rights",
              ]}
              buttonText={currentPlan === "creator" ? "Current Plan" : "Upgrade"}
              isPopular={true}
              isCurrent={currentPlan === "creator"}
              isDisabled={currentPlan === "creator"}
              onUpgrade={() => handleUpgrade("creator")}
            />

            {/* Professional Plan */}
            <PricingCard
              name="Professional"
              price="$89"
              period="month"
              features={[
                "95 images/month",
                "95,000 credits/month",
                "+ 2,000 bonus credits (one-time)",
                "4K resolution",
                "All 16 AI models",
                "80 pose combinations",
                "Priority processing",
                "Priority support",
              ]}
              buttonText={currentPlan === "professional" ? "Current Plan" : "Upgrade"}
              isPopular={false}
              isCurrent={currentPlan === "professional"}
              isDisabled={currentPlan === "professional"}
              onUpgrade={() => handleUpgrade("professional")}
            />

            {/* Enterprise Plan */}
            <PricingCard
              name="Enterprise"
              price="$199"
              period="month"
              features={[
                "220 images/month",
                "220,000 credits/month",
                "+ 2,000 bonus credits (one-time)",
                "4K resolution",
                "All 16 AI models",
                "80 pose combinations",
                "Priority processing",
                "Priority support",
                "API access",
              ]}
              buttonText={currentPlan === "enterprise" ? "Current Plan" : "Upgrade"}
              isPopular={false}
              isCurrent={currentPlan === "enterprise"}
              isDisabled={currentPlan === "enterprise"}
              onUpgrade={() => handleUpgrade("enterprise")}
            />
          </div>

          {/* FAQ Section */}
          <div style={{ marginTop: "64px" }}>
            <h2 style={{
              fontSize: "36px",
              fontWeight: "700",
              color: "#202223",
              textAlign: "center",
              marginBottom: "32px",
            }}>
              Questions?
            </h2>
            <div style={{ maxWidth: "800px", margin: "0 auto" }}>
              <FAQItem
                question="Can I change my plan anytime?"
                answer="Yes! You can upgrade your plan at any time. Your new monthly image allowance will start immediately."
              />
              <FAQItem
                question="What happens if I run out of images?"
                answer="Once you've used your monthly allowance, you'll need to wait until the next billing cycle or upgrade to a higher plan for more images."
              />
              <FAQItem
                question="Do unused images roll over?"
                answer="No, unused images do not roll over to the next month. Each billing cycle refreshes your image allowance."
              />
              <FAQItem
                question="What's the difference between 2K and 4K resolution?"
                answer="Free plan provides 2K resolution images perfect for web use. Paid plans get 4K resolution images suitable for print and professional use."
              />
              <FAQItem
                question="How many AI models and poses do I get?"
                answer="Free plan: 4 models with 5 poses each (20 combinations). Paid plans: All 16 models with 5 poses each (80 combinations)."
              />
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}

// Pricing Card Component
function PricingCard({
  name,
  price,
  period,
  features,
  buttonText,
  isPopular,
  isCurrent,
  isDisabled,
  onUpgrade,
}: {
  name: string;
  price: string;
  period: string;
  features: string[];
  buttonText: string;
  isPopular: boolean;
  isCurrent: boolean;
  isDisabled: boolean;
  onUpgrade: () => void;
}) {
  return (
    <div style={{
      backgroundColor: "white",
      border: isPopular ? "2px solid #702dff" : "1px solid #E1E3E5",
      borderRadius: "16px",
      padding: "32px",
      position: "relative",
      boxShadow: isPopular ? "0 8px 24px rgba(112, 45, 255, 0.15)" : "0 2px 8px rgba(0, 0, 0, 0.05)",
      transition: "all 0.3s ease",
    }}>
      {isPopular && (
        <div style={{
          position: "absolute",
          top: "-12px",
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "#702dff",
          color: "white",
          padding: "4px 16px",
          borderRadius: "100px",
          fontSize: "12px",
          fontWeight: "600",
        }}>
          Most Popular
        </div>
      )}

      <h3 style={{
        fontSize: "20px",
        fontWeight: "600",
        color: "#202223",
        marginBottom: "16px",
      }}>
        {name}
      </h3>

      <div style={{ marginBottom: "24px" }}>
        <span style={{
          fontSize: "48px",
          fontWeight: "700",
          color: "#202223",
        }}>
          {price}
        </span>
        <span style={{
          fontSize: "16px",
          color: "#6b7280",
          marginLeft: "8px",
        }}>
          /{period}
        </span>
      </div>

      <div style={{
        borderTop: "1px solid #E1E3E5",
        paddingTop: "24px",
        marginBottom: "24px",
      }}>
        {features.map((feature, index) => (
          <div key={index} style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            marginBottom: "12px",
          }}>
            <div style={{
              width: "4px",
              height: "4px",
              backgroundColor: "#202223",
              borderRadius: "50%",
              marginTop: "8px",
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: "14px",
              color: "#6b7280",
            }}>
              {feature}
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={onUpgrade}
        disabled={isDisabled}
        style={{
          width: "100%",
          padding: "12px 24px",
          backgroundColor: isDisabled 
            ? "#e5e7eb" 
            : isPopular ? "#702dff" : "#f3f4f6",
          color: isDisabled 
            ? "#9ca3af"
            : isPopular ? "white" : "#202223",
          border: "none",
          borderRadius: "8px",
          fontSize: "14px",
          fontWeight: "600",
          cursor: isDisabled ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
          opacity: isDisabled ? 0.6 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isDisabled) {
            if (isPopular) {
              e.currentTarget.style.backgroundColor = "#5c24cc";
            } else {
              e.currentTarget.style.backgroundColor = "#e5e7eb";
            }
          }
        }}
        onMouseLeave={(e) => {
          if (!isDisabled) {
            if (isPopular) {
              e.currentTarget.style.backgroundColor = "#702dff";
            } else {
              e.currentTarget.style.backgroundColor = "#f3f4f6";
            }
          }
        }}
      >
        {buttonText}
      </button>
    </div>
  );
}

// FAQ Item Component
function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div style={{
      borderBottom: "1px solid #E1E3E5",
      padding: "24px 0",
    }}>
      <h3 style={{
        fontSize: "16px",
        fontWeight: "600",
        color: "#202223",
        marginBottom: "8px",
      }}>
        {question}
      </h3>
      <p style={{
        fontSize: "14px",
        color: "#6b7280",
        lineHeight: "1.6",
      }}>
        {answer}
      </p>
    </div>
  );
}
