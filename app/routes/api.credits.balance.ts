/**
 * API Route: Get user credit balance
 * GET /api/credits/balance
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getShopifyUserByShop } from "../lib/auth.server";
import { getUserCreditBalance } from "../lib/credits.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Authenticate with Shopify
    const { session } = await authenticate.admin(request);
    const shop = session.shop;

    if (!shop) {
      return json({ success: false, error: "No shop found" }, { status: 401 });
    }

    // Get Shopify user mapping
    const shopifyUser = await getShopifyUserByShop(shop);
    
    if (!shopifyUser) {
      return json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Get credit balance
    const balance = await getUserCreditBalance(shopifyUser.trayve_user_id);

    if (!balance) {
      return json({
        success: true,
        user_id: shopifyUser.trayve_user_id,
        shop_domain: shop,
        total_credits: 0,
        used_credits: 0,
        available_credits: 0,
        updated_at: new Date().toISOString(),
      });
    }

    return json({
      success: true,
      user_id: balance.user_id,
      shop_domain: shop,
      total_credits: balance.total_credits,
      used_credits: balance.used_credits,
      available_credits: balance.available_credits,
      updated_at: balance.updated_at,
    });
  } catch (error: any) {
    console.error("Error fetching credit balance:", error);
    return json(
      {
        success: false,
        error: error.message || "Failed to fetch credit balance",
      },
      { status: 500 }
    );
  }
};
