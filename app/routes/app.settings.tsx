import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { getShopifyStore } from "../lib/shopify-session.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const store = await getShopifyStore(session.shop);
  
  return json({
    shop: session.shop,
    store,
  });
};

export default function SettingsPage() {
  const { shop, store } = useLoaderData<typeof loader>();

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
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
          Credits & Billing
        </h2>
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '1.5rem',
            backgroundColor: 'white',
          }}
        >
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            Manage your credits and view billing history through your main Trayve account.
          </p>
          <a
            href="https://trayve.com/credits"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#5469d4',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontSize: '0.9rem',
              fontWeight: '500',
            }}
          >
            Manage Credits
          </a>
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
