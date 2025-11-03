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

    // Fetch Shopify user data with metadata
    const { data: shopifyUser, error: shopifyUserError } = await supabaseAdmin
      .from('shopify_users')
      .select('trayve_user_id, metadata')
      .eq('trayve_user_id', user_id)
      .single();

    if (shopifyUserError || !shopifyUser) {
      return json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    // Extract subscription tier from metadata
    const metadata = shopifyUser.metadata as any;
    const subscriptionTier = metadata?.subscriptionTier || 'free';

    // Fetch credits balance
    const { data: creditsData } = await supabaseAdmin
      .from('user_credits')
      .select('available_credits')
      .eq('user_id', user_id)
      .single();

    return json({
      success: true,
      tier: subscriptionTier,
      credits_balance: creditsData?.available_credits || 0
    });

  } catch (error: any) {
    console.error('Error fetching subscription status:', error);
    return json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}
