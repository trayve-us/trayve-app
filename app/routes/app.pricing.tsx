import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { Page } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getShopifyUserByShop } from "../lib/auth.server";
import { getUserCreditBalance } from "../lib/credits.server";
import { UserProfile } from "../components/UserProfile";
import { CreditsDisplay } from "../components/CreditsDisplay";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const user = await getShopifyUserByShop(shop);
  const balance = user ? await getUserCreditBalance(user.trayve_user_id) : null;

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
  });
};

export default function Pricing() {
  const { user } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <Page fullWidth>
      <TitleBar title="Pricing" />

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
              Pick What Works for You
            </h1>
            <p style={{
              fontSize: "18px",
              color: "#6b7280",
              maxWidth: "600px",
              margin: "0 auto",
            }}>
              Choose your quality. All plans include full model and pose library.
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
                "8 credits/month",
                "2K resolution",
                "Basic quality",
                "All models & poses",
              ]}
              buttonText="Current Plan"
              isPopular={false}
            />

            {/* Creator Plan */}
            <PricingCard
              name="Creator"
              price="$29"
              period="month"
              features={[
                "1,000 credits/month",
                "2K resolution",
                "Standard quality",
                "All models & poses",
              ]}
              buttonText="Upgrade"
              isPopular={true}
            />

            {/* Professional Plan */}
            <PricingCard
              name="Professional"
              price="$99"
              period="month"
              features={[
                "4,000 credits/month",
                "4K resolution",
                "Premium quality",
                "All models & poses",
              ]}
              buttonText="Upgrade"
              isPopular={false}
            />

            {/* Enterprise Plan */}
            <PricingCard
              name="Enterprise"
              price="$299"
              period="month"
              features={[
                "15,000 credits/month",
                "4K resolution",
                "Premium quality",
                "Priority support",
              ]}
              buttonText="Upgrade"
              isPopular={false}
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
                answer="If you're on the Free plan, you can upgrade to any paid plan whenever you want. If you're on Creator, you'll need to use all your credits before upgrading to Professional or Enterprise."
              />
              <FAQItem
                question="What happens if I run out of credits?"
                answer="You can buy more credits once you've used up your current ones. We do it this way because each tier has different image quality."
              />
              <FAQItem
                question="Do credits expire?"
                answer="Nope, your credits never expire. Keep them as long as you want."
              />
              <FAQItem
                question="Is there a free trial?"
                answer="We don't have a trial, but you get 8 credits when you sign up to test things out."
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
}: {
  name: string;
  price: string;
  period: string;
  features: string[];
  buttonText: string;
  isPopular: boolean;
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
        style={{
          width: "100%",
          padding: "12px 24px",
          backgroundColor: isPopular ? "#702dff" : "#f3f4f6",
          color: isPopular ? "white" : "#202223",
          border: "none",
          borderRadius: "8px",
          fontSize: "14px",
          fontWeight: "600",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          if (isPopular) {
            e.currentTarget.style.backgroundColor = "#5c24cc";
          } else {
            e.currentTarget.style.backgroundColor = "#e5e7eb";
          }
        }}
        onMouseLeave={(e) => {
          if (isPopular) {
            e.currentTarget.style.backgroundColor = "#702dff";
          } else {
            e.currentTarget.style.backgroundColor = "#f3f4f6";
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
