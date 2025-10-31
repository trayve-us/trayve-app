/**
 * API endpoint to deduct credits for image generation
 * POST /api/credits/deduct
 */

import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../config/shopify.server";
import { getShopifyUserByShop } from "../lib/auth";
import { consumeUserCredits, CREDIT_COSTS } from "../lib/credits";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Authenticate the Shopify session
    const { session } = await authenticate.admin(request);
    
    // Get the Shopify user
    const user = await getShopifyUserByShop(session.shop);
    if (!user) {
      return json({ error: "User not found" }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const { amount, description, featureType } = body;

    if (!amount || amount <= 0) {
      return json({ error: "Invalid amount" }, { status: 400 });
    }

    // Consume credits
    const result = await consumeUserCredits(
      user.trayve_user_id,
      amount,
      description || "AI Generation",
      featureType || "ai_generation"
    );

    if (!result.success) {
      return json(
        { 
          error: result.error || "Failed to deduct credits",
          success: false 
        },
        { status: 400 }
      );
    }

    return json({
      success: true,
      creditsConsumed: result.creditsConsumed,
      remainingBalance: result.remainingBalance,
    });
  } catch (error: any) {
    console.error("Error deducting credits:", error);
    return json(
      { 
        error: error.message || "Failed to deduct credits",
        success: false 
      },
      { status: 500 }
    );
  }
};
