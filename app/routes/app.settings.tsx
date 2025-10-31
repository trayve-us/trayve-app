import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher, useNavigate } from "@remix-run/react";
import { authenticate } from "../config/shopify.server";
import { getShopifyStore } from "../lib/shopify";
import { getShopifyUserByShop } from "../lib/auth";
import { getActiveSubscription } from "../lib/services/subscription.service";
import { getUserCreditBalance } from "../lib/credits";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const store = await getShopifyStore(session.shop);
  const user = await getShopifyUserByShop(session.shop);
  
  let activeSubscription = null;
  let creditBalance = null;
  
  if (user) {
    activeSubscription = await getActiveSubscription(user.trayve_user_id);
    creditBalance = await getUserCreditBalance(user.trayve_user_id);
  }
  
  return json({
    shop: session.shop,
    store,
    user,
    activeSubscription,
    creditBalance,
  });
};

export default function SettingsPage() {
  const { shop, store, user, activeSubscription, creditBalance } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleCancelSubscription = async () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    fetcher.submit(
      {},
      {
        method: "POST",
        action: "/api/subscription/cancel",
      }
    );
    
    setShowConfirm(false);
  };

  const isLoading = fetcher.state === "submitting" || fetcher.state === "loading";
  const cancelSuccess = (fetcher.data as any)?.success === true;
  const cancelError = (fetcher.data as any)?.error;

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      {/* Back Button */}
      <button
        onClick={() => navigate('/app/studio')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          backgroundColor: 'transparent',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          fontSize: '0.875rem',
          color: '#374151',
          cursor: 'pointer',
          marginBottom: '1.5rem',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f9fafb';
          e.currentTarget.style.borderColor = '#d1d5db';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.borderColor = '#e5e7eb';
        }}
      >
        <ArrowLeft size={16} />
        <span>Back to Studio</span>
      </button>

      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>
        Settings
      </h1>

      {/* Account Information */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
          Account Information
        </h2>
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '1.5rem',
            backgroundColor: 'white',
          }}
        >
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
              Shop Domain
            </label>
            <p style={{ fontSize: '1rem', fontWeight: '500' }}>{shop}</p>
          </div>

          {store && (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
                  User ID
                </label>
                <p style={{ fontSize: '1rem', fontWeight: '500' }}>{store.user_id || 'N/A'}</p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
                  Access Scope
                </label>
                <p style={{ fontSize: '0.875rem', color: '#666', wordBreak: 'break-word' }}>
                  {store.scope || 'N/A'}
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Credits */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
          Credits & Subscription
        </h2>
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '1.5rem',
            backgroundColor: 'white',
          }}
        >
          {/* Credit Balance */}
          {creditBalance && (
            <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
                Available Credits (Images)
              </label>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#5469d4' }}>
                {creditBalance.available_credits}
              </p>
              <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                Total allocated: {creditBalance.total_credits}
              </p>
            </div>
          )}

          {/* Active Subscription */}
          {activeSubscription && activeSubscription.status === 'active' ? (
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
                Active Subscription
              </label>
              <p style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', textTransform: 'capitalize' }}>
                {activeSubscription.plan_tier} Plan
              </p>
              <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>
                {activeSubscription.images_allocated} images per month
              </p>
              {activeSubscription.billing_period_end && (
                <p style={{ fontSize: '0.875rem', color: '#666' }}>
                  Renews: {new Date(activeSubscription.billing_period_end).toLocaleDateString()}
                </p>
              )}
            </div>
          ) : (
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ color: '#666' }}>No active subscription</p>
            </div>
          )}

          {/* Success/Error Messages */}
          {cancelSuccess && (
            <div
              style={{
                padding: '1rem',
                backgroundColor: '#d1fae5',
                border: '1px solid #10b981',
                borderRadius: '6px',
                marginBottom: '1rem',
              }}
            >
              <p style={{ color: '#065f46', fontWeight: '500' }}>
                ✓ Subscription cancelled successfully
              </p>
              {(fetcher.data as any)?.creditsDeducted > 0 && (
                <p style={{ color: '#065f46', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  {(fetcher.data as any)?.creditsDeducted} credits deducted
                </p>
              )}
            </div>
          )}

          {cancelError && (
            <div
              style={{
                padding: '1rem',
                backgroundColor: '#fee2e2',
                border: '1px solid #ef4444',
                borderRadius: '6px',
                marginBottom: '1rem',
              }}
            >
              <p style={{ color: '#991b1b', fontWeight: '500' }}>
                ✗ Error: {cancelError}
              </p>
            </div>
          )}

          {/* Cancel Subscription Button (Testing Only) */}
          {activeSubscription && activeSubscription.status === 'active' && (
            <div>
              <p style={{ fontSize: '0.875rem', color: '#dc2626', fontWeight: '600', marginBottom: '0.5rem' }}>
                🧪 Testing Only
              </p>
              
              {!showConfirm ? (
                <button
                  onClick={handleCancelSubscription}
                  disabled={isLoading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.6 : 1,
                  }}
                >
                  {isLoading ? 'Cancelling...' : 'Cancel Subscription (Test)'}
                </button>
              ) : (
                <div>
                  <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}>
                    Are you sure? This will cancel your subscription and deduct{' '}
                    <strong>{activeSubscription.images_allocated} credits</strong> from your balance.
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      onClick={handleCancelSubscription}
                      disabled={isLoading}
                      style={{
                        padding: '0.75rem 1.5rem',
                        backgroundColor: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        fontWeight: '500',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        opacity: isLoading ? 0.6 : 1,
                      }}
                    >
                      {isLoading ? 'Cancelling...' : 'Yes, Cancel'}
                    </button>
                    <button
                      onClick={() => setShowConfirm(false)}
                      disabled={isLoading}
                      style={{
                        padding: '0.75rem 1.5rem',
                        backgroundColor: '#e5e7eb',
                        color: '#374151',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        fontWeight: '500',
                        cursor: 'pointer',
                      }}
                    >
                      No, Keep It
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* API Integration */}
      <section>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
          Integration Status
        </h2>
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '1.5rem',
            backgroundColor: 'white',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: store?.is_active ? '#10b981' : '#ef4444',
              }}
            />
            <p style={{ fontSize: '1rem', fontWeight: '500' }}>
              {store?.is_active ? 'Connected' : 'Disconnected'}
            </p>
          </div>
          
          {store && (
            <p style={{ fontSize: '0.875rem', color: '#666' }}>
              Installed on: {new Date(store.installed_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
