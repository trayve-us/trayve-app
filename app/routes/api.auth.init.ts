/**
 * API Route: Initialize user and credits on first shop access
 * POST /api/auth/init
 */

import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../config/shopify.server";
import { getOrCreateShopifyUser } from "../lib/auth";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // Authenticate with Shopify
    const { session } = await authenticate.admin(request);
    const shop = session.shop;

    if (!shop) {
      return json({ success: false, error: "No shop found" }, { status: 401 });
    }

    // Get or create Shopify user (auto-grants 2000 credits if new)
    const { user, isNewUser } = await getOrCreateShopifyUser(shop, {
      shopId: session.id,
    });

    return json({
      success: true,
      user: {
        shop_domain: user.shop_domain,
        trayve_user_id: user.trayve_user_id,
        is_active: user.is_active,
      },
      isNewUser,
      message: isNewUser
        ? "Welcome! You've been credited with 2000 credits to get started."
        : "Welcome back!",
    });
  } catch (error: any) {
    console.error("Error initializing user:", error);
    return json(
      {
        success: false,
        error: error.message || "Failed to initialize user",
      },
      { status: 500 }
    );
  }
};
