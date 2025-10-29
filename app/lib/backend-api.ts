/**
 * Backend API Client for Shopify App
 * Calls the production Trayve API at trayve.app
 */

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'https://trayve.app';

export interface ShopifyUser {
  shop_domain: string;
  trayve_user_id: string;
  shop_id?: string;
  shop_name?: string;
  is_active: boolean;
}

export interface CreditBalance {
  shop_domain: string;
  user_id: string;
  total_credits: number;
  used_credits: number;
  available_credits: number;
  updated_at: string;
}

/**
 * Initialize or authenticate a Shopify shop
 * POST /api/shopify/auth/init
 */
export async function initShopifyAuth(
  shop: string,
  shopData?: {
    shopId?: string;
    shopName?: string;
    shopEmail?: string;
  }
): Promise<{ user: ShopifyUser; isNewUser: boolean }> {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/shopify/auth/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shop,
        shopId: shopData?.shopId,
        shopName: shopData?.shopName,
        shopEmail: shopData?.shopEmail,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to initialize shop');
    }

    const data = await response.json();
    return {
      user: data.user,
      isNewUser: data.isNewUser,
    };
  } catch (error: any) {
    console.error('Error initializing Shopify auth:', error);
    throw error;
  }
}

/**
 * Get credit balance for a Shopify shop
 * GET /api/shopify/credits/balance?shop=example.myshopify.com
 */
export async function getShopifyCreditBalance(shop: string): Promise<CreditBalance> {
  try {
    const response = await fetch(
      `${BACKEND_API_URL}/api/shopify/credits/balance?shop=${encodeURIComponent(shop)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      
      // If shop not found, try to initialize it first
      if (error.code === 'SHOP_NOT_FOUND') {
        console.log(`Shop ${shop} not found, initializing...`);
        await initShopifyAuth(shop);
        
        // Retry getting balance
        const retryResponse = await fetch(
          `${BACKEND_API_URL}/api/shopify/credits/balance?shop=${encodeURIComponent(shop)}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (!retryResponse.ok) {
          throw new Error('Failed to get credit balance after initialization');
        }
        
        return await retryResponse.json();
      }
      
      throw new Error(error.error || 'Failed to fetch credit balance');
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Error fetching credit balance:', error);
    throw error;
  }
}

/**
 * Check if a shop exists
 * GET /api/shopify/auth/init?shop=example.myshopify.com
 */
export async function checkShopExists(shop: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${BACKEND_API_URL}/api/shopify/auth/init?shop=${encodeURIComponent(shop)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.exists || false;
  } catch (error) {
    console.error('Error checking shop existence:', error);
    return false;
  }
}
