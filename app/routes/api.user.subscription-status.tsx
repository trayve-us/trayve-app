import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/config/shopify.server";
import { supabaseAdmin } from "~/lib/storage/supabase.server";
import { getShopifyUserByShop } from "~/lib/auth";

/**
 * GET /api/user/subscription-status
 * Returns user's subscription tier and credits balance
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Authenticate Shopify request
    const { session } = await authenticate.admin(request);
    if (!session) {
      return json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get Trayve user ID from Shopify shop
    const user = await getShopifyUserByShop(session.shop);
    if (!user) {
      return json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const user_id = user.trayve_user_id;

    // Fetch user data
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, credits_balance, subscription_tier')
      .eq('id', user_id)
      .single();

    if (userError || !userData) {
      return json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    return json({
      success: true,
      tier: userData.subscription_tier || 'free',
      credits_balance: userData.credits_balance || 0
    });

  } catch (error: any) {
    console.error('Error fetching subscription status:', error);
    return json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}
